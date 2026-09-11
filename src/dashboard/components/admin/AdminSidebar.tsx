'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import AdminSearch from './AdminSearch'
import { PiGaugeBold, PiUsersBold, PiCreditCardBold, PiArrowLeftBold } from 'react-icons/pi'

const NAV = [
  { label: 'System',         href: '/admin', icon: <PiGaugeBold size={16} />, exact: true },
  { label: 'Users',          href: '/admin/users', icon: <PiUsersBold size={16} /> },
  { label: 'Billing',        href: '/admin/billing', icon: <PiCreditCardBold size={16} /> },
]

export default function AdminSidebar({ email }: { email: string }) {
  const pathname = usePathname()

  return (
    <aside
      className="flex flex-col shrink-0 sticky top-0 h-screen"
      style={{
        width: 260,
        background: 'var(--bg-canvas)',
        borderRight: '1px solid var(--border)',
        padding: '32px 20px',
        gap: '32px',
        zIndex: 40,
      }}
    >
      <div className="flex flex-col gap-1 px-3">
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
          usersessions
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--orange)', boxShadow: '0 0 8px var(--orange)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
            Admin Mode
          </span>
        </div>
      </div>

      <div className="px-1">
        <AdminSearch />
      </div>

      <nav className="flex flex-col flex-1 overflow-y-auto hide-scrollbar" style={{ gap: 4 }}>
        {NAV.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname?.startsWith(item.href)
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`admin-sidebar-nav-item ${isActive ? 'is-active' : ''}`}
            >
              {item.icon}
              {item.label}
            </Link>
          )
        })}
        
        <div style={{ margin: '16px 0', height: 1, background: 'var(--border)', opacity: 0.5 }} />
        
        <Link
          href="/"
          className="admin-sidebar-nav-item"
        >
          <PiArrowLeftBold size={16} /> Back to dashboard
        </Link>
      </nav>

      <div style={{
        marginTop: 'auto',
        padding: '16px',
        background: 'var(--bg-canvas)',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4
      }}>
        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>Logged in as</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {email}
        </div>
      </div>
    </aside>
  )
}
