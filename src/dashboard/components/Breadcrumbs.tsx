'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LABELS: Record<string, string> = {
  onboarding: 'Get started',
  sessions: 'Sessions',
  analytics: 'Analytics',
  notifications: 'Notifications',
  settings: 'Settings',
  integrations: 'Integrations',
  agent: 'Agent',
}

// GAP 19 — "Dashboard / Campaigns / …" trail on every page except the Overview.
export function Breadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return null

  return (
    <nav
      aria-label="Breadcrumb"
      className="font-mono-micro"
      style={{ color: 'var(--muted)', marginBottom: 'var(--space-md)' }}
    >
      <Link href="/" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
        Dashboard
      </Link>
      {segments.map((seg, i) => {
        const href = '/' + segments.slice(0, i + 1).join('/')
        const label = LABELS[seg] ?? seg
        const isLast = i === segments.length - 1
        return (
          <span key={href}>
            {' / '}
            {isLast ? (
              <span aria-current="page" style={{ color: 'var(--text-primary)' }}>{label}</span>
            ) : (
              <Link href={href} style={{ color: 'var(--muted)', textDecoration: 'none' }}>
                {label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
