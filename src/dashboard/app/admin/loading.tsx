import SkeletonCronRow from '@/components/admin/SkeletonCronRow'
import SkeletonMetricCard from '@/components/admin/SkeletonMetricCard'

// Route-level loading state for /admin, mirroring the 3-3-3 metric grid + cron card.
export default function Loading() {
  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      <div className="animate-pulse" style={{ height: 28, width: 140, background: 'var(--ink-2)', borderRadius: 'var(--rounded-sm)' }} />
      <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 'var(--space-md)' }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <SkeletonMetricCard key={i} />
        ))}
      </div>
      <div className="ds-stat-card" style={{ padding: '24px' }}>
        <div className="animate-pulse" style={{ height: 12, width: 180, background: 'var(--bg-canvas)', borderRadius: '6px', marginBottom: '16px' }} />
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCronRow key={i} />
        ))}
      </div>
    </div>
  )
}
