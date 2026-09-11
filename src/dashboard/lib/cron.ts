import { createServiceClient } from './supabase/server'
import { constantTimeEqual, getStrongSecret } from './secrets'

/**
 * Cron auth. Accepts either header:
 *   Authorization: Bearer <CRON_SECRET>
 *   x-cron-secret: <CRON_SECRET>
 *
 * FAIL CLOSED: a missing or placeholder CRON_SECRET means no cron runs.
 * Query-string secrets are deliberately NOT accepted (they end up in access logs).
 */
export function authorizeCron(request: Request): boolean {
  const secret = getStrongSecret('CRON_SECRET')
  if (!secret) return false

  const auth = request.headers.get('authorization') ?? ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  const header = request.headers.get('x-cron-secret')?.trim() ?? ''

  if (bearer && constantTimeEqual(bearer, secret)) return true
  if (header && constantTimeEqual(header, secret)) return true
  return false
}

/** Every cron writes its outcome here; /admin/system (M12) reads last-run status from it. */
export async function logCron(jobName: string, status: 'ok' | 'failed', detail?: unknown): Promise<void> {
  try {
    const db = createServiceClient()
    await db.from('cron_logs').insert({ job_name: jobName, status, detail: detail ?? null })
  } catch (err) {
    console.error('[cron] failed to log run:', err)
  }
}
