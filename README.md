# UserSessions.io

**AI-powered session intelligence that watches your product, finds the friction, and fixes it — autonomously.**

UserSessions.io captures every user session, runs it through a dual-model AI classification pipeline (Claude Haiku → Sonnet for high-severity escalations), and takes real action: creating Jira/Linear tickets, firing Slack alerts, enriching CRM records, or injecting live UI patches — without any manual triage.

---

## What it actually does

1. **Capture** — a lightweight `capture.js` snippet (SRI-pinned, rrweb-backed) records DOM events, rage clicks, JS errors, and scroll depth. Only qualifying sessions (≥1 rage click or JS error) upload their full event stream to R2.
2. **Ingest** — sessions arrive via first-party capture, or imported from Datadog RUM, PostHog, FullStory, LogRocket, or Hotjar connectors. PII is stripped at ingest time before anything hits the database.
3. **Reason** — a Claude Haiku first pass classifies every session (bug / friction / billing / security, P0–P3, confidence score). P0/P1 findings get a second Sonnet pass for higher precision. A single rage click is never P2. Precision gating is enforced in the system prompt.
4. **Decide** — each finding is evaluated against the client's policy rules. Actions under the autonomy threshold execute immediately; others queue for human approval in the dashboard or via a Slack approval flow.
5. **Act** — approved actions execute through Composio: `create_issue` (Jira/Linear/GitHub), `send_message` (Slack), `update_record` (Salesforce/HubSpot), or `apply_ui_patch` (live DOM injection with canary rollout and automatic rollback).
6. **Bill** — you pay per executed action, not per session analysed. Dismissed findings are never billed. Paystack handles subscriptions for Starter/Pro/Business; Enterprise is invoiced annually.

---

## Repository structure

