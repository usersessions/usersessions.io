'use client'

/** Global error boundary — rendered outside the dashboard theme wrapper, so we use hardcoded values. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
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
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
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
          Something went wrong
        </h1>

        {/* Body */}
        <p style={{
          margin: 0,
          fontSize: '0.9rem',
          lineHeight: 1.65,
          color: '#6B7280',
        }}>
          The error has been contained. None of your data was affected.
          Try again — if it keeps happening, contact support.
        </p>

        {/* Digest ref */}
        {error.digest && (
          <p style={{
            margin: 0,
            fontSize: '0.7rem',
            fontFamily: "'DM Mono', 'SF Mono', monospace",
            color: '#9CA3AF',
            letterSpacing: '0.02em',
          }}>
            ref: {error.digest}
          </p>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingTop: '8px' }}>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: '1px solid #111827',
              background: '#111827',
              color: '#fff',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              letterSpacing: '-0.01em',
            }}
          >
            Try again
          </button>
          <a
            href="mailto:hello@usersessions.io"
            style={{
              fontSize: '0.875rem',
              color: '#6B7280',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Contact support
          </a>
        </div>

      </div>
    </main>
  )
}
