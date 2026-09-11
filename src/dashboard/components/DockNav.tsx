'use client'

/**
 * DockNav — macOS-style floating bottom dock.
 * Rebuilt with:
 *  - Glass morphism (backdrop-filter + luminous border)
 *  - All primary routes visible without overflow
 *  - Smooth spring magnification (will-change: transform)
 *  - Dark frosted-glass tooltips
 *  - Notifications + Settings promoted to primary rail
 */

import React, { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { AIChatDrawer } from '@/components/AIChatDrawer'
import { usePathname } from 'next/navigation'
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
  AnimatePresence,
  type MotionValue,
} from 'framer-motion'
import {
  PiHouseBold,
  PiFireBold,
  PiCrosshairBold,
  PiCheckSquareOffsetBold,
  PiFileTextBold,
  PiUsersBold,
  PiPlugBold,
  PiGearBold,
  PiShieldWarningBold,
  PiPulseBold,
  PiCreditCardBold,
  PiKeyBold,
  PiBellBold,
  PiUsersThreeBold,
  PiFunnelBold,
  PiSparkleBold,
  PiCurrencyDollarBold,
} from 'react-icons/pi'

// ── Nav items ──────────────────────────────────────────────────────────────
const PRIMARY_ITEMS = [
  { label: 'Today',         href: '/' },
  { label: 'Sessions',      href: '/sessions' },
  { label: 'Findings',      href: '/findings' },
  { label: 'Actions',       href: '/approvals' },
  { label: 'Live Patches',  href: '/live-patches' },
  { label: 'Connect',       href: '/connect' },
  { label: 'Team',          href: '/team' },
  { label: 'Notifications', href: '/notifications' },
  { label: 'Settings',      href: '/settings' },
]

const ICONS: Record<string, React.ReactNode> = {
  '/':              <PiHouseBold             size={20} />,
  '/sessions':      <PiFireBold              size={20} />,
  '/funnels':       <PiFunnelBold            size={20} />,
  '/revenue':        <PiCurrencyDollarBold    size={20} />,
  '/findings':      <PiCrosshairBold         size={20} />,
  '/approvals':     <PiCheckSquareOffsetBold size={20} />,
  '/live-patches':  <PiPulseBold           size={20} />,
  '/connect':       <PiPlugBold              size={20} />,
  '/policies':      <PiFileTextBold          size={20} />,
  '/notifications': <PiBellBold              size={20} />,
  '/settings':      <PiGearBold              size={20} />,
  '/accounts':      <PiUsersBold             size={20} />,
  '/team':          <PiUsersThreeBold        size={20} />,
  '/billing':       <PiCreditCardBold        size={20} />,
  '/license':       <PiKeyBold               size={20} />,
  '/admin':         <PiShieldWarningBold     size={20} />,
}

interface DockIconItemProps {
  href?: string
  label: string
  icon?: React.ReactNode
  mouseX: MotionValue<number>
  isActive: boolean
  badge?: number
  reducedMotion: boolean | null
  onClick?: () => void
  children?: React.ReactNode
}

