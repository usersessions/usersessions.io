# usersessions-mcp — Cloudflare Worker MCP Server

The Model Context Protocol server for UserSessions.io, running on Cloudflare Workers with Durable Objects.

Exposes your UserSessions account data directly inside Claude Desktop, Cursor, or any MCP-compatible AI client.

---

## Tools

### Read tools (any valid API key)

| Tool | Description |
|---|---|
| `get_findings` | List findings, filtered by severity (P0–P3) or status |
| `get_actions` | List the action audit log |
| `get_heatmap_summary` | Click/scroll heatmap aggregates for a page |
| `get_accounts` | CRM-linked accounts with ARR-at-risk |

### Write tools (write-scoped API key required)

| Tool | Description |
|---|---|
| `approve_finding` | Approve a pending finding — triggers the action pipeline identically to a dashboard click |
| `dismiss_finding` | Dismiss a finding with an optional reason — never billed |
| `create_policy_rule` | Create an auto-execution or approval-required policy rule |

All write actions log to the same audit trail as dashboard clicks and Slack approvals — there is one audit trail.

---

## Deployment

```bash
# Set secrets (never commit real values)
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY

# Deploy
wrangler deploy
```

The Managed Cloud instance runs at `https://mcp.usersessions.io/mcp`.

---

## Auth

Every request requires `Authorization: Bearer <api_key>`. Keys are SHA-256 hashed and matched against the `api_keys` table in Supabase. Revoked keys are rejected at the entry point before the Durable Object is created.

---

## Self-hosted

Deploy this Worker to your own Cloudflare account, set the two secrets, and point your MCP client config at your own URL instead of `mcp.usersessions.io`.
