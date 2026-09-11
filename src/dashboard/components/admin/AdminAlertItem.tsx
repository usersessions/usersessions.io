'use client'

export type AdminAlert = {
  id: string
  kind: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  body: string | null
  metadata: { href?: string } | null
  created_at: string
}

const COLOR: Record<AdminAlert['severity'], string> = {
  info: 'var(--cyan, #22d3ee)',
  warning: 'var(--amber)',
  critical: 'var(--red)',
}

function rel(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function AdminAlertItem({ alert, onDismiss }: { alert: AdminAlert; onDismiss: (id: string) => void }) {
  return (
    <div 
      className="flex" 
      style={{ 
        gap: '16px', 
        alignItems: 'flex-start', 
        borderBottom: '1px solid var(--bg-canvas)', 
        padding: '16px 0',
        transition: 'background 0.2s ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-canvas)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      <span aria-hidden="true" style={{ 
        width: 10, 
        height: 10, 
        borderRadius: '50%', 
        background: COLOR[alert.severity], 
        boxShadow: `0 0 12px ${COLOR[alert.severity]}`,
        marginTop: 6, 
        flexShrink: 0 
      }} />
      <div style={{ flex: 1 }}>
        <p style={{ fontFamily: 'var(--font-sans, sans-serif)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, lineHeight: 1.4 }}>
          {alert.title}
        </p>
        {alert.body ? (
          <p style={{ fontFamily: 'var(--font-sans, sans-serif)', fontSize: '13px', color: 'var(--muted)', margin: '4px 0 0', lineHeight: 1.5 }}>
            {alert.body}
          </p>
        ) : null}
        <p style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', color: 'var(--text-muted)', margin: '8px 0 0', letterSpacing: '0.02em' }} suppressHydrationWarning>
          {rel(alert.created_at)}
          {alert.metadata?.href ? (
            <>
              <span style={{ opacity: 0.3, margin: '0 8px' }}>•</span>
              <a href={alert.metadata.href} style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 500 }}>
                View details →
              </a>
            </>
          ) : null}
        </p>
      </div>
      <button 
        type="button" 
        aria-label={`Dismiss: ${alert.title}`} 
        onClick={() => onDismiss(alert.id)}
        style={{
          background: 'var(--glass-bg-hover)',
          border: 'none',
          color: 'var(--muted)',
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--glass-border-heavy)'; e.currentTarget.style.color = 'var(--text-primary)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--glass-bg-hover)'; e.currentTarget.style.color = 'var(--muted)' }}
      >
        ✕
      </button>
    </div>
  )
}
