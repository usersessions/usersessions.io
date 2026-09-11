import { Suspense } from 'react'
import { requireAdmin } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/server'
import FreshnessTimestamp from '@/components/admin/FreshnessTimestamp'
import MetricCard, { type Metric } from '@/components/admin/MetricCard'
import RealtimeIndicator from '@/components/admin/RealtimeIndicator'
import RefreshButton from '@/components/admin/RefreshButton'
import SkeletonMetricCard from '@/components/admin/SkeletonMetricCard'
import SkeletonTable from '@/components/admin/SkeletonTable'
import TimeRangeToggle from '@/components/admin/TimeRangeToggle'
import AdminAlertFeed from '@/components/admin/AdminAlertFeed'
import QuickActionsBar from '@/components/admin/QuickActionsBar'
import AdminInsights from '@/components/admin/sections/AdminInsights'
import CronSection from '@/components/admin/sections/CronSection'
import SystemHealthSection from '@/components/admin/sections/SystemHealthSection'

import { PLANS, type PlanId } from '@/lib/tiers'

// MRR here is an estimate computed from active paid plan rows using the current
// plan list prices — annual subscribers are counted at monthly list price.
// Paystack is the billing source of truth; this view is directional.
const PAID_PLANS: PlanId[] = ['starter', 'pro', 'business', 'enterprise']

const RANGES = { '24h': 864e5, '7d': 7 * 864e5, '30d': 30 * 864e5, '90d': 90 * 864e5 } as const
type Range = keyof typeof RANGES

function deltaPct(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return ((current - previous) / previous) * 100
}

export default async function AdminSystemPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdmin()
  const db = createServiceClient()

  const sp = (await searchParams) ?? {}
  const rawRange = Array.isArray(sp.range) ? sp.range[0] : sp.range
  const range: Range = rawRange && rawRange in RANGES ? (rawRange as Range) : '7d'
  const rangeMs = RANGES[range]

  const now = new Date()
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const yesterdayStart = new Date(todayStart.getTime() - 864e5)
  const rangeStart = new Date(Date.now() - rangeMs)
  const prevRangeStart = new Date(Date.now() - 2 * rangeMs)

  const [
    { count: userCount },
    { count: starterCount },
    { count: proCount },
    { count: businessCount },
    { count: enterpriseCount },
    { count: signupsToday },
    { count: signupsYesterday },
    { count: signupsRange },
    { count: signupsPrevRange },
    { data: rangeProfiles },
  ] = await Promise.all([
    db.from('profiles').select('*', { count: 'exact', head: true }),
    db.from('profiles').select('*', { count: 'exact', head: true }).eq('plan', 'starter').eq('subscription_status', 'active'),
    db.from('profiles').select('*', { count: 'exact', head: true }).eq('plan', 'pro').eq('subscription_status', 'active'),
    db.from('profiles').select('*', { count: 'exact', head: true }).eq('plan', 'business').eq('subscription_status', 'active'),
    db.from('profiles').select('*', { count: 'exact', head: true }).eq('plan', 'enterprise').eq('subscription_status', 'active'),
    db.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
    db.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', yesterdayStart.toISOString()).lt('created_at', todayStart.toISOString()),
    db.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', rangeStart.toISOString()),
    db.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', prevRangeStart.toISOString()).lt('created_at', rangeStart.toISOString()),
    db.from('profiles').select('created_at').gte('created_at', rangeStart.toISOString()).limit(5000),
  ])

  const planCounts: Record<PlanId, number> = { free: 0, starter: starterCount ?? 0, pro: proCount ?? 0, business: businessCount ?? 0, enterprise: enterpriseCount ?? 0 }
  const paid = PAID_PLANS.reduce((sum, p) => sum + planCounts[p], 0)
  const mrr = PAID_PLANS.reduce((sum, p) => sum + planCounts[p] * (PLANS[p].price.monthly / 100), 0)
  const conversion = userCount ? Math.round((paid / userCount) * 1000) / 10 : 0

  // 7-point signup sparkline across the selected range.
  const spark = new Array<number>(7).fill(0)
  const bucketMs = rangeMs / 7
  for (const row of rangeProfiles ?? []) {
    const idx = Math.min(6, Math.floor((new Date(row.created_at).getTime() - rangeStart.getTime()) / bucketMs))
    if (idx >= 0) spark[idx] += 1
  }

  const usersPrev = (userCount ?? 0) - (signupsRange ?? 0)

  // Deltas needing plan/revenue history stay null (grey dash) until revenue_events accrues data.
  const metrics: Metric[] = [
    { label: 'MRR', value: `$${mrr.toLocaleString()}`, sub: 'Estimated from active plan rows', delta: null, period: range },
    { label: 'Paid subscribers', value: paid, delta: null, period: range },
    { label: 'Free → paid', value: `${conversion}%`, delta: null, period: range },
    { label: 'Signups today', value: signupsToday ?? 0, delta: deltaPct(signupsToday ?? 0, signupsYesterday ?? 0), period: 'day' },
    { label: `Signups, ${range}`, value: signupsRange ?? 0, delta: deltaPct(signupsRange ?? 0, signupsPrevRange ?? 0), period: range, spark },
    { label: 'Users', value: userCount ?? 0, delta: deltaPct(userCount ?? 0, usersPrev), period: range },
  ]

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
    <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
        <h1 className="ds-page-title" style={{ margin: 0 }}>System</h1>
        <div className="flex" style={{ alignItems: 'center', gap: 'var(--space-md)' }}>
          <TimeRangeToggle />
          <RealtimeIndicator />
          <RefreshButton />
        </div>
      </div>
      <FreshnessTimestamp generatedAt={new Date().toISOString()} />

      <AdminAlertFeed />
      <QuickActionsBar />

      <Suspense fallback={null}>
        <AdminInsights />
      </Suspense>

      <Suspense
        fallback={
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4" style={{ gap: 'var(--space-md)' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonMetricCard key={i} />
            ))}
          </div>
        }
      >
        <SystemHealthSection />
      </Suspense>

      <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 'var(--space-md)' }}>
        {metrics.map((m) => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>

      <Suspense fallback={<SkeletonTable rows={5} />}>
        <CronSection />
      </Suspense>
    </div>
  )
}
