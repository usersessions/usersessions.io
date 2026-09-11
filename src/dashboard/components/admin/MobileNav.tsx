'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { label: 'System', href: '/admin' },
  { label: 'Users', href: '/admin/users' },
  { label: 'Billing', href: '/admin/billing' },
  { label: 'Support', href: '/admin/support' },
  { label: 'Settings', href: '/admin/settings' },
]

// Bottom bar with primary destinations, mobile only.
export default function MobileNav() {
  const pathname = usePathname()
  const isActive = (href: string) => {
    if (!pathname) return false
    return href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
  }

  return (
    <nav
      className="md:hidden"
      aria-label="Admin primary"
      style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40, display: 'flex', background: 'var(--ink-2)', borderTop: '1px solid var(--border)' }}
    >
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="font-mono-micro"
          aria-current={isActive(item.href) ? 'page' : undefined}
          style={{ flex: 1, textAlign: 'center', padding: 'var(--space-sm) 0', color: isActive(item.href) ? 'var(--amber)' : 'var(--muted)', textDecoration: 'none' }}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
