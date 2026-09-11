import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PLANS, PLAN_ORDER, PAYSTACK_CHECKOUT, getPlanConfig, normalizePlanId, type PlanId } from '@/lib/tiers'
import { PiCreditCardBold, PiCheckBold, PiArrowUpBold, PiArrowDownBold, PiChatCircleBold, PiLightningBold } from 'react-icons/pi'

export const metadata = {
  title: 'Billing & Plan | UserSessions',
}

function formatPrice(cents: number) {
  if (cents === 0) return 'Custom'
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`
}

function formatSessions(n: number) {
  if (!isFinite(n)) return 'Unlimited'
  return n >= 1_000_000 ? `${n / 1_000_000}M` : `${(n / 1000).toFixed(0)}K`
}

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  // Normalize legacy plan IDs (audit → starter, standard → pro)
  const planId: PlanId = normalizePlanId(profile?.plan)
  const planConfig = getPlanConfig(planId)
  const currentIdx = PLAN_ORDER.indexOf(planId)

  if (process.env.NEXT_PUBLIC_DEPLOYMENT_MODE === 'self_hosted') {
    redirect('/')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 48, maxWidth: 900, margin: '0 auto', width: '100%', paddingBottom: 120 }}>
      <div>
        <h1 className="ds-page-title">Billing &amp; Plan</h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '8px 0 0', lineHeight: 1.6 }}>
          Manage your subscription. Upgrade instantly via card, or contact us to downgrade.
        </p>
      </div>

      {/* ── Current Plan Card ── */}
      <section className="ds-stat-card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(252,163,17,0.08)',
              border: '1px solid rgba(252,163,17,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <PiCreditCardBold size={16} color="var(--orange)" />
            </div>
            <h2 className="ds-section-label" style={{ margin: 0 }}>Current plan</h2>
          </div>
          <span className="ds-status ds-status--approved">Active</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
            {planConfig.name}
          </span>
          {planConfig.price.monthly > 0 && (
            <span style={{ fontSize: '15px', color: 'var(--text-secondary)', fontWeight: 500 }}>
              {formatPrice(planConfig.price.monthly)}<span style={{ opacity: 0.6 }}>/mo</span>
            </span>
          )}
          {planId === 'free' && (
            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>No active subscription</span>
          )}
        </div>

        {/* Key limits at a glance */}
        {planId !== 'free' && (
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[
              { label: 'Sessions/mo', value: formatSessions(planConfig.limits.sessionsPerMonth) },
              { label: 'Actions included', value: isFinite(planConfig.limits.actionsIncluded) ? planConfig.limits.actionsIncluded.toLocaleString() : 'Unlimited' },
              { label: 'Sites', value: isFinite(planConfig.limits.sitesIncluded) ? String(planConfig.limits.sitesIncluded) : 'Unlimited' },
              { label: 'Team seats', value: isFinite(planConfig.limits.teamSeats) ? String(planConfig.limits.teamSeats) : 'Unlimited' },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>{label}</span>
                <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>{value}</span>
              </div>
            ))}
          </div>
        )}

        {planConfig.features.length > 0 && (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {planConfig.features.map(f => (
              <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '13px', color: 'var(--text-secondary)' }}>
                <PiCheckBold size={13} color="var(--green)" style={{ flexShrink: 0, marginTop: 2 }} />
                {f}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Plan Cards ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 className="ds-section-label" style={{ margin: '0 0 4px' }}>Switch plan</h2>

        {PLAN_ORDER.filter(id => id !== 'free').map(id => {
          const plan = PLANS[id]
          const planIdx = PLAN_ORDER.indexOf(id)
          const isCurrent = id === planId
          const isUpgrade = planIdx > currentIdx
          const isDowngrade = planIdx < currentIdx
          const isEnterprise = id === 'enterprise'
          const checkoutUrl = PAYSTACK_CHECKOUT[id]

          let actionEl: React.ReactNode = null

          if (isCurrent) {
            actionEl = (
              <span className="ds-status ds-status--approved" style={{ fontSize: '12px', padding: '5px 12px', whiteSpace: 'nowrap' }}>
                Current plan
              </span>
            )
          } else if (isEnterprise) {
            actionEl = (
              <Link
                href="mailto:twalib@usersessions.io?subject=Enterprise%20Plan%20Enquiry"
                className="ds-btn-approve"
                style={{ textDecoration: 'none', padding: '9px 18px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
              >
                <PiChatCircleBold size={13} />
                Contact sales
              </Link>
            )
          } else if (isUpgrade && checkoutUrl) {
            actionEl = (
              <Link
                href={checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ds-btn-approve"
                style={{
                  textDecoration: 'none', padding: '9px 18px', fontSize: '13px',
                  display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
                  background: 'var(--green)', borderColor: 'var(--green)', color: '#fff',
                }}
              >
                <PiArrowUpBold size={13} />
                Upgrade
              </Link>
            )
          } else if (isDowngrade) {
            actionEl = (
              <Link
                href={`mailto:twalib@usersessions.io?subject=Plan%20Downgrade%20Request%20(${encodeURIComponent(plan.name)})`}
                className="ds-btn-dismiss"
                style={{ textDecoration: 'none', padding: '9px 18px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', opacity: 0.8 }}
              >
                <PiArrowDownBold size={13} />
                Downgrade
              </Link>
            )
          } else if (isUpgrade && !checkoutUrl) {
            // Paystack plan code not yet set — fall back to email
            actionEl = (
              <Link
                href={`mailto:twalib@usersessions.io?subject=Upgrade%20to%20${encodeURIComponent(plan.name)}`}
                className="ds-btn-approve"
                style={{ textDecoration: 'none', padding: '9px 18px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
              >
                <PiArrowUpBold size={13} />
                Upgrade
              </Link>
            )
          }

          return (
            <div
              key={id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 16,
                padding: '20px 24px',
                borderRadius: 12,
                border: isCurrent
                  ? '1px solid rgba(16,185,129,0.3)'
                  : '1px solid var(--border)',
                background: isCurrent
                  ? 'rgba(16,185,129,0.04)'
                  : 'var(--surface)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{plan.name}</span>
                  {plan.popular && !isCurrent && (
                    <span style={{
                      fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                      padding: '2px 7px', borderRadius: 4,
                      background: 'rgba(59,130,246,0.1)', color: 'var(--blue)',
                      border: '1px solid rgba(59,130,246,0.2)',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <PiLightningBold size={9} /> Popular
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{plan.tagline}</span>
                {/* Inline limits summary */}
                {!isEnterprise && (
                  <div style={{ display: 'flex', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {formatSessions(plan.limits.sessionsPerMonth)} sessions
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {plan.limits.actionsIncluded.toLocaleString()} actions
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {isFinite(plan.limits.sitesIncluded) ? plan.limits.sitesIncluded : '∞'} sites
                    </span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                    {isEnterprise ? 'Custom' : formatPrice(plan.price.monthly)}
                  </div>
                  {!isEnterprise && plan.price.monthly > 0 && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>/mo</div>
                  )}
                </div>
                {actionEl}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Billing FAQ ── */}
      <section className="ds-stat-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 className="ds-section-label" style={{ margin: 0 }}>The golden rule</h2>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.7 }}>
          Only <strong style={{ color: 'var(--text-primary)' }}>successfully executed actions</strong> are ever billed.
          A dismissed finding, an edited-and-rejected action, or an API failure never appears on your invoice.
          We only get paid when we actually fix friction for your users.
        </p>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
          Questions?{' '}
          <Link href="mailto:twalib@usersessions.io" style={{ color: 'var(--blue)', textDecoration: 'none' }}>
            Email us
          </Link>{' '}
          — we respond within 24 hours.
        </p>
      </section>
    </div>
  )
}
