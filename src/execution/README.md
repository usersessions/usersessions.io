# @usersessions/execution

MIT licensed. Self-hostable.

The Composio action execution layer used by UserSessions.io.
The production implementation lives in `src/dashboard/services/executor.ts`
and `src/dashboard/services/action-catalog.ts`.

## What it does

- Executes approved actions through the Composio API
- Canonical action set: `create_issue`, `send_message`, `update_record`, `apply_ui_patch`, `create_pr`
- Per-toolkit capability map: only offers actions supported by the client's connected tools
- Billing meter: records each executed action against the client's usage (never bills dismissed findings)
- SSRF-protected outbound calls

## Supported toolkits

| Toolkit | Actions |
|---|---|
| JIRA | `create_issue` |
| LINEAR | `create_issue` |
| GITHUB | `create_issue`, `create_pr` |
| GITLAB | `create_issue`, `create_pr` |
| SLACK | `send_message` |
| SALESFORCE | `update_record` |
| HUBSPOT | `update_record` |
| UIPATCH | `apply_ui_patch` |

## Self-hosting

Bring your own Composio API key. BYO credentials for each connected toolkit.

```bash
COMPOSIO_API_KEY=your-composio-key
```

## License

MIT — see root LICENSE file.
