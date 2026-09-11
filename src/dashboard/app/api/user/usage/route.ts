import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPlanConfig, normalizePlanId } from '@/lib/tiers'

export const dynamic = 'force-dynamic'

/**
 * GET /api/user/usage
 * Current-month usage for the signed-in user's client against their plan limits.
 * (Replaces the legacy creditManager path that read video columns from another product.)
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: client } = await supabase
      .from('us_clients')
      .select('id, plan_tier')
      .eq('profile_id', user.id)
      .maybeSingle()

    const planId = normalizePlanId(client?.plan_tier)
    const plan = getPlanConfig(planId)
    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const resetDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))

    let sessionsUsed = 0
    let actionsUsed = 0

    if (client) {
      const [sessions, actions] = await Promise.all([
        supabase.from('us_sessions').select('*', { count: 'exact', head: true })
          .eq('client_id', client.id).gte('ingested_at', monthStart.toISOString()),
        supabase.from('us_actions').select('*', { count: 'exact', head: true })
          .eq('client_id', client.id).eq('status', 'executed').eq('result', 'success')
          .gte('executed_at', monthStart.toISOString()),
      ])
      sessionsUsed = sessions.count ?? 0
      actionsUsed = actions.count ?? 0
    }

    const actionsIncluded = plan.limits.actionsIncluded
    const sessionsLimit = plan.limits.sessionsPerMonth
    const overageActions = Number.isFinite(actionsIncluded) ? Math.max(0, actionsUsed - actionsIncluded) : 0

    return NextResponse.json({
      plan: planId,
      planName: plan.name,
      sessionsUsed,
      sessionsLimit: Number.isFinite(sessionsLimit) ? sessionsLimit : null,
      sessionsPercentUsed: Number.isFinite(sessionsLimit) && sessionsLimit > 0 ? Math.min(100, Math.round((sessionsUsed / sessionsLimit) * 100)) : 0,
      actionsUsed,
      actionsIncluded: Number.isFinite(actionsIncluded) ? actionsIncluded : null,
      actionsRemaining: Number.isFinite(actionsIncluded) ? Math.max(0, actionsIncluded - actionsUsed) : null,
      actionsPercentUsed: Number.isFinite(actionsIncluded) && actionsIncluded > 0 ? Math.min(100, Math.round((actionsUsed / actionsIncluded) * 100)) : 0,
      overageActions,
      overageCostCents: overageActions * plan.limits.overagePerAction,
      periodStart: monthStart.toISOString(),
      resetDate: resetDate.toISOString(),
    })
  } catch (error: any) {
    console.error('[user/usage] error:', error?.message ?? error)
    return NextResponse.json({ error: 'Failed to load usage' }, { status: 500 })
  }
}
