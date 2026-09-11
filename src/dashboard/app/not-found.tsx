import Link from 'next/link'

/** 404 — rendered outside the dashboard theme wrapper, so we use hardcoded values. */
export default function NotFound() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '32px',
        background: '#F5F5F5',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', maxWidth: '400px' }}>

        {/* Icon */}
        <div style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'rgba(220, 38, 38, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#DC2626',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>

        {/* Title */}
        <h1 style={{
          margin: 0,
          fontSize: '1.25rem',
          fontWeight: 700,
          color: '#111827',
          letterSpacing: '-0.03em',
          fontFamily: "'Syne', sans-serif",
        }}>
          Page not found
        </h1>

        {/* Body */}
        <p style={{
          margin: 0,
          fontSize: '0.9rem',
          lineHeight: 1.65,
          color: '#6B7280',
        }}>
          The link may be broken or the page may have been removed. Check the URL or return to the dashboard.
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingTop: '8px' }}>
          <Link
            href="/"
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: '1px solid #111827',
              background: '#111827',
              color: '#fff',
              fontSize: '0.875rem',
              fontWeight: 600,
              textDecoration: 'none',
              fontFamily: 'inherit',
              letterSpacing: '-0.01em',
            }}
          >
            Dashboard
          </Link>
          <Link
            href="mailto:hello@usersessions.io"
            style={{
              fontSize: '0.875rem',
              color: '#6B7280',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Contact support
          </Link>
        </div>

      </div>
    </main>
  )
}
