import { NextResponse } from 'next/server'
import { audit } from '@/lib/admin'
import { requireAdminApi } from '@/lib/admin-api'
import { CRON_JOBS } from '@/lib/cron-jobs'

export const maxDuration = 60

// Manual cron trigger: admin-gated, audit-logged, then calls the real cron endpoint
// with the CRON_SECRET bearer token (same fail-closed auth the scheduler uses).
export async function POST(request: Request) {
  const user = await requireAdminApi()
  if (!user) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const { job } = (await request.json().catch(() => ({}))) as { job?: string }
  const def = CRON_JOBS.find((j) => j.name === job)
  if (!def) return NextResponse.json({ error: 'UNKNOWN_JOB' }, { status: 400 })
  // Externally scheduled jobs (Cloudflare cron triggers) have no in-app route.
  if (!def.path) return NextResponse.json({ error: 'NOT_TRIGGERABLE' }, { status: 400 })

  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET_NOT_CONFIGURED' }, { status: 503 })

  await audit(user.id, 'cron_manual_trigger', null, { job: def.name })

  const origin = new URL(request.url).origin
  const res = await fetch(`${origin}${def.path}`, { headers: { authorization: `Bearer ${secret}` } })
  const body = await res.json().catch(() => null)
  return NextResponse.json({ ok: res.ok, status: res.status, result: body })
}
