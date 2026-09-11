'use client'

/**
 * UpgradeModal — full-screen modal triggered when a user clicks a gated feature.
 *
 * Usage:
 *   const [upgradeFor, setUpgradeFor] = useState<string | null>(null)
 *
 *   <button onClick={() => setUpgradeFor('Custom Workflows')}>Connect Salesforce</button>
 *   <UpgradeModal
 *     open={!!upgradeFor}
 *     featureName={upgradeFor ?? ''}
 *     requiredPlan="pro"
 *     currentPlan={profile.plan}
 *     onClose={() => setUpgradeFor(null)}
 *   />
 */

import { useEffect, useCallback } from 'react'
import { PLANS, type PlanId } from '@/lib/tiers'
import { PlanBadge } from './PlanBadge'

// Per-feature contextual benefit copy
const FEATURE_BENEFITS: Record<string, string> = {
  'Custom Workflows':   'Create custom remediation workflows and map them to Salesforce objects directly from UserSessions.',
  
  'Bulk Remediation':          'Execute autonomous remediations across all tracked sites simultaneously.',
  'Saved Workflows':       'Save reusable workflow templates and apply them automatically to matching friction patterns across sites.',
  'Priority Execution':       'Jump the queue. Your actions execute before Starter jobs — critical during peak hours.',
  'Team Seats':               'Invite editors, copywriters, or clients to collaborate inside your workspace.',
  'White-Label':              'Remove all usersessions branding from exports and client-facing deliverables.',
  'Google Calendar Sync':     'Auto-create calendar events for every scheduled post with 15-minute pre-publish reminders.',
}

const PLAN_UNLOCK: Record<'pro' | 'business' | 'enterprise', { name: string; price: string; credits: string; key_unlocks: string[] }> = {
  pro: {
    name: PLANS.pro.name,
    price: `$${PLANS.pro.price.monthly / 100}/mo`,
    credits: 'Metered autonomous actions',
    key_unlocks: PLANS.pro.features.slice(1),
  },
  business: {
    name: PLANS.business.name,
    price: `$${PLANS.business.price.monthly / 100}/mo`,
    credits: '5,000 actions included',
    key_unlocks: PLANS.business.features.slice(1),
  },
  enterprise: {
    name: PLANS.enterprise.name,
    price: 'Custom',
    credits: 'Unlimited actions',
    key_unlocks: PLANS.enterprise.features.slice(1),
  },
}

export interface UpgradeModalProps {
  open: boolean
  onClose: () => void
  featureName: string
  requiredPlan: 'pro' | 'business' | 'enterprise'
  currentPlan?: string | null
}

export function UpgradeModal({
  open,
  onClose,
  featureName,
  requiredPlan,
  currentPlan,
}: UpgradeModalProps) {
  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() },
    [onClose]
  )
  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', handleKeyDown)
    // Prevent background scroll
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, handleKeyDown])

  if (!open) return null

  const unlock = PLAN_UNLOCK[requiredPlan]
  const benefit = FEATURE_BENEFITS[featureName] ?? `${featureName} requires upgrading your plan.`
  const currentPlanId = (currentPlan ?? 'free') as PlanId
  const currentPlanName = PLANS[currentPlanId]?.name ?? 'Free'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'var(--text-secondary)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: '#ffffff',
          border: '1.5px solid var(--border)',
          borderRadius: 20,
          padding: '36px 32px',
          width: '100%',
          maxWidth: 480,
          position: 'relative',
          boxShadow: '0 32px 80px rgba(0,0,0,0.15)',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close upgrade modal"
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--muted, #71717a)',
            fontSize: 20,
            lineHeight: 1,
            padding: 4,
            borderRadius: 6,
          }}
        >
          ✕
        </button>

        {/* Lock icon + current → required plan */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <span style={{ fontSize: 28 }}>🔒</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PlanBadge plan={currentPlanId} size="sm" />
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>→</span>
            <PlanBadge plan={requiredPlan} size="sm" />
          </div>
        </div>

        {/* Title */}
        <h2
          id="upgrade-modal-title"
          style={{
            fontWeight: 700,
            fontSize: '1.35rem',
            color: 'var(--paper, #fafafa)',
            marginBottom: 10,
            letterSpacing: '-0.02em',
          }}
        >
          Unlock {featureName}
        </h2>

        {/* Benefit copy */}
        <p
          style={{
            fontSize: '0.9rem',
            color: 'var(--muted, #a1a1aa)',
            lineHeight: 1.6,
            marginBottom: 24,
          }}
        >
          {benefit}
        </p>

        {/* Plan unlock card */}
        <div
          style={{
            background: 'var(--bg-canvas)',
            border: '1px solid var(--border-dark, var(--glass-border))',
            borderRadius: 12,
            padding: '18px 20px',
            marginBottom: 24,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                {unlock.name} Plan
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {unlock.credits}/month included
              </div>
            </div>
            <div style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-primary)' }}>
              {unlock.price}
            </div>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {unlock.key_unlocks.map((item) => (
              <li
                key={item}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  fontSize: '0.82rem',
                  color: 'var(--muted, #a1a1aa)',
                }}
              >
                <span style={{ color: 'var(--green, #34d399)', flexShrink: 0, marginTop: 1 }}>✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <a
            href="mailto:hello@usersessions.io"
            style={{
              display: 'block',
              textAlign: 'center',
              padding: '13px 20px',
              borderRadius: 10,
              background: 'var(--orange)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.92rem',
              textDecoration: 'none',
              letterSpacing: '-0.01em',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Upgrade to {unlock.name} →
          </a>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-dark, var(--glass-border-heavy))',
              borderRadius: 10,
              padding: '11px 20px',
              color: 'var(--muted, #71717a)',
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--text-muted)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-dark, var(--glass-border-heavy))')}
          >
            Maybe later
          </button>
        </div>

        {/* Current plan note */}
        <p
          style={{
            marginTop: 16,
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}
        >
          You're currently on the <strong style={{ color: 'var(--text-secondary)' }}>{currentPlanName}</strong> plan.
        </p>
      </div>
    </div>
  )
}
