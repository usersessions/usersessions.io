export default function Loading() {
  return (
    <div className="flex flex-col animate-pulse" style={{ gap: 'var(--space-lg)', maxWidth: 640 }}>
      <div style={{ height: 36, width: 140, background: 'var(--ink-2)', borderRadius: 'var(--rounded-sm)' }} />
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="stat-card" style={{ height: 120 }} />
      ))}
    </div>
  )
}
