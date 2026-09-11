/**
 * GET /api/findings — Findings feed (Build Spec §10)
 *
 * Returns paginated findings for the authenticated user's client,
 * optionally filtered by status, category, or severity.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Find the user's client
  const { data: client } = await supabase
    .from('us_clients')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!client) return NextResponse.json({ findings: [], total: 0 })

  const sp = req.nextUrl.searchParams
  const status = sp.get('status')             // 'pending' | 'approved' | 'dismissed' | 'executed'
  const category = sp.get('category')         // 'bug' | 'friction' | 'billing' | 'security'
  const severity = sp.get('severity')         // 'P0' | 'P1' | 'P2' | 'P3'
  const limit = Math.min(parseInt(sp.get('limit') ?? '50', 10), 200)
  const offset = parseInt(sp.get('offset') ?? '0', 10)

  let query = supabase
    .from('us_findings')
    .select(
      `id, category, severity, confidence, summary, account_value, status, created_at,
       us_sessions(source, source_session_id, replay_url, error_count, rage_click_count),
       us_actions(id, composio_toolkit, composio_action, status, result, executed_at)`,
      { count: 'exact' },
    )
    .eq('client_id', client.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)
  if (category) query = query.eq('category', category)
  if (severity) query = query.eq('severity', severity)

  const { data: findings, count, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ findings: findings ?? [], total: count ?? 0 })
}
