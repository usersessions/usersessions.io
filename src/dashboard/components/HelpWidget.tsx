'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

const LINKS: { label: string; href: string }[] = [
  { label: 'Setup guide', href: '/onboarding' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Guides & articles', href: '/articles' },
  { label: 'Contact support', href: '/support' },
]

// GAP 24 — floating "?" help button, bottom-right. 44px touch target, Esc closes.
export function HelpWidget() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 'var(--space-sm)',
      }}
    >
      {open && (
        <div
          role="dialog"
          aria-label="Help"
          className="card card--dense flex flex-col"
          style={{ width: 240, gap: 'var(--space-sm)', background: 'var(--ink-2)' }}
        >
          <p className="font-mono-label">Need a hand?</p>
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="font-sans-label"
              style={{ color: 'var(--text-primary)', textDecoration: 'none', padding: '4px 0' }}
              onClick={() => setOpen(false)}
            >
              {l.label} →
            </Link>
          ))}
        </div>
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? 'Close help' : 'Open help'}
        onClick={() => setOpen((v) => !v)}
        className="font-mono-label"
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'var(--ink-2)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          fontSize: '1.1rem',
        }}
      >
        ?
      </button>
    </div>
  )
}
