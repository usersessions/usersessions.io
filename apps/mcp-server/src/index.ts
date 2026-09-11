// UserSessions.io MCP server on Cloudflare Workers.
// Read tools query Supabase directly, scoped to the API key's client.
// Write tools are forwarded to the dashboard /api/mcp JSON-RPC endpoint so they
// take the same approval / license / policy path as the dashboard and Slack.

import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  DASHBOARD_URL?: string;
}

type AuthProps = { clientId: string; scopes: string[]; apiKey: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function supabaseFor(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function text(t: string, isError = false) {
  return { content: [{ type: "text" as const, text: t }], isError };
}

export class UserSessionsMCP extends McpAgent<Env, unknown, AuthProps> {
  server = new McpServer({ name: "usersessions", version: "1.1.0" });

  async init() {
    const db = supabaseFor(this.env);
    const clientId = this.props.clientId;
    const dashboard = (this.env.DASHBOARD_URL ?? "https://usersessions.io").replace(/\/$/, "");

    const forward = async (name: string, args: Record<string, unknown>) => {
      const res = await fetch(`${dashboard}/api/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.props.apiKey}` },
        body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method: "tools/call", params: { name, arguments: args } }),
      });
      if (!res.ok) return text(`Dashboard returned ${res.status}`, true);
      const json: any = await res.json();
      const first = json?.result?.content?.[0]?.text ?? JSON.stringify(json?.error ?? json);
      return text(String(first), Boolean(json?.result?.isError));
    };

    const requireWrite = () => {
      if (!this.props.scopes.includes("write:actions")) {
        throw new Error("This API key is read-only. Generate a write-scoped key in Settings to use this tool.");
      }
    };

    this.server.tool(
      "get_findings",
      "List findings for this workspace, optionally filtered by severity or status.",
      {
        severity: z.enum(["P0", "P1", "P2", "P3"]).optional(),
        status: z.enum(["pending", "approved", "dismissed", "executed", "partially_executed"]).optional(),
        limit: z.number().int().min(1).max(100).default(20),
      },
      async ({ severity, status, limit }) => {
        let query = db
          .from("us_findings")
          .select("id, category, severity, confidence, summary, account_value, recommended_actions, status, created_at")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (severity) query = query.eq("severity", severity);
        if (status) query = query.eq("status", status);
        const { data, error } = await query;
        return error ? text(`Error: ${error.message}`, true) : text(JSON.stringify(data ?? [], null, 2));
      }
    );

    this.server.tool(
      "get_actions",
      "List actions (the audit log) for this workspace.",
      {
        status: z.enum(["pending", "approve_required", "approved", "dismissed", "executing", "executed", "failed"]).optional(),
        limit: z.number().int().min(1).max(100).default(20),
      },
      async ({ status, limit }) => {
        let query = db
          .from("us_actions")
          .select("id, finding_id, composio_toolkit, composio_action, autonomy_level, status, result, approved_by, executed_at, created_at")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (status) query = query.eq("status", status);
        const { data, error } = await query;
        return error ? text(`Error: ${error.message}`, true) : text(JSON.stringify(data ?? [], null, 2));
      }
    );

    this.server.tool(
      "get_heatmap_summary",
      "Get click/scroll heatmap aggregates for a page path and viewport.",
      {
        page: z.string().max(2048),
        viewport: z.enum(["desktop", "tablet", "mobile"]).default("desktop"),
        days: z.number().int().min(1).max(90).default(7),
      },
      async ({ page, viewport, days }) => {
        const since = new Date(Date.now() - days * 86_400_000).toISOString();
        const { data, error } = await db
          .from("us_heatmap_aggregates")
          .select("page_url_pattern, viewport_bucket, date_trunc_hour, click_density_grid, scroll_depth_histogram, rage_click_clusters")
          .eq("client_id", clientId)
          .eq("page_url_pattern", page)
          .eq("viewport_bucket", viewport)
          .gte("date_trunc_hour", since)
          .order("date_trunc_hour", { ascending: false })
          .limit(200);
        return error ? text(`Error: ${error.message}`, true) : text(JSON.stringify(data ?? [], null, 2));
      }
    );

    this.server.tool(
      "get_accounts",
      "List CRM-linked accounts (ARR, health) for this workspace.",
      { limit: z.number().int().min(1).max(100).default(20) },
      async ({ limit }) => {
        const { data, error } = await db
          .from("us_accounts")
          .select("id, external_account_id, domain, arr, health_score, csm_owner, renewal_date, enriched_at")
          .eq("client_id", clientId)
          .order("arr", { ascending: false, nullsFirst: false })
          .limit(limit);
        return error ? text(`Error: ${error.message}`, true) : text(JSON.stringify(data ?? [], null, 2));
      }
    );

    this.server.tool(
      "approve_action",
      "Approve and execute a pending action via the dashboard approval path.",
      { action_id: z.string().regex(UUID_RE) },
      async ({ action_id }) => {
        requireWrite();
        return forward("approve_action", { actionId: action_id });
      }
    );

    this.server.tool(
      "dismiss_action",
      "Dismiss a pending action. Dismissed actions are never billed.",
      { action_id: z.string().regex(UUID_RE), reason: z.string().max(500).optional() },
      async ({ action_id, reason }) => {
        requireWrite();
        return forward("dismiss_action", { actionId: action_id, reason });
      }
    );

    this.server.tool(
      "create_policy_rule",
      "Create a policy rule (validated by the dashboard; defaults to approve_required).",
      {
        name: z.string().min(1).max(120),
        toolkit: z.enum(["SLACK", "JIRA", "LINEAR", "GITHUB", "GITLAB", "SALESFORCE", "HUBSPOT", "UIPATCH"]),
        action: z.enum(["post_message", "create_issue", "flag_account", "create_ui_patch", "create_pr"]),
        category: z.enum(["bug", "friction", "billing", "security"]).optional(),
        severity: z.enum(["P0", "P1", "P2", "P3"]).optional(),
        autonomy_level: z.enum(["auto", "approve_required"]).default("approve_required"),
      },
      async (args) => {
        requireWrite();
        return forward("create_policy_rule", args);
      }
    );
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const auth = request.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
    if (!token) return new Response("Missing API key. Pass it as: Authorization: Bearer <your key>", { status: 401 });

    const db = supabaseFor(env);
    const { data: keyRow } = await db
      .from("us_mcp_tokens")
      .select("id, client_id, scopes, revoked_at")
      .eq("token_hash", await sha256(token))
      .is("revoked_at", null)
      .maybeSingle();
    if (!keyRow) return new Response("Invalid or revoked API key.", { status: 401 });

    ctx.waitUntil(db.from("us_mcp_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id).then(() => undefined));

    // @ts-expect-error props is how the Agents SDK threads per-request auth into the Durable Object
    ctx.props = { clientId: keyRow.client_id, scopes: keyRow.scopes ?? [], apiKey: token } satisfies AuthProps;

    return UserSessionsMCP.serve("/mcp").fetch(request, env, ctx);
  },
};

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
