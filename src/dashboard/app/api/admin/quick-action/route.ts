import { NextResponse } from 'next/server'
import { audit } from '@/lib/admin'
import { requireAdminApi } from '@/lib/admin-api'

const ALLOWED = new Set([
  'impersonate_open',
  'impersonate_view',
  'flags_open',
  'adapter_check',
  'export_open',
  'export_download',
  'refresh_all',
  'security_check',
])

// Audit sink for client-side quick actions — every action leaves a trail.
export async function POST(request: Request) {
  const user = await requireAdminApi()
  if (!user) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const { action, detail } = (await request.json().catch(() => ({}))) as { action?: string; detail?: unknown }
  if (!action || !ALLOWED.has(action)) return NextResponse.json({ error: 'UNKNOWN_ACTION' }, { status: 400 })

  await audit(user.id, `quick_action:${action}`, null, detail ?? null)
  return NextResponse.json({ ok: true })
}
