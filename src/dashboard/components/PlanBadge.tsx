'use client'

/**
 * PlanBadge — small styled label showing the user's current subscription tier.
 *
 * Colors:
 *   free    → zinc/muted
 *   starter → amber
 *   pro     → violet/indigo
 *   agency  → emerald
 */

import type { PlanId } from '@/lib/tiers'

const BADGE_STYLES: Record<PlanId, { bg: string; color: string; border: string }> = {
  free: {
    bg: 'rgba(113,113,122,0.1)',
    color: '#a1a1aa',
    border: '1px solid rgba(113,113,122,0.25)',
  },
  starter: {
    bg: 'rgba(251,191,36,0.12)',
    color: '#f59e0b',
    border: '1px solid rgba(251,191,36,0.3)',
  },
  pro: {
    bg: 'rgba(139,92,246,0.12)',
    color: '#a78bfa',
    border: '1px solid rgba(139,92,246,0.3)',
  },
  business: {
    bg: 'rgba(59,130,246,0.12)',
    color: '#60a5fa',
    border: '1px solid rgba(59,130,246,0.3)',
  },
  enterprise: {
    bg: 'rgba(16,185,129,0.12)',
    color: '#34d399',
    border: '1px solid rgba(16,185,129,0.3)',
  },
}

export function PlanBadge({
  plan,
  size = 'sm',
}: {
  plan: string | null | undefined
  size?: 'xs' | 'sm' | 'md'
}) {
  const planId = (plan as PlanId) ?? 'free'
  const styles = BADGE_STYLES[planId] ?? BADGE_STYLES.free
  const label = planId.toUpperCase()

  const fontSize = size === 'xs' ? '9px' : size === 'sm' ? '10px' : '11px'
  const padding  = size === 'xs' ? '1px 5px' : size === 'sm' ? '2px 7px' : '3px 9px'

  return (
    <span
      style={{
        display: 'inline-block',
        fontFamily: 'var(--font-mono, monospace)',
        fontSize,
        fontWeight: 700,
        letterSpacing: '0.1em',
        padding,
        borderRadius: 4,
        background: styles.bg,
        color: styles.color,
        border: styles.border,
        userSelect: 'none',
        lineHeight: 1.4,
      }}
      aria-label={`Current plan: ${planId}`}
    >
      {label}
    </span>
  )
}
