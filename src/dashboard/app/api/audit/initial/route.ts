import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runFirstPartyAudit } from '@/services/first-party-audit'

export const dynamic = 'force-dynamic'

/**
 * POST /api/audit/initial
 *
 * Runs the first-party cold-start audit for the caller's own client.
 * The client is resolved from the session; `clientId` in the body is only
 * accepted if it matches. `websiteUrl` is optional — used only as a fallback
 * seed when no capture.js sessions have arrived yet.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { clientId?: unknown; websiteUrl?: unknown } = {}
  try { body = await req.json() } catch { /* empty body is fine */ }

  const { data: client } = await supabase
    .from('us_clients')
    .select('id, website_url')
    .eq('profile_id', user.id)
    .maybeSingle()
  if (!client) return NextResponse.json({ error: 'No workspace for this user' }, { status: 404 })
  if (typeof body.clientId === 'string' && body.clientId !== client.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const websiteUrl =
    (typeof body.websiteUrl === 'string' && body.websiteUrl.trim() ? body.websiteUrl.trim() : null)
    ?? client.website_url
    ?? undefined

  const result = await runFirstPartyAudit({ clientId: client.id, websiteUrl })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({
    success: true,
    findingsCount: result.findingsCount,
    skipped: result.skipped,
    source: result.source,
  })
}