```
src/
├── dashboard/          Next.js 15 — the full product
│   ├── app/
│   │   ├── (dashboard)/        Authenticated dashboard routes
│   │   │   ├── page.tsx        Main queue — live geo map, visitor panel, AI action queue
│   │   │   ├── sessions/       Session list + per-session replay player + heatmap canvas
│   │   │   ├── findings/       Finding explorer with severity filters
│   │   │   ├── approvals/      Human-in-the-loop approval queue
│   │   │   ├── live-patches/   Active UI patches — canary status, rollback controls
│   │   │   ├── policies/       Autonomy rules editor (per-severity, per-toolkit)
│   │   │   ├── notifications/  In-app notification centre
│   │   │   ├── settings/       API keys, connected sites, team, policy rules
│   │   │   ├── team/           Team member management
│   │   │   ├── billing/        Subscription management via Paystack
│   │   │   ├── connect/        Composio integration connect flow
│   │   │   └── accounts/       Account management
│   │   ├── api/
│   │   │   ├── _pipeline.ts    Dual-model AI orchestrator (Haiku → Sonnet for P0/P1)
│   │   │   ├── ingest/         replay + heatmap ingest endpoints (CORS, rate-limited)
│   │   │   ├── cron/           ingest poll, heatmap aggregation, patch evaluation, retention
│   │   │   ├── webhooks/       Datadog RUM, Composio, Resend, Slack webhooks
│   │   │   ├── queue/pipeline/ Upstash QStash background worker for AI classification
│   │   │   ├── billing/        Paystack checkout, webhook, dunning, action-fee invoicing
│   │   │   ├── actions/        Approve / dismiss endpoints (ownership-verified)
│   │   │   ├── patches/        Active patch serving, management, cache invalidation
│   │   │   ├── integrations/   Composio OAuth flow (initiate, callback, status)
│   │   │   ├── mcp/            JSON-RPC bridge for MCP tool calls from Claude/Cursor
│   │   │   ├── documents/      MBR generator, security bundle, compliance doc registry
│   │   │   ├── notify/         Action notification and escalation dispatch
│   │   │   └── admin/          Internal admin APIs (health, export, user management)
│   │   ├── home/               Public marketing site (homepage, pricing, compare, FAQ)
│   │   ├── admin/              Operator admin panel (user list, billing override)
│   │   └── auth/               Supabase auth callback + signout
│   ├── services/
│   │   ├── reasoning.ts        Claude classification with structured tool-use output
│   │   ├── policy.ts           Autonomy gate — auto-execute vs. queue for approval
│   │   ├── executor.ts         Composio action execution with billing meter
│   │   ├── enrichment.ts       CRM context pull (ARR, tier) for severity weighting
│   │   ├── normalizer.ts       Session normalisation across all connector sources
│   │   ├── pii-redactor.ts     Email, phone, card, SSN, IP strip before DB write
│   │   ├── action-catalog.ts   Canonical action set + per-toolkit capability map
│   │   ├── approval.ts         Slack approval message builder + callback handling
│   │   ├── first-party-audit.ts First-party capture.js session auditor
│   │   ├── billing-meter.ts    Per-action usage metering + overage calculation
│   │   ├── ssrf-protector.ts   SSRF guard for all outbound connector calls
│   │   └── connectors/
│   │       ├── datadog-rum.ts  Datadog RUM webhook + poll connector
│   │       ├── posthog.ts      PostHog connector
│   │       └── fullstory.ts    FullStory connector
│   ├── lib/
│   │   ├── tiers.ts            Single source of truth for plans, limits, Paystack codes
│   │   ├── billing/
│   │   │   ├── paystack.ts     Subscription checkout, webhook verification, dunning
│   │   │   ├── license.ts      Enterprise license key gate (us_enterprise_licenses table)
│   │   │   └── period.ts       Billing period utilities
│   │   ├── patches/
│   │   │   ├── url-pattern.ts  Wildcard URL pattern matcher for patch targeting
│   │   │   └── validate.ts     UI patch payload schema validation
│   │   ├── notifications/
│   │   │   ├── dispatch.ts     Multi-channel notification orchestrator
│   │   │   ├── channel-email.ts Resend transactional email
│   │   │   ├── channel-inapp.ts In-app notification writes
│   │   │   └── channel-slack.ts Slack block-kit approval + alert messages
│   │   ├── documents/          MBR, security bundle, compliance doc generation
│   │   ├── email/              Resend client + Supabase auth email templates
│   │   ├── config/pricing.ts   UI pricing config (maps from lib/tiers.ts)
│   │   ├── r2.ts               Cloudflare R2 replay storage client
│   │   ├── rate-limit.ts       Upstash Redis rate limiting
│   │   └── country-centroids.ts Country centroid data for live visitor map
│   ├── components/
│   │   ├── queue/              AI action queue (rows, stat cards, bulk action bar)
│   │   ├── analytics/          Site analytics panel + trend charts (@visx/d3)
│   │   ├── charts/             Full animated time-series chart system (@visx)
│   │   ├── settings/           API key manager, connected site panel, policy rule editor
│   │   ├── team/               Team management view
│   │   ├── home/               Live demo sandbox, heatmap canvas demo
│   │   ├── LiveMap.tsx         Real-time geo visitor map (Supabase realtime)
│   │   ├── RealtimeVisitorPanel.tsx  Live visitor feed (Supabase realtime)
│   │   ├── CanaryLivePanel.tsx Active patch status + rollback controls
│   │   ├── AIChatDrawer.tsx    Contextual AI chat drawer
│   │   └── CommandPalette.tsx  ⌘K command palette
│   ├── ee/governance/
│   │   └── license.ts          Enterprise license gate (wraps lib/billing/license.ts)
│   └── public/
│       └── capture.js          First-party session capture SDK (SRI-pinned rrweb)
│
├── capture/            First-party capture library (self-hostable, MIT)
├── reasoning/          Classification pipeline (self-hostable, MIT)
└── execution/          Composio action execution layer (self-hostable, MIT)

apps/
└── mcp-server/         Cloudflare Worker — MCP server for Claude Desktop / Cursor
                        Read tools query Supabase directly (scoped to API key).
                        Write tools proxy through /api/mcp (policy + approval path).

packages/
├── cli/                @usersessions/cli — `npx @usersessions/cli` connect tool
└── shared/             Shared types across workspace packages

ee/
└── governance/         Re-export stub → src/dashboard/ee/governance/license.ts
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend / API | Next.js 15 (App Router), React 19, TypeScript |
| Styling | Vanilla CSS + Tailwind (utility layer only) |
| Database | Supabase (Postgres + Realtime + Auth + RLS) |
| File storage | Cloudflare R2 (session replay event streams) |
| AI | Anthropic Claude (Haiku first pass, Sonnet for P0/P1) |
| Background jobs | Upstash QStash (AI pipeline), Upstash Redis (rate limiting) |
| Action execution | Composio (Jira, Linear, Slack, GitHub, Salesforce, HubSpot) |
| Billing | Paystack (subscriptions + webhook metering) |
| Email | Resend |
| Edge deployment | Cloudflare Workers (MCP server, OpenNext adapter) |
| Charts | @visx + d3 |
| Animations | motion (Framer Motion successor) |

---

## Plans

| Plan | Sessions/mo | Actions included | Overage | Price |
|---|---|---|---|---|
| Starter | 10,000 | 100 | $0.05/action | $29/mo |
| Pro | 50,000 | 1,000 | $0.02/action | $149/mo |
| Business | 250,000 | 5,000 | $0.01/action | $699/mo |
| Enterprise | Unlimited | Unlimited (BYO Composio) | — | Custom |

Dismissed findings are never billed.

---

## Quickstart (self-hosted)

```bash
corepack enable
pnpm install
cp .env.example .env.local   # fill in keys (see below)
pnpm --filter dashboard dev  # http://localhost:3000
```

### Required environment variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic (dual-model routing)
ANTHROPIC_API_KEY=
ANTHROPIC_HAIKU_MODEL=claude-haiku-4-5      # first pass (all sessions)
ANTHROPIC_SONNET_MODEL=claude-sonnet-5      # second pass (P0/P1 only)

# Composio (action execution)
COMPOSIO_API_KEY=

# Upstash (background queue + rate limiting)
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Cloudflare R2 (replay storage)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=

# Paystack (billing)
PAYSTACK_SECRET_KEY=
PAYSTACK_WEBHOOK_SECRET=
PAYSTACK_PLAN_STARTER_MONTHLY=
PAYSTACK_PLAN_PRO_MONTHLY=

# Resend (email)
RESEND_API_KEY=

# Cron auth
CRON_SECRET=
```

