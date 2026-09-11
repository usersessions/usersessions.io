import { getSystemHealth } from '@/lib/monitoring'
import SystemHealthCard from '../SystemHealthCard'

// Async server component — streamed via Suspense from /admin.
export default async function SystemHealthSection() {
  const health = await getSystemHealth()
  const cards = [
    { label: 'API response time', ...health.api },
    { label: 'Database', ...health.database },
    { label: 'Queue depth', ...health.queue },
    { label: 'Extension', ...health.extension },
  ]
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4" style={{ gap: 'var(--space-md)' }}>
      {cards.map((c) => (
        <SystemHealthCard key={c.label} {...c} />
      ))}
    </div>
  )
}
