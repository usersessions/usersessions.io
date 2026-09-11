# UserSessions.io — Dashboard

Next.js 15 (App Router) — the main product and marketing site.

---

## Tech stack

- **Framework:** Next.js 15, App Router, TypeScript, React 19
- **Styling:** Vanilla CSS + Tailwind (utility layer)
- **Database:** Supabase (Postgres + Realtime + Auth + RLS)
- **File storage:** Cloudflare R2 (session replay event streams)
- **AI:** Anthropic Claude (Haiku first pass, Sonnet for P0/P1) — see `services/reasoning.ts`
- **Background jobs:** Upstash QStash (`app/api/queue/pipeline/`) + Upstash Redis (rate limiting)
- **Actions:** Composio — see `services/executor.ts` and `services/action-catalog.ts`
- **Billing:** Paystack — see `lib/billing/paystack.ts`
- **Email:** Resend — see `lib/email/`
- **Deployment:** Cloudflare Workers via OpenNext

---

## Local development

```bash
# From monorepo root
pnpm install
cp .env.example .env.local   # fill in Supabase, Anthropic, Composio, Upstash, R2, Paystack keys
pnpm --filter dashboard dev  # → http://localhost:3000
```

---

## Key directories

| Path | Purpose |
|---|---|
| `app/(dashboard)/` | Authenticated dashboard (queue, sessions, findings, patches, billing…) |
| `app/home/` | Public marketing site |
| `app/api/_pipeline.ts` | Dual-model AI orchestrator |
| `app/api/ingest/` | Replay + heatmap ingest endpoints |
| `app/api/queue/pipeline/` | Upstash QStash background worker |
| `services/reasoning.ts` | Claude classification |
| `services/executor.ts` | Composio action execution |
| `services/policy.ts` | Autonomy threshold gate |
| `services/pii-redactor.ts` | PII strip before DB write |
| `lib/tiers.ts` | Single source of truth for plans and limits |
| `lib/billing/` | Paystack + enterprise license gate |
| `lib/patches/` | URL pattern matching + patch validation |
| `lib/notifications/` | Multi-channel notification dispatch |
| `public/capture.js` | First-party session capture SDK |

---

## Running tests

```bash
pnpm --filter dashboard test
```