function DockIconItem({
  href, label, icon, mouseX, isActive, badge, reducedMotion, onClick, children
}: DockIconItemProps) {
  const ref = useRef<HTMLButtonElement | HTMLAnchorElement>(null)
  const [hovered, setHovered] = useState(false)

  const distance = useTransform(mouseX, (x: number) => {
    if (reducedMotion) return 100
    const el = ref.current as Element | null
    if (!el) return 100
    const { left, width } = el.getBoundingClientRect()
    return Math.abs(x - (left + width / 2))
  })
  const scale = useTransform(distance, [0, 60, 130], [1.42, 1.14, 1])
  // Tighter spring — eliminates hang/lag
  const springScale = useSpring(scale, { stiffness: 440, damping: 30, mass: 0.05 })

  const content = (
    <>
      <AnimatePresence>
        {hovered && (
          <motion.span
            role="tooltip"
            initial={{ opacity: 0, y: 6, x: '-50%', scale: 0.88 }}
            animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
            exit={{ opacity: 0, y: 4, x: '-50%', scale: 0.92 }}
            transition={{ duration: 0.11, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 11px)',
              left: '50%',
              whiteSpace: 'nowrap',
              background: 'rgba(10,15,30,0.88)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              color: '#f1f5f9',
              padding: '5px 11px',
              borderRadius: 9,
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'var(--font-sans, system-ui)',
              letterSpacing: '-0.01em',
              pointerEvents: 'none',
              zIndex: 200,
              boxShadow: '0 4px 18px rgba(0,0,0,0.22), 0 0 0 1px rgba(255,255,255,0.07)',
              transformOrigin: 'bottom center',
            }}
          >
            {label}
            <span style={{
              position: 'absolute',
              top: '100%', left: '50%',
              transform: 'translateX(-50%)',
              width: 0, height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: '5px solid rgba(10,15,30,0.88)',
            }} />
          </motion.span>
        )}
      </AnimatePresence>

      {badge != null && badge > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
          aria-label={`${badge} pending`}
          style={{
            position: 'absolute', top: -5, right: -5,
            background: '#FCA311', color: '#000',
            fontSize: 9, fontWeight: 800,
            fontFamily: 'var(--font-mono, monospace)',
            borderRadius: 99, minWidth: 17, height: 17,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px', zIndex: 3,
            boxShadow: '0 0 0 2px rgba(255,255,255,0.75)',
          }}
        >
          {badge > 99 ? '99+' : badge}
        </motion.span>
      )}

      {children ?? (icon ?? (href && ICONS[href]) ?? ICONS['/'])}
    </>
  )

  const commonStyle: React.CSSProperties = {
    width: 44,
    height: 44,
    borderRadius: 13,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none',
    position: 'relative',
    color: isActive ? '#0f172a' : 'rgba(15,23,42,0.48)',
    background: isActive
      ? 'rgba(15,23,42,0.1)'
      : hovered
        ? 'rgba(15,23,42,0.05)'
        : 'transparent',
    transition: 'background 100ms ease, color 100ms ease',
    outline: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    willChange: 'transform',
  }

  return (
    <motion.div
      style={{
        scale: reducedMotion ? 1 : springScale,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        transformOrigin: 'bottom center',
        willChange: 'transform',
      }}
    >
      {href ? (
        <Link
          ref={ref as React.RefObject<HTMLAnchorElement>}
          href={href}
          aria-label={label}
          aria-current={isActive ? 'page' : undefined}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={commonStyle}
          onFocus={e  => { e.currentTarget.style.outline = '2px solid rgba(15,23,42,0.28)'; e.currentTarget.style.outlineOffset = '2px' }}
          onBlur={e   => { e.currentTarget.style.outline = 'none' }}
          onClick={onClick}
        >
          {content}
        </Link>
      ) : (
        <button
          ref={ref as React.RefObject<HTMLButtonElement>}
          aria-label={label}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={commonStyle}
          onFocus={e  => { e.currentTarget.style.outline = '2px solid rgba(15,23,42,0.28)'; e.currentTarget.style.outlineOffset = '2px' }}
          onBlur={e   => { e.currentTarget.style.outline = 'none' }}
          onClick={onClick}
        >
          {content}
        </button>
      )}

      {/* Active indicator dot */}
      <div style={{ height: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isActive && (
          <motion.div
            layoutId="activeDockDot"
            style={{ width: 4, height: 4, borderRadius: '50%', background: '#0f172a', opacity: 0.45 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          />
        )}
      </div>
    </motion.div>
  )
}

function DockDivider() {
  return (
    <div style={{
      width: 1, height: 28,
      background: 'rgba(15,23,42,0.1)',
      borderRadius: 1,
      alignSelf: 'center',
      marginTop: -4,
      flexShrink: 0,
    }} />
  )
}

// ── Public API ─────────────────────────────────────────────────────────────
export interface DockNavProps {
  isAdmin: boolean
  pendingCount?: number
  findingsCount?: number
  notificationsCount?: number
  hasCrmConnected?: boolean
  clientId?: string | null
}

export function DockNav({
  isAdmin,
  pendingCount      = 0,
  findingsCount     = 0,
  notificationsCount = 0,
  hasCrmConnected   = false,
  clientId          = null,
}: DockNavProps) {
  const pathname      = usePathname()
  const mouseX        = useMotionValue(Infinity)
  const reducedMotion = useReducedMotion()
  const isSelfHosted  = process.env.NEXT_PUBLIC_DEPLOYMENT_MODE === 'self_hosted'
  const [mounted, setMounted] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const isActive = (href: string) => {
    if (!pathname) return false
    return href === '/' ? pathname === '/' : pathname.startsWith(href)
  }

  const badges: Record<string, number> = {
    '/approvals':     pendingCount,
    '/findings':      findingsCount,
    '/notifications': notificationsCount,
  }

  // Extras after divider (context-dependent)
  const extraItems = [
    ...(hasCrmConnected ? [{ label: 'Accounts', href: '/accounts' }] : []),
    ...(!isSelfHosted   ? [{ label: 'Billing',  href: '/billing'  }] : []),
    ...(isSelfHosted    ? [{ label: 'License',  href: '/license'  }] : []),
    ...(isAdmin         ? [{ label: 'Admin',    href: '/admin'    }] : []),
  ]

  // On the server / before hydration, render a static invisible placeholder
  // that matches the dock's fixed position so React doesn't see a shape mismatch.
  if (!mounted) return (
    <nav
      aria-hidden
      style={{
        position: 'fixed',
        bottom: 18,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        opacity: 0,
        pointerEvents: 'none',
      }}
    />
  )

  return (
    <>
    <motion.nav
      aria-label="Primary navigation"
      initial={reducedMotion ? { x: '-50%' } : { x: '-50%', y: 34, opacity: 0 }}
      animate={{ x: '-50%', y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 290, damping: 26, delay: 0.06 }}
      onMouseMove={e => mouseX.set(e.clientX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      style={{
        position: 'fixed',
        bottom: 18,
        left: '50%',
        zIndex: 50,
        display: 'flex',
        alignItems: 'flex-end',
        gap: 3,
        paddingInline: 14,
        paddingTop: 10,
        paddingBottom: 8,
        borderRadius: 28,
        // Premium glass
        background: 'rgba(255, 255, 255, 0.58)',
        backdropFilter: 'blur(32px) saturate(210%)',
        WebkitBackdropFilter: 'blur(32px) saturate(210%)',
        border: '1px solid rgba(255, 255, 255, 0.72)',
        boxShadow: [
          '0 24px 64px rgba(15,23,42,0.09)',
          '0 6px 20px rgba(15,23,42,0.06)',
          '0 1px 4px rgba(15,23,42,0.04)',
          'inset 0 1px 0 rgba(255,255,255,0.95)',
        ].join(', '),
        willChange: 'transform',
      }}
    >
      {/* AI Chat button */}
      <DockIconItem
        label="Ask Your Data"
        mouseX={mouseX}
        isActive={chatOpen}
        reducedMotion={reducedMotion}
        onClick={() => setChatOpen(true)}
      >
        <div style={{
          width: 44, height: 44, borderRadius: 13,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: chatOpen
            ? 'linear-gradient(135deg, #f97316, #ea580c)'
            : 'transparent',
          color: chatOpen ? '#fff' : 'rgba(15,23,42,0.48)',
          transition: 'all 0.2s',
        }}>
          <PiSparkleBold size={20} />
        </div>
      </DockIconItem>

      <DockDivider />

      {PRIMARY_ITEMS.map((item) => (
        <DockIconItem
          key={item.href}
          href={item.href}
          label={item.label}
          mouseX={mouseX}
          isActive={isActive(item.href)}
          badge={badges[item.href]}
          reducedMotion={reducedMotion}
        />
      ))}

      {extraItems.length > 0 && (
        <>
          <DockDivider />
          {extraItems.map((item) => (
            <DockIconItem
              key={item.href}
              href={item.href}
              label={item.label}
              mouseX={mouseX}
              isActive={isActive(item.href)}
              badge={badges[item.href as keyof typeof badges]}
              reducedMotion={reducedMotion}
            />
          ))}
        </>
      )}
    </motion.nav>

    <AIChatDrawer
      isOpen={chatOpen}
      onClose={() => setChatOpen(false)}
      clientId={clientId}
    />
    </>
  )
}
