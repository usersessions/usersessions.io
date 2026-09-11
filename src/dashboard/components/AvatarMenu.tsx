'use client'

/**
 * AvatarMenu — warm editorial account dropdown.
 *
 * @design-principles
 *  - @color: warm tokens only — no --ink, --paper, --border, --primary-dim.
 *  - @motion: popover opens with scale(0.96)→1 + y(-6)→0, spring-damped.
 *  - @icons: custom SVG paths for chevron and all menu items.
 */

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useReducedMotion } from "motion/react"
import { PiGearBold, PiCreditCardBold, PiLifebuoyBold, PiSignOutBold } from 'react-icons/pi'

const SPRING = { type: 'spring', bounce: 0, duration: 0.28 } as const

interface AvatarMenuProps {
  displayName: string
  email: string
  plan: string
  initial: string
}

export function AvatarMenu({ displayName, email, plan, initial }: AvatarMenuProps) {
  const planLabel =
    plan === 'enterprise' ? 'Enterprise'
    : plan === 'business' ? 'Business'
    : plan === 'pro' ? 'Pro'
    : plan === 'starter' ? 'Starter'
    : 'Free'

  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  const MENU_ITEMS = [
    {
      label: 'Settings',
      href: '/settings',
      icon: <PiGearBold size={14} />,
    },
    {
      label: 'Billing & plan',
      href: '/pricing',
      icon: <PiCreditCardBold size={14} />,
    },
    {
      label: 'Support',
      href: '/support',
      icon: <PiLifebuoyBold size={14} />,
    },
  ]

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: open ? 'rgba(20,20,22,0.06)' : 'transparent',
          border: '1px solid',
          borderColor: open ? 'var(--line)' : 'transparent',
          cursor: 'pointer',
          borderRadius: 10,
          padding: '7px 8px',
          width: '100%',
          textAlign: 'left',
          transition: 'background 160ms ease, border-color 160ms ease',
        }}
        onMouseEnter={(e) => {
          if (!open) e.currentTarget.style.background = 'rgba(20,20,22,0.04)'
        }}
        onMouseLeave={(e) => {
          if (!open) e.currentTarget.style.background = 'transparent'
        }}
      >
        {/* Avatar circle */}
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--orange), var(--orange-pale))',
            border: '1.5px solid var(--text-secondary)',
            fontSize: '13px',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: '#fff',
            boxShadow: '0 0 10px rgba(232,90,43,0.2)',
          }}
        >
          {initial}
        </span>

        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '-0.01em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {displayName || email}
          </p>
          <p style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.02em', textTransform: 'uppercase', fontWeight: 600 }}>
            {planLabel}
          </p>
        </div>

        {/* Chevron — inline SVG avoids lucide dual-module SSR mismatch */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          style={{
            flexShrink: 0,
            color: 'var(--text-muted)',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 220ms cubic-bezier(0.23,1,0.32,1)',
          }}
        >
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -4 }}
            transition={SPRING}
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 6px)',
              left: 0,
              right: 0,
              background: 'rgba(11,11,14,0.97)',
              border: '1px solid var(--glass-border)',
              borderRadius: 14,
              overflow: 'hidden',
              zIndex: 50,
              boxShadow: '0 20px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 var(--glass-bg-hover)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              transformOrigin: 'bottom left',
            }}
          >
            {/* Identity header */}
            <div style={{
              padding: '12px 14px',
              borderBottom: '1px solid var(--bg-canvas)',
            }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#FAFAFA', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayName !== email ? displayName : ''}
              </p>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 1, fontFamily: "'DM Mono', monospace" }}>
                {email}
              </p>
            </div>

            {/* Menu items */}
            {MENU_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '10px 14px',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#A1A1A8',
                  textDecoration: 'none',
                  letterSpacing: '-0.01em',
                  transition: 'background 120ms ease, color 120ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--glass-bg-hover)'
                  e.currentTarget.style.color = '#FAFAFA'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = ''
                  e.currentTarget.style.color = '#A1A1A8'
                }}
              >
                <span style={{ color: 'var(--text-secondary)', flexShrink: 0, display: 'flex' }}>{item.icon}</span>
                {item.label}
              </Link>
            ))}

            {/* Sign out */}
            <div style={{ borderTop: '1px solid var(--bg-canvas)' }}>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  role="menuitem"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 14px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--orange-deep)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    letterSpacing: '-0.01em',
                    transition: 'background 120ms ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(217,53,31,0.06)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
                >
                  <PiSignOutBold size={15} style={{ opacity: 0.5 }} />
                  Sign out
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
