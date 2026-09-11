'use client'

import { useState } from 'react'
import { type CalculatorTier } from '@/lib/documents/types'
import Link from 'next/link'
import { Check, Minus } from 'lucide-react'

const YEARLY_DISCOUNT = 0.20

type FeatureValue = string | boolean | null

interface FeatureRow {
  label: string
  starter: FeatureValue
  pro: FeatureValue
  business: FeatureValue
  enterprise: FeatureValue
}

const FEATURES: FeatureRow[] = [
  { label: 'Session replay',              starter: true,           pro: true,             business: true,          enterprise: true },
  { label: 'Heatmaps & click maps',       starter: true,           pro: true,             business: true,          enterprise: true },
  { label: 'AI classification',           starter: true,           pro: true,             business: true,          enterprise: true },
  { label: 'App integrations',       starter: true,           pro: true,             business: true,          enterprise: true },
  { label: 'Sites',                       starter: '1',            pro: '5',              business: '15',          enterprise: 'Unlimited' },
  { label: 'Team seats',                  starter: '1',            pro: '5',              business: '10',          enterprise: 'Unlimited' },
  { label: 'MCP server access',           starter: 'Read-only',    pro: 'Read + write',   business: 'Read + write', enterprise: 'Read + write' },
  { label: 'Live UI patching',            starter: null,           pro: 'Canary only',    business: 'Full',         enterprise: 'Full' },
  { label: 'SSO / RBAC / audit export',  starter: null,           pro: null,             business: null,           enterprise: true },
  { label: 'Support',                     starter: 'Community',    pro: 'Email',          business: 'Priority',     enterprise: 'Dedicated' },
]

function FeatureCell({ value }: { value: FeatureValue }) {
  if (value === true) return <Check className="w-4 h-4 text-[var(--ember)] mx-auto" />
  if (value === null || value === false) return <Minus className="w-4 h-4 text-[var(--ink-muted)] mx-auto opacity-40" />
  return <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)' }}>{value}</span>
}

function PricingCard({ tier, isYearly, highlight }: { tier: CalculatorTier; isYearly: boolean; highlight?: boolean }) {
  const monthlyBase = tier.base
  const yearlyMonthly = Math.round(monthlyBase * (1 - YEARLY_DISCOUNT))
  const displayPrice = isYearly ? yearlyMonthly : monthlyBase
  const isEnterprise = tier.id === 'enterprise_license' || tier.id === 'enterprise_managed'

  const tierKey = tier.id === 'starter' ? 'starter'
    : tier.id === 'pro' ? 'pro'
    : tier.id === 'business' ? 'business'
    : 'enterprise'

  const featureValues = FEATURES.map(f => ({
    label: f.label,
    value: f[tierKey as keyof FeatureRow] as FeatureValue,
  }))

  return (
    <div
      className="glass-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '32px 28px',
        flex: 1,
        minWidth: 240,
        maxWidth: 300,
        position: 'relative',
        background: highlight ? 'linear-gradient(160deg, var(--ember-glow) 0%, white 100%)' : undefined,
        borderColor: highlight ? 'var(--ember)' : undefined,
        boxShadow: highlight ? '0 8px 40px rgba(232,90,43,0.12)' : undefined,
      }}
    >
      {highlight && (
        <div style={{
          position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--ember)', color: 'white', fontSize: 11, fontWeight: 800,
          letterSpacing: '0.06em', padding: '4px 14px', borderRadius: 20,
          textTransform: 'uppercase',
        }}>
          Most popular
        </div>
      )}

      {/* Tier name */}
      <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
        {tier.label}
      </h3>

      {/* Price */}
      <div style={{ marginTop: 20, marginBottom: 4, display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 40, fontFamily: 'var(--display)', fontWeight: 700, lineHeight: 1, color: 'var(--ink)' }}>
          {isEnterprise ? 'Custom' : `$${displayPrice.toLocaleString()}`}
        </span>
        {!isEnterprise && <span style={{ fontSize: 15, color: 'var(--ink-muted)' }}>/mo</span>}
      </div>

      <div style={{ fontSize: 13, color: 'var(--ink-soft)', minHeight: 18, marginBottom: 8 }}>
        {!isEnterprise && isYearly && `Billed annually at $${(yearlyMonthly * 12).toLocaleString()}`}
        {isEnterprise && tier.id === 'enterprise_license' && 'Billed at $30,000/year'}
        {isEnterprise && tier.id === 'enterprise_managed' && '$12,000–$15,000+/mo'}
      </div>

      {/* Sessions / Actions summary */}
      {!isEnterprise && (
        <div style={{ marginBottom: 20, padding: '12px 14px', background: 'rgba(0,0,0,0.03)', borderRadius: 12, fontSize: 13, color: 'var(--ink-soft)', fontWeight: 500, lineHeight: 1.7 }}>
          <div><strong style={{ color: 'var(--ink)' }}>{tier.sessionsIncluded.toLocaleString()}</strong> sessions/mo</div>
          <div><strong style={{ color: 'var(--ink)' }}>{tier.actionsIncluded.toLocaleString()}</strong> actions included</div>
          {tier.overage > 0 && <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 2 }}>+${tier.overage.toFixed(2)}/action overage</div>}
        </div>
      )}

      {/* Feature list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, marginBottom: 28 }}>
        {featureValues.map(({ label, value }) => (
          value !== null && (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 500, color: 'var(--ink-soft)' }}>
              <div style={{ width: 20, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                {value === true
                  ? <Check className="w-4 h-4 text-[var(--ember)]" />
                  : <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ember)', display: 'block', margin: '0 auto' }} />
                }
              </div>
              <span>
                {value === true ? label : <>{label}: <strong style={{ color: 'var(--ink)' }}>{value}</strong></>}
              </span>
            </div>
          )
        ))}
      </div>

      {/* CTA */}
      <Link
        href={isEnterprise ? '/contact' : '/login'}
        className={highlight ? 'btn btn--ember btn-spring' : isEnterprise ? 'btn btn--outline btn-spring' : 'btn btn-spring'}
        style={{
          display: 'block',
          textAlign: 'center',
          width: '100%',
          padding: '14px 20px',
          borderRadius: 14,
          fontSize: 15,
          fontWeight: 700,
          border: !highlight && !isEnterprise ? '1.5px solid var(--line)' : undefined,
          color: !highlight && !isEnterprise ? 'var(--ink)' : undefined,
          background: !highlight && !isEnterprise ? 'white' : undefined,
        }}
      >
        {isEnterprise ? 'Contact Sales' : 'Start free trial →'}
      </Link>
    </div>
  )
}

