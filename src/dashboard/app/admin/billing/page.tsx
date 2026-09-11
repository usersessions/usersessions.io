import { requireAdmin } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/server'
import { PLANS, type PlanId } from '@/lib/tiers'
import { BillingStatCard, BillingListRow } from '@/components/admin/BillingUI'

// MRR is an estimate from active paid plan rows priced from PLANS; Paystack is
// the billing source of truth. Revenue figures come from real revenue_events
// written by the webhook — nothing here is fabricated.
const PAID_PLANS: PlanId[] = ['starter', 'pro', 'business', 'enterprise']

export default async function AdminBillingPage() {
  await requireAdmin()
  const db = createServiceClient()
  const since30 = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()

  const [{ count: starterCount }, { count: proCount }, { count: businessCount }, { count: enterpriseCount }, { data: events }, { data: paidProfiles }] =
    await Promise.all([
      db.from('profiles').select('*', { count: 'exact', head: true }).eq('plan', 'starter').eq('subscription_status', 'active'),
      db.from('profiles').select('*', { count: 'exact', head: true }).eq('plan', 'pro').eq('subscription_status', 'active'),
      db.from('profiles').select('*', { count: 'exact', head: true }).eq('plan', 'business').eq('subscription_status', 'active'),
      db.from('profiles').select('*', { count: 'exact', head: true }).eq('plan', 'enterprise').eq('subscription_status', 'active'),
      db
        .from('revenue_events')
        .select('user_id, event_type, amount, currency, paystack_reference, created_at')
        .order('created_at', { ascending: false })
        .limit(50),
      db
        .from('profiles')
        .select('id, email, plan, subscription_status, created_at')
        .neq('plan', 'free')
        .order('created_at', { ascending: false })
        .limit(100),
    ])

  const emailById = new Map((paidProfiles ?? []).map((p) => [p.id, p.email]))
  const recent = events ?? []
  const succeeded30 = recent.filter((e) => e.event_type === 'payment_succeeded' && e.created_at >= since30)
  const failed30 = recent.filter((e) => e.event_type === 'payment_failed' && e.created_at >= since30).length
  const cancelled30 = recent.filter((e) => e.event_type === 'subscription_cancelled' && e.created_at >= since30).length
  const revenue30 = succeeded30.reduce((sum, e) => sum + Number(e.amount ?? 0), 0)
  const currencies = [...new Set(succeeded30.map((e) => e.currency).filter(Boolean))]
  const planCounts: Record<PlanId, number> = { free: 0, starter: starterCount ?? 0, pro: proCount ?? 0, business: businessCount ?? 0, enterprise: enterpriseCount ?? 0 }
  const mrr = PAID_PLANS.reduce((sum, p) => sum + planCounts[p] * (PLANS[p].price.monthly / 100), 0)

  // Checkout charges amounts straight from PLANS — no Paystack plan codes needed.
  const envChecks: [string, boolean][] = [
    ['PAYSTACK_SECRET_KEY', Boolean(process.env.PAYSTACK_SECRET_KEY)],
  ]

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      <h1 className="ds-page-title" style={{ margin: 0 }}>Billing</h1>

      {/* Live env check, read at request time. Presence only — values are never shown. */}
      <div className="ds-stat-card" style={{ padding: '24px' }}>
        <p style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 16px' }}>Paystack configuration</p>
        {envChecks.map(([name, set]) => (
          <div key={name} className="flex" style={{ gap: '16px', borderBottom: '1px solid rgba(255,255,255,0.03)', padding: '12px 0' }}>
            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '13px', color: 'var(--text-primary)', flex: 1 }}>{name}</span>
            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', padding: '4px 8px', borderRadius: '12px', background: set ? 'rgba(34,197,94,0.1)' : 'rgba(220,38,38,0.1)', color: set ? 'var(--green)' : 'var(--red)' }}>{set ? 'SET' : 'MISSING'}</span>
          </div>
        ))}
        {envChecks.some(([, set]) => !set) && (
          <p style={{ fontFamily: 'var(--font-sans, sans-serif)', fontSize: '12px', color: 'var(--amber)', marginTop: '16px', background: 'rgba(245,158,11,0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.2)' }}>
            Missing values break checkout for the corresponding plan. Set them in Vercel (Production) and redeploy — env changes do not apply to running deployments.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4" style={{ gap: 'var(--space-md)' }}>
        {[
          { label: 'MRR (est., plan rows)', value: `$${mrr.toLocaleString()}` },
          {
            label: `Revenue, 30d${currencies.length === 1 ? ` (${currencies[0]})` : currencies.length > 1 ? ' (mixed currencies)' : ''}`,
            value: revenue30.toLocaleString(),
          },
          { label: 'Failed payments, 30d', value: failed30 },
          { label: 'Cancellations, 30d', value: cancelled30 },
        ].map((m) => (
          <BillingStatCard key={m.label} label={m.label} value={m.value} />
        ))}
      </div>

      <div className="ds-stat-card" style={{ padding: '24px' }}>
        <p style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 16px' }}>Active subscriptions</p>
        {!paidProfiles || paidProfiles.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-sans, sans-serif)', fontSize: '14px', color: 'var(--muted)' }}>No paid subscriptions yet. They appear the moment the first live checkout completes.</p>
        ) : (
          paidProfiles.map((p) => (
            <BillingListRow key={p.id}>
              <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '13px', color: 'var(--text-primary)', flex: 1, minWidth: 200 }}>{p.email}</span>
              <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '13px', color: 'var(--muted)', textTransform: 'capitalize', width: 120 }}>{p.plan}</span>
              <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', padding: '4px 8px', borderRadius: '12px', background: p.subscription_status === 'active' ? 'rgba(34,197,94,0.1)' : p.subscription_status === 'attention' ? 'rgba(245,158,11,0.1)' : 'rgba(220,38,38,0.1)', color: p.subscription_status === 'active' ? 'var(--green)' : p.subscription_status === 'attention' ? 'var(--amber)' : 'var(--red)', width: 100, textAlign: 'center' }}>
                {p.subscription_status}
              </span>
              <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '12px', color: 'var(--muted)', width: 100, textAlign: 'right' }}>{new Date(p.created_at).toISOString().slice(0, 10)}</span>
            </BillingListRow>
          ))
        )}
      </div>

      <div className="ds-stat-card" style={{ padding: '24px' }}>
        <p style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 16px' }}>Recent revenue events</p>
        {recent.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-sans, sans-serif)', fontSize: '14px', color: 'var(--muted)' }}>
            No revenue events yet — they are written by the Paystack webhook and appear the moment the first transaction lands.
          </p>
        ) : (
          recent.map((e, i) => (
            <BillingListRow key={`${e.paystack_reference ?? 'ev'}-${i}`}>
              <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '12px', color: 'var(--muted)', width: 130 }}>{new Date(e.created_at).toISOString().replace('T', ' ').slice(0, 16)}</span>
              <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '13px', color: 'var(--text-primary)', flex: 1, minWidth: 160 }}>{emailById.get(e.user_id) ?? `${String(e.user_id).slice(0, 8)}…`}</span>
              <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', padding: '4px 8px', borderRadius: '12px', background: e.event_type === 'payment_failed' || e.event_type === 'subscription_cancelled' ? 'rgba(220,38,38,0.1)' : 'rgba(34,197,94,0.1)', color: e.event_type === 'payment_failed' || e.event_type === 'subscription_cancelled' ? 'var(--red)' : 'var(--green)' }}>
                {e.event_type.replaceAll('_', ' ')}
              </span>
              <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '13px', color: 'var(--text-primary)', width: 100, textAlign: 'right' }}>{e.amount != null ? `${Number(e.amount).toLocaleString()} ${e.currency ?? ''}` : '—'}</span>
            </BillingListRow>
          ))
        )}
      </div>
    </div>
  )
}
