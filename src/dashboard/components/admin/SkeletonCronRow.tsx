// Pulse skeleton matching one row of the cron jobs list (name | status | timestamp).
export default function SkeletonCronRow() {
  return (
    <div className="flex animate-pulse" aria-hidden="true" style={{ gap: 'var(--space-md)', borderTop: '1px solid var(--border)', padding: 'var(--space-sm) 0' }}>
      <div style={{ flex: 1, height: 14, background: 'var(--ink-2)', borderRadius: 'var(--rounded-sm)' }} />
      <div style={{ width: 48, height: 14, background: 'var(--ink-2)', borderRadius: 'var(--rounded-sm)' }} />
      <div style={{ width: 112, height: 14, background: 'var(--ink-2)', borderRadius: 'var(--rounded-sm)' }} />
    </div>
  )
}
