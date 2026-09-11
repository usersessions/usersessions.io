/**
 * Registry of scheduled jobs. The cron table on /admin renders from this list so every
 * job is visible even before its first run. Schedules mirror the deployment cron config.
 *
 * `path` is the in-app route a manual trigger calls. Jobs owned by an external
 * scheduler (Cloudflare cron triggers) set it to null: they are reported here,
 * but they cannot be fired from the dashboard.
 */
export const CRON_JOBS = [
  // Monthly credit resets happen lazily per-user inside
  // CreditManager.ensureFreshCredits — no scheduler required.

  // Notification escalation sweep — fires email escalation for any finding/action
  // notification that was sent to Slack but has gone unactioned past the configured
  // window (24h for P0/P1, 72h for P2/P3). Runs every 4h so escalations land
  // within a 4h window of the deadline, not after a 24h polling gap.
  {
    name: 'notify:escalation-sweep',
    schedule: '0 */4 * * *',
    description: 'Emails escalation for any finding/action notification unactioned past its Slack window.',
    path: '/api/notify/escalation',
  },
  {
    name: 'documents:mbr',
    schedule: '0 8 1 * *', // 1st of the month at 8am
    description: 'Generates Monthly Business Review PDFs for eligible clients.',
    path: '/api/documents/cron/mbr',
  },
  {
    name: 'notify:renewal-reminder',
    schedule: '0 9 * * *', // Daily check
    description: 'Sends renewal reminders to clients approaching pilot or contract end.',
    path: '/api/notify/renewal-reminder',
  },
  {
    name: 'billing:action-fee-invoice',
    schedule: '0 8 1 * *', // 1st of the month at 8am
    description: 'Generates Paystack invoices for metered action overages from the previous month.',
    path: '/api/billing/action-fee-invoice',
  },
  {
    name: 'billing:dunning-sweep',
    schedule: '0 10 * * *', // Daily at 10am
    description: 'Sweeps the dunning table to retry failed invoices and dispatch escalation emails.',
    path: '/api/billing/dunning',
  },
]

// Minimal 5-field cron matcher — supports numbers and '*' only, which covers every
// schedule above. Extend before introducing ranges/steps.
function matches(expr: string, d: Date): boolean {
  const [m, h, dom, mon, dow] = expr.split(' ')
  const ok = (field: string, value: number) => field === '*' || Number(field) === value
  return (
    ok(m, d.getUTCMinutes()) &&
    ok(h, d.getUTCHours()) &&
    ok(dom, d.getUTCDate()) &&
    ok(mon, d.getUTCMonth() + 1) &&
    ok(dow, d.getUTCDay())
  )
}

/** Next UTC run time for a schedule, scanning forward minute-by-minute (max 8 days). */
export function nextRun(expr: string, from: Date = new Date()): Date | null {
  const d = new Date(from)
  d.setUTCSeconds(0, 0)
  d.setUTCMinutes(d.getUTCMinutes() + 1)
  for (let i = 0; i < 60 * 24 * 8; i++) {
    if (matches(expr, d)) return new Date(d)
    d.setUTCMinutes(d.getUTCMinutes() + 1)
  }
  return null
}
