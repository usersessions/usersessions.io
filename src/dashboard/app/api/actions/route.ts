/**
 * GET /api/actions — Action audit log (Build Spec §10)
 *
 * Returns paginated actions for the authenticated user's client.
 * This is also the billing source of truth display.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: client } = await supabase
    .from('us_clients')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!client) return NextResponse.json({ actions: [], total: 0 })

  const sp = req.nextUrl.searchParams
  const status = sp.get('status')
  const limit = Math.min(parseInt(sp.get('limit') ?? '50', 10), 200)
  const offset = parseInt(sp.get('offset') ?? '0', 10)

  let query = supabase
    .from('us_actions')
    .select(
      `id, composio_toolkit, composio_action, autonomy_level, status, result,
       approved_by, reversible, executed_at, created_at, matched_rule_id,
       us_policy_rules(name),
       us_findings(id, category, severity, summary, confidence)`,
      { count: 'exact' },
    )
    .eq('client_id', client.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)

  const { data: actions, count, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ actions: actions ?? [], total: count ?? 0 })
}
