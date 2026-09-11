import type { HealthStatus } from '@/lib/monitoring'

const BADGE: Record<HealthStatus, string> = { live: 'OK', pending: 'WARN', dead: 'DOWN' }
const BADGE_COLOR: Record<HealthStatus, string> = {
  live: 'rgba(34,197,94,1)',
  pending: 'rgba(245,158,11,1)',
  dead: 'rgba(220,38,38,1)',
}
const BADGE_BG: Record<HealthStatus, string> = {
  live: 'rgba(34,197,94,0.1)',
  pending: 'rgba(245,158,11,0.1)',
  dead: 'rgba(220,38,38,0.1)',
}
const BORDER_COLOR: Record<HealthStatus, string> = {
  live: 'var(--glass-bg-hover)',
  pending: 'rgba(245,158,11,0.15)',
  dead: 'rgba(220,38,38,0.2)',
}

// One system health card: label + status badge, big value, muted detail line.
export default function SystemHealthCard({ label, value, status, sub }: { label: string; value: string; status: HealthStatus; sub?: string }) {
  return (
    <div 
      className="ds-stat-card"
      style={{
      border: `1px solid ${BORDER_COLOR[status]}`,
      padding: '20px 24px',
      boxShadow: status === 'dead' ? '0 0 20px rgba(220,38,38,0.08)' : status === 'pending' ? '0 0 20px rgba(245,158,11,0.05)' : 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>
      <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <p style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', margin: 0 }}>{label}</p>
        <span style={{
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.08em',
          padding: '3px 8px',
          borderRadius: '8px',
          background: BADGE_BG[status],
          color: BADGE_COLOR[status],
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: BADGE_COLOR[status], boxShadow: `0 0 6px ${BADGE_COLOR[status]}`, display: 'inline-block' }} />
          {BADGE[status]}
        </span>
      </div>
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)', margin: 0, lineHeight: 1 }}>{value}</p>
      {sub ? <p style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', color: 'var(--muted)', margin: 0 }}>{sub}</p> : null}
    </div>
  )
}
