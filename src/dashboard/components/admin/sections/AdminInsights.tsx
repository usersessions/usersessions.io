import { computeInsights } from '@/lib/insights'
import InsightList from '../InsightList'

// Async server component — computes anomalies, client list handles dismissal.
export default async function AdminInsights() {
  const insights = await computeInsights()
  if (insights.length === 0) return null
  return <InsightList insights={insights} />
}
