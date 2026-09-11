import Link from 'next/link'

const LINKS = [
  { label: 'Pricing', href: '/pricing' },
  { label: 'Guides', href: '/articles' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Support', href: '/support' },
  { label: 'Terms', href: '/terms' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Sign in', href: '/login' },
]

/** Shared marketing footer — the trust layer belongs on every public page. */
export function MarketingFooter() {
  return (
    <footer
      className="flex flex-col items-center"
      style={{
        gap: 'var(--space-sm)',
        padding: 'var(--space-xl) var(--space-lg)',
        borderTop: '1px solid var(--border)',
        marginTop: 'var(--space-2xl)',
      }}
    >
      {/* Logo home link — on every public page, always back to / */}
      <Link
        href="/"
        className="italic"
        style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', color: 'var(--text-primary)', textDecoration: 'none' }}
      >
        UserSessions.io
      </Link>
      <nav className="flex flex-wrap justify-center" style={{ gap: 'var(--space-lg)' }}>
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="font-mono-micro"
            style={{ color: 'var(--muted)', textDecoration: 'none' }}
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <p className="font-mono-micro">© {new Date().getFullYear()} UserSessions.io · The Autonomous Remediation Layer</p>
    </footer>
  )
}
