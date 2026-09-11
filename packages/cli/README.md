# Connecting to UserSessions.io

## One command

```
npx @usersessions/cli connect
```

Paste your API key when prompted (Settings → API Keys → generate one). This writes the MCP connection directly into Claude Desktop's and Cursor's config files and tells you to restart the app. That's the whole install — same one-line pattern as `npx skills add <slug>`, no global install, no manual file editing required for most people.

To target only one client:

```
npx @usersessions/cli connect --client=claude
npx @usersessions/cli connect --client=cursor
```

## Manual config, if you'd rather not run a script

Add this to Claude Desktop's `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`) or Cursor's `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "usersessions": {
      "url": "https://mcp.usersessions.io/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY_HERE"
      }
    }
  }
}
```

Restart the client. Read-only tools (`get_findings`, `get_actions`, `get_heatmap_summary`, `get_accounts`) work with any valid key. Write tools (`approve_finding`, `dismiss_finding`, `create_policy_rule`) require a write-scoped key — generating one is a separate, explicit step in Settings, not a default, since a write-scoped key can trigger real actions in your connected tools.

## Self-hosted / open source

The Managed Cloud MCP server is remote (`mcp.usersessions.io`) — nothing to run locally. Self-hosted deployments run the same server code (`mcp-server/`) on their own infrastructure instead of Cloudflare's, and point the same config at their own URL.

## What you can actually ask it

Once connected, in Claude or Cursor:

- "What P0 findings are open on my account right now?"
- "Show me the heatmap for /checkout over the last 7 days."
- "Approve finding fnd_39a0."
- "Create a policy that auto-executes P2 and P3 findings."

Every write action logs identically to a dashboard click or a Slack approval — there's one audit trail, not a separate one for things triggered through an AI client.
