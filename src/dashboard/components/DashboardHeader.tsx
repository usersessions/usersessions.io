'use client'

import { motion, useReducedMotion } from "motion/react"
import Link from 'next/link'
import { SiteSwitcher } from '@/components/SiteSwitcher'
import { FeedbackButton } from '@/components/FeedbackButton'

interface DashboardHeaderProps {
  pendingCount: number
  executingCount: number
  totalArr: number
  clientId: string | null
  clientDomain: string | null
  scriptInstalled: boolean
  userEmail?: string
}

const SPRING_UI = { type: 'spring', bounce: 0, duration: 0.35 } as const

export function DashboardHeader({
  pendingCount,
  executingCount,
  totalArr,
  clientId,
  clientDomain,
  scriptInstalled,
  userEmail,
}: DashboardHeaderProps) {
  const shouldReduceMotion = useReducedMotion()

  const containerVariants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.06, delayChildren: 0.05 },
    },
  }

  const itemVariants = {
    hidden: shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 },
    visible: { opacity: 1, y: 0, transition: { ...SPRING_UI, duration: 0.4 } },
  }

  const formatArr = (num: number) => {
    if (num >= 1_000_000) return `\$${(num / 1_000_000).toFixed(1)}M`
    if (num >= 1_000) return `\$${(num / 1_000).toFixed(0)}K`
    return `\$${num}`
  }

  return (
    <motion.header
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        // Right padding accommodates the AvatarMenu overlay from layout.tsx
        padding: '0 180px 0 24px',
        height: 54,
        background: 'var(--header-bg-light, rgba(240,240,238,0.88))',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--header-border-light, rgba(0,0,0,0.07))',
      }}
      aria-label="Dashboard header"
    >
      {/* ── Left: Wordmark + Site Switcher + Live Status ── */}
      <motion.div variants={itemVariants} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link
          href="/"
          style={{
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'baseline',
            fontFamily: 'system-ui, sans-serif',
            letterSpacing: '-0.03em',
            fontSize: '15px',
          }}
          aria-label="UserSessions Home"
        >
          <span style={{ fontWeight: 800, color: '#000000' }}>User</span>
          <span style={{ fontWeight: 600, color: 'rgba(0,0,0,0.35)' }}>Sessions</span>
        </Link>

        {/* Divider */}
        <div style={{ width: 1, height: 16, background: 'rgba(0,0,0,0.1)', borderRadius: 1 }} />

        {/* Site switcher */}
        <SiteSwitcher
          sites={
            clientId && clientDomain
              ? [{ id: clientId, domain: clientDomain, isActive: true, scriptInstalled }]
              : []
          }
        />

        {/* Live pulse indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(16,185,129,0.07)',
          padding: '2px 8px', borderRadius: 99,
          border: '1px solid rgba(16,185,129,0.15)',
        }}>
          <motion.div
            animate={{ opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#10B981',
              boxShadow: '0 0 6px rgba(16,185,129,0.6)',
            }}
          />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '9px', fontWeight: 600,
            color: '#059669',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            Live
          </span>
        </div>
      </motion.div>

      {/* ── Center: Feedback ── */}
      <motion.div variants={itemVariants} style={{ display: 'flex', alignItems: 'center' }}>
        <FeedbackButton userEmail={userEmail} />
      </motion.div>

      {/* ── Right: ⌘K shortcut (avatar is overlaid by layout.tsx) ── */}
      <motion.div variants={itemVariants} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '4px 10px', borderRadius: 6,
            background: 'rgba(0,0,0,0.04)',
            border: '1px solid rgba(0,0,0,0.09)',
            cursor: 'pointer',
          }}
        >
          <kbd style={{
            fontFamily: 'var(--font-mono)', fontSize: '9px',
            color: 'rgba(0,0,0,0.45)',
            border: '1px solid rgba(0,0,0,0.14)',
            padding: '1px 4px', borderRadius: 4,
          }}>
            ⌘K
          </kbd>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(0,0,0,0.4)' }}>
            Jump to...
          </span>
        </button>
      </motion.div>
    </motion.header>
  )
}
