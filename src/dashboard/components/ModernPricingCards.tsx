'use client'

import { motion } from "motion/react"
import Link from 'next/link'
import { Check } from 'lucide-react'

const TIERS = [
  {
    name: 'Starter',
    price: '$0',
    interval: '/mo',
    description: 'Perfect for side projects and small teams.',
    features: [
      '1,000 sessions/mo',
      'Basic session replays',
      '7-day data retention',
      'Standard support',
    ],
    cta: 'Start for free',
    href: '/login',
    popular: false,
  },
  {
    name: 'Pro',
    price: '$149',
    interval: '/mo',
    description: 'AI-driven friction detection with autonomous remediation.',
    features: [
      '25,000 sessions/mo',
      'Slack & Discord alerts',
      'Autonomous AI remediation',
      'API access',
      '90-day data retention',
      'Priority support',
    ],
    cta: 'Start free trial',
    href: '/login',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    interval: '',
    description: 'For large teams with advanced security needs.',
    features: [
      'Unlimited sessions',
      'Custom data retention',
      'SSO & Audit logs',
      'Dedicated success manager',
      'Custom SLAs',
    ],
    cta: 'Contact sales',
    href: '/contact',
    popular: false,
  }
]

const SPRING = { type: 'spring', bounce: 0, duration: 0.4 } as const

export function ModernPricingCards() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', width: '100%', maxWidth: '1080px', margin: '0 auto' }}>
      {TIERS.map((tier, idx) => (
        <motion.div
          key={tier.name}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: idx * 0.1 }}
          className="glass-panel"
          style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '40px 32px',
            borderRadius: '24px',
            position: 'relative',
            overflow: 'hidden',
            border: tier.popular ? '1px solid var(--ember)' : '1px solid var(--line)',
            boxShadow: tier.popular ? '0 8px 32px rgba(229, 90, 0, 0.08)' : 'none',
          }}
        >
          {tier.popular && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--ember)',
              color: 'white',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              padding: '6px 16px',
              borderBottomLeftRadius: '12px',
              borderBottomRightRadius: '12px',
            }}>
              Most Popular
            </div>
          )}

          <div style={{ marginBottom: '32px', marginTop: tier.popular ? '12px' : '0' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontFamily: 'var(--font-sans)', fontWeight: 600, color: 'var(--ink)' }}>
              {tier.name}
            </h3>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--ink-soft)', lineHeight: 1.5 }}>
              {tier.description}
            </p>
          </div>

          <div style={{ marginBottom: '32px' }}>
            <span style={{ fontSize: '36px', fontFamily: 'var(--display)', fontWeight: 700, color: 'var(--ink)', fontStyle: 'normal', letterSpacing: '-0.02em' }}>
              {tier.price}
            </span>
            {tier.interval && (
              <span style={{ fontSize: '16px', color: 'var(--ink-muted)', fontWeight: 500, marginLeft: '4px' }}>
                {tier.interval}
              </span>
            )}
          </div>

          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 40px 0', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
            {tier.features.map((feature, fIdx) => (
              <li key={fIdx} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '15px', color: 'var(--ink)', fontWeight: 500 }}>
                <Check size={16} strokeWidth={2.5} style={{ color: 'var(--ember)', flexShrink: 0 }} />
                {feature}
              </li>
            ))}
          </ul>

          <motion.div
            whileHover={{ scale: 0.98 }}
            whileTap={{ scale: 0.96 }}
            transition={SPRING}
          >
            <Link 
              href={tier.href}
              className={`btn ${tier.popular ? 'btn--ember' : 'btn--ghost'}`}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {tier.cta}
            </Link>
          </motion.div>
        </motion.div>
      ))}
    </div>
  )
}
