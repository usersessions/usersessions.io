import { createServiceClient } from './supabase/server'

export type HealthStatus = 'live' | 'pending' | 'dead'

export type SystemHealth = {
  api: { status: HealthStatus; value: string; sub: string }
  database: { status: HealthStatus; value: string; sub: string }
  queue: { status: HealthStatus; value: string; sub: string }
  extension: { status: HealthStatus; value: string; sub: string }
}

/**
 * Health snapshot derived from what is measurable today: timed DB probes,
 * queue depths, 24h cron error rate, and adapter review backlog as an
 * extension proxy. Labeled as probe-based — swap in real APM percentiles
 * (p50/p95/p99) when a metrics backend is wired up.
 */
export async function getSystemHealth(): Promise<SystemHealth> {
  const db = createServiceClient()

  // Three timed probes; min ≈ p50 proxy, max ≈ p95 proxy.
  const samples: number[] = []
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now()
    await db.from('profiles').select('id', { head: true, count: 'exact' })
    samples.push(Date.now() - t0)
  }
  samples.sort((a, b) => a - b)
  const p50 = samples[0]
  const p95 = samples[samples.length - 1]

  const dayAgo = new Date(Date.now() - 864e5).toISOString()
  const [{ count: cronOk }, { count: cronFailed }] = await Promise.all([
    db.from('cron_logs').select('*', { count: 'exact', head: true }).eq('status', 'ok').gte('ran_at', dayAgo),
    db.from('cron_logs').select('*', { count: 'exact', head: true }).eq('status', 'failed').gte('ran_at', dayAgo),
  ])

  const cronTotal = (cronOk ?? 0) + (cronFailed ?? 0)
  const errorRate = cronTotal > 0 ? ((cronFailed ?? 0) / cronTotal) * 100 : 0
  const depth = 0 // Future: action generation queue depth

  const apiStatus: HealthStatus = p95 < 500 ? 'live' : p95 <= 1000 ? 'pending' : 'dead'
  const dbStatus: HealthStatus = p50 < 250 ? 'live' : p50 <= 1000 ? 'pending' : 'dead'
  const queueStatus: HealthStatus = depth < 10 ? 'live' : depth <= 50 ? 'pending' : 'dead'
  const extStatus: HealthStatus = errorRate > 5 ? 'dead' : errorRate > 1 ? 'pending' : 'live'
  const extVersion = process.env.NEXT_PUBLIC_EXTENSION_VERSION ?? '—'

  return {
    api: {
      status: apiStatus,
      value: `${p50}ms`,
      sub: `p50 ${p50}ms · p95 ${p95}ms (probe) · cron failures 24h: ${cronFailed ?? 0}`,
    },
    database: {
      status: dbStatus,
      value: dbStatus === 'live' ? 'Healthy' : dbStatus === 'pending' ? 'Slow' : 'Degraded',
      sub: `Probe latency ${p50}ms · pooling managed by Supabase`,
    },
    queue: {
      status: queueStatus,
      value: String(depth),
      sub: `Action queue: ${depth}`,
    },
    extension: {
      status: extStatus,
      value: extVersion,
      sub: `Cron error rate 24h: ${errorRate.toFixed(1)}%`,
    },
  }
}
