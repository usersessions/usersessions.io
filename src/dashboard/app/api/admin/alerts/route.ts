import { NextResponse } from 'next/server'
import { audit } from '@/lib/admin'
import { requireAdminApi } from '@/lib/admin-api'
import { AUTO_DISMISS_MS, type AlertSeverity } from '@/lib/alerts'
import { createServiceClient } from '@/lib/supabase/server'

// Force dynamic: Supabase URL is a runtime env var on Cloudflare, not a build var.
export const dynamic = 'force-dynamic'


// Undismissed alerts, with auto-dismiss windows applied at read time.
export async function GET() {
  const user = await requireAdminApi()
  if (!user) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const db = createServiceClient()
  const { data } = await db
    .from('admin_notifications')
    .select('id, kind, severity, title, body, metadata, created_at')
    .eq('dismissed', false)
    .order('created_at', { ascending: false })
    .limit(50)

  const now = Date.now()
  const alerts = (data ?? []).filter((a) => {
    const window = AUTO_DISMISS_MS[a.severity as AlertSeverity]
    if (window === null || window === undefined) return true
    return now - new Date(a.created_at).getTime() < window
  })
  return NextResponse.json({ alerts })
}

// Dismiss one alert (audit-logged).
export async function PATCH(request: Request) {
  const user = await requireAdminApi()
  if (!user) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const { id } = (await request.json().catch(() => ({}))) as { id?: string }
  if (!id) return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 })

  const db = createServiceClient()
  await db.from('admin_notifications').update({ dismissed: true, read: true }).eq('id', id)
  await audit(user.id, 'alert_dismissed', null, { alert_id: id })
  return NextResponse.json({ ok: true })
}
