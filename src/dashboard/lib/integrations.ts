import { createServiceClient } from './supabase/server'

/**
 * Outbound webhook fan-out (Slack / Discord). Fire-and-forget: a webhook
 * failure must never fail the caller (same rule as score recompute in
 * POST /api/campaigns). Called from crons and server actions.
 */
export async function sendUserWebhook(userId: string, title: string, body: string): Promise<void> {
  const db = createServiceClient()
  const { data: rows } = await db.from('integrations').select('kind, webhook_url').eq('user_id', userId)

  for (const row of rows ?? []) {
    const payload =
      row.kind === 'slack' ? { text: `*${title}*\n${body}` } : { content: `**${title}**\n${body}` }
    try {
      await fetch(row.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      })
    } catch {
      // fire-and-forget — alert delivery is best-effort
    }
  }
}
