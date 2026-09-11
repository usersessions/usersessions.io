'use client'

export function BillingStatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div 
      className="ds-stat-card"
      style={{ 
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <p style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', margin: 0 }}>{label}</p>
      <p style={{ fontFamily: 'var(--font-serif, serif)', fontStyle: 'italic', fontSize: '32px', color: 'var(--text-primary)', margin: 0, lineHeight: 1 }}>{value}</p>
    </div>
  )
}

export function BillingListRow({ children }: { children: React.ReactNode }) {
  return (
    <div 
      className="flex group admin-list-row" 
      style={{ gap: '16px', borderBottom: '1px solid var(--border)', padding: '12px 16px', margin: '0 -16px', borderRadius: '8px', flexWrap: 'wrap', transition: 'background 0.2s ease' }} 
    >
      {children}
    </div>
  )
}