function EnterpriseBanner() {
  return (
    <div className="glass-panel" style={{
      marginTop: 24,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '40px 48px',
      background: 'var(--ember-glow)',
      borderColor: 'var(--ember)',
      width: '100%',
      maxWidth: 900,
      margin: '32px auto 0',
      flexWrap: 'wrap',
      gap: 32,
      borderRadius: 24,
    }}>
      <div style={{ flex: '1 1 400px' }}>
        <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--ember)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 12 }}>
          Enterprise
          <span style={{ fontSize: 11, background: 'var(--ember)', color: 'white', padding: '4px 10px', borderRadius: 20, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Custom</span>
        </h3>
        <p style={{ marginTop: 10, marginBottom: 0, fontSize: 15, color: 'var(--ink-muted)', lineHeight: 1.65, fontWeight: 500, maxWidth: 480 }}>
          Mission-critical session analysis at scale. Take the self-hosted license at{' '}
          <strong style={{ color: 'var(--ink)' }}>$30,000/year</strong> (unlimited sessions, unlimited automated actions),
          or opt for fully managed infrastructure starting at{' '}
          <strong style={{ color: 'var(--ink)' }}>$12,000/mo</strong>.
        </p>
        <ul style={{ marginTop: 16, marginBottom: 0, padding: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: '10px 24px', fontSize: 13, color: 'var(--ink-soft)', fontWeight: 600 }}>
          {[
            'Unlimited sessions & sites',
            'Unlimited team seats',
            'SSO / RBAC / audit export',
            'Full live UI patching',
            'MCP read + write',
            'Dedicated Slack support',
          ].map(f => (
            <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Check className="w-4 h-4 text-[var(--ember)]" style={{ flexShrink: 0 }} /> {f}
            </li>
          ))}
        </ul>
      </div>
      <div style={{ flexShrink: 0 }}>
        <Link href="/contact" className="btn btn--outline btn-spring" style={{
          padding: '16px 32px',
          borderRadius: 16,
          fontSize: 15,
          fontWeight: 700,
          background: 'white',
          borderColor: 'var(--ember)',
          color: 'var(--ember)',
        }}>
          Contact Sales
        </Link>
      </div>
    </div>
  )
}

export function PricingClientWrapper({ tiers }: { tiers: CalculatorTier[] }) {
  const [isYearly, setIsYearly] = useState(false)

  const selfServeTiers = tiers.filter(t => t.id !== 'enterprise_license' && t.id !== 'enterprise_managed')

  return (
    <>
      {/* Monthly / Yearly toggle */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 48, zIndex: 10, position: 'relative' }}>
        <div style={{ display: 'flex', background: 'white', border: '1px solid var(--line)', borderRadius: 100, padding: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <button
            onClick={() => setIsYearly(false)}
            style={{
              padding: '8px 24px', borderRadius: 100, border: 'none',
              background: isYearly ? 'transparent' : 'var(--bg-raised)',
              color: isYearly ? 'var(--ink-muted)' : 'var(--ink)',
              fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
              boxShadow: isYearly ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            Monthly
          </button>
          <button
            onClick={() => setIsYearly(true)}
            style={{
              padding: '8px 24px', borderRadius: 100, border: 'none',
              background: isYearly ? 'var(--bg-raised)' : 'transparent',
              color: isYearly ? 'var(--ink)' : 'var(--ink-muted)',
              fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: isYearly ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            Yearly
            <span style={{ background: 'var(--ember-glow)', color: 'var(--ember)', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 800, letterSpacing: '0.04em' }}>Save 20%</span>
          </button>
        </div>
      </div>

      {/* 3-column self-serve cards */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 1040, margin: '0 auto' }}>
        {selfServeTiers.map((tier) => (
          <PricingCard
            key={tier.id}
            tier={tier}
            isYearly={isYearly}
            highlight={tier.id === 'pro'}
          />
        ))}
      </div>

      {/* Enterprise banner below grid */}
      {tiers.some(t => t.id === 'enterprise_license') && <EnterpriseBanner />}
    </>
  )
}