---

## Connect your AI client (Managed Cloud)

```bash
npx @usersessions/cli connect
```

Installs the capture snippet, creates an MCP config entry for Claude Desktop or Cursor, and links your site. The MCP server exposes read and write tools scoped to your API key: `get_findings`, `list_sessions`, `approve_action`, `dismiss_action`, `get_stats`, and `trigger_patch`.

---

## AI pipeline architecture

```
capture.js (browser)
    │  rage click or JS error detected
    ▼
POST /api/ingest/replay    ← rrweb events → Cloudflare R2
POST /api/ingest/heatmap   ← click density grid → Postgres JSONB
    │
    ▼
Upstash QStash → /api/queue/pipeline
    │
    ▼
_pipeline.ts
    ├── Pre-filter (skip noise sessions)
    ├── Enrichment (CRM ARR/tier context)
    ├── Claude Haiku  → classify all sessions
    ├── Claude Sonnet → re-classify P0/P1 only
    ├── Policy evaluation (autonomy threshold check)
    └── Execute OR queue for approval
            │                    │
            ▼                    ▼
    Composio action      Slack approval card
    (Jira / Linear /     (approve → execute,
     Slack / CRM /        dismiss → no charge)
     UI patch / PR)
```

QStash retries automatically on Anthropic API failures — no findings are lost to transient errors.

---

## Cron jobs

| Schedule | Route | Purpose |
|---|---|---|
| Every 15 min | `/api/cron/ingest` | Poll Datadog RUM / legacy connectors |
| Every hour | `/api/cron/aggregate-heatmaps` | Bin click events into `click_density_grid` JSONB |
| Every hour | `/api/cron/evaluate-patches` | Advance canary patches, auto-rollback on regression |
| Daily | `/api/cron/retention` | Purge sessions beyond plan retention window |

---

## Open-core model

Everything in `src/capture/`, `src/reasoning/`, and `src/execution/` is MIT licensed — self-host, bring your own Anthropic and Composio keys, run the full pipeline locally.

`src/dashboard/lib/billing/` and `src/dashboard/ee/governance/` are source-available. A commercial licence is required for production use of those modules.
