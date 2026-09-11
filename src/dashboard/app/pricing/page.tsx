import { Metadata } from 'next'
import { CALCULATOR_TIERS } from '@/lib/documents/types'
import { PricingClientWrapper } from './PricingClientWrapper'
import { MarketingNav } from '@/components/MarketingNav'
import { MarketingFooter } from '@/components/MarketingFooter'
import '../home/homepage.css'

export const metadata: Metadata = {
  title: 'Pricing — UserSessions.io',
  description: 'Simple, outcome-driven pricing. Only pay when we fix friction for your users.',
}

export default function PricingPage() {
  return (
    <div className="hp" style={{ minHeight: '100vh', color: 'var(--ink)' }}>
      <div className="premium-bg" />
      <MarketingNav />

      {/* Hero */}
      <div style={{ position: 'relative', zIndex: 10, paddingTop: 140, paddingBottom: 80, textAlign: 'center', padding: '140px 24px 80px' }}>
        <p style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--ember)',
          marginBottom: 20,
        }}>
          Pricing
        </p>
        <h1 style={{
          fontFamily: 'var(--display)',
          fontSize: 'clamp(36px, 5vw, 56px)',
          fontWeight: 700,
          letterSpacing: '-0.03em',
          lineHeight: 1.0,
          color: 'var(--ink)',
          marginBottom: 20,
        }}>
          Simple, outcome-driven pricing.
        </h1>
        <p style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '1.1rem',
          color: 'var(--ink-muted)',
          fontWeight: 500,
          lineHeight: 1.6,
          maxWidth: 520,
          margin: '0 auto 40px',
        }}>
          Starter at $29/mo, Pro at $149/mo, Business at $699/mo. Enterprise is custom.
          Only pay for actions that actually ship.
        </p>

        {/* Trust badges */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 32, flexWrap: 'wrap' }}>
          {['No surprise charges', 'Cancel anytime', 'Only pay for results'].map((badge) => (
            <div key={badge} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--ink-muted)',
            }}>
              <span style={{ color: 'var(--ember)', fontSize: '16px' }}>✓</span>
              {badge}
            </div>
          ))}
        </div>
      </div>

      {/* Pricing cards — sourced directly from billing config */}
      <div style={{ position: 'relative', zIndex: 10, margin: '0 auto 40px' }}>
        <PricingClientWrapper
          tiers={[
            CALCULATOR_TIERS.starter,
            CALCULATOR_TIERS.pro,
            CALCULATOR_TIERS.business,
            CALCULATOR_TIERS.enterprise_license,
          ]}
        />
      </div>

      {/* Golden Rule */}
      <div style={{ position: 'relative', zIndex: 10, maxWidth: 800, margin: '0 auto 80px', padding: '0 24px' }}>
        <div style={{
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          border: '1px solid rgba(0,0,0,0.05)',
          borderBottom: '1px solid rgba(0,0,0,0.09)',
          borderRadius: 24,
          padding: '48px 40px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.9)',
          textAlign: 'center',
        }}>
          <p style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--ember)',
            marginBottom: 16,
          }}>
            Our commitment
          </p>
          <h2 style={{
            fontFamily: 'var(--display)',
            fontSize: 'clamp(22px, 3vw, 30px)',
            fontStyle: 'normal',
            marginBottom: 16,
            color: 'var(--ink)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
          }}>
            The Golden Rule
          </h2>
          <p style={{
            fontSize: '1.05rem',
            color: 'var(--ink-muted)',
            lineHeight: 1.7,
            fontWeight: 500,
            maxWidth: 580,
            margin: '0 auto',
          }}>
            Only successfully executed actions are ever billed. A dismissed finding, an edited-and-rejected action, or an API failure never appears on your invoice.
            <br />
            <span style={{ color: 'var(--ink)', fontWeight: 700 }}>We only get paid when we actually fix friction for your users.</span>
          </p>
        </div>
      </div>

      <MarketingFooter />
    </div>
  )
}
