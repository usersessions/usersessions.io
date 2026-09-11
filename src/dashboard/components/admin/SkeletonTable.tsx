// Pulse skeleton for admin tables: header bar plus N rows matching column proportions.
export default function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="ds-stat-card animate-pulse" style={{ padding: '24px' }} aria-hidden="true">
      <div style={{ height: 12, width: 160, background: 'var(--ink-2)', borderRadius: 'var(--rounded-sm)', marginBottom: 'var(--space-md)' }} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex" style={{ gap: 'var(--space-md)', borderTop: '1px solid var(--border)', padding: 'var(--space-sm) 0' }}>
          <div style={{ flex: 1, height: 14, background: 'var(--ink-2)', borderRadius: 'var(--rounded-sm)' }} />
          <div style={{ width: 64, height: 14, background: 'var(--ink-2)', borderRadius: 'var(--rounded-sm)' }} />
          <div style={{ width: 112, height: 14, background: 'var(--ink-2)', borderRadius: 'var(--rounded-sm)' }} />
        </div>
      ))}
    </div>
  )
}
