// Pulse skeleton matching the dimensions of a dense metric card (label + number + subtext).
export default function SkeletonMetricCard() {
  return (
    <div className="ds-stat-card animate-pulse" style={{ padding: '24px' }} aria-hidden="true">
      <div style={{ height: 12, width: 120, background: 'var(--bg-canvas)', borderRadius: '6px', marginBottom: '16px' }} />
      <div style={{ height: 32, width: 96, background: 'var(--bg-canvas)', borderRadius: '6px', marginBottom: '12px' }} />
      <div style={{ height: 10, width: 72, background: 'var(--bg-canvas)', borderRadius: '6px' }} />
    </div>
  )
}
