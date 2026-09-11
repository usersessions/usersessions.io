/** Route-level skeleton — the dashboard never flashes a blank screen between pages. */
export default function Loading() {
  return (
    <div className="flex flex-col animate-pulse" style={{ gap: 'var(--space-lg)' }}>
      <div
        style={{ height: 32, width: 220, background: 'var(--ink-2)', borderRadius: 'var(--rounded-sm)' }}
      />
      <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 'var(--space-lg)' }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="stat-card" style={{ height: 120 }} />
        ))}
      </div>
      <div className="stat-card" style={{ height: 240 }} />
      <div className="stat-card" style={{ height: 160 }} />
    </div>
  )
}
