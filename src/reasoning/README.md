# @usersessions/reasoning

MIT licensed. Self-hostable.

The AI classification pipeline used by UserSessions.io.
The production implementation lives in `src/dashboard/services/reasoning.ts`
and is orchestrated by `src/dashboard/app/api/_pipeline.ts`.

## What it does

- Dual-model routing: Claude Haiku for all sessions, Claude Sonnet for P0/P1 re-classification
- Structured output via Anthropic tool-use (not free-form JSON parsing)
- Categories: `bug` / `friction` / `billing` / `security`
- Severities: `P0` / `P1` / `P2` / `P3`
- Precision gating: single rage click ≠ P2; rage-click cluster requires 5+ clicks or co-occurring error
- PII-free: all payloads are redacted before reaching the classifier

## Self-hosting

Set your Anthropic API key and point the pipeline at your own Supabase instance.
The pipeline is invoked via the QStash background worker at `/api/queue/pipeline`.

```bash
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_HAIKU_MODEL=claude-haiku-4-5
ANTHROPIC_SONNET_MODEL=claude-sonnet-5
```

## License

MIT — see root LICENSE file.
