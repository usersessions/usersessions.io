import { CRON_JOBS } from './cron-jobs'
import { createServiceClient } from './supabase/server'

export type Insight = { id: string; severity: 'info' | 'warning' | 'critical'; text: string; href?: string }

/**
 * Anomaly detection against simple historical baselines. Conservative thresholds;
 * make them configurable from /admin/settings as they prove out.
 */
export async function computeInsights(): Promise<Insight[]> {
  const db = createServiceClient()
  const now = Date.now()
  const dayAgo = new Date(now - 864e5).toISOString()
  const weekAgo = new Date(now - 7 * 864e5).toISOString()
  const todayStart = new Date(new Date(now).setUTCHours(0, 0, 0, 0)).toISOString()

  const [
    { data: cronLogs },
    { count: failed24 },
    { count: signupsToday },
    { count: signupsWeek },
  ] = await Promise.all([
    db.from('cron_logs').select('job_name, status, ran_at').order('ran_at', { ascending: false }).limit(200),
    db.from('cron_logs').select('*', { count: 'exact', head: true }).eq('status', 'failed').gte('ran_at', dayAgo),
    db.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
    db.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
  ])

  const insights: Insight[] = []

  const lastOk = new Map<string, number>()
  for (const log of cronLogs ?? []) {
    if (log.status === 'ok' && !lastOk.has(log.job_name)) lastOk.set(log.job_name, new Date(log.ran_at).getTime())
  }
  for (const job of CRON_JOBS) {
    const ts = lastOk.get(job.name)
    if (ts === undefined) continue // never ran — the cron table already surfaces this
    const hours = Math.floor((now - ts) / 3600e3)
    if (hours >= 48) insights.push({ id: `cron-stale-${job.name}`, severity: 'warning', text: `${job.name} hasn't succeeded in ${hours}h.` })
  }

  if ((failed24 ?? 0) > 0) {
    insights.push({ id: 'cron-failures', severity: 'critical', text: `${failed24} cron run${failed24 === 1 ? '' : 's'} failed in the last 24h.` })
  }


  const avgDaily = (signupsWeek ?? 0) / 7
  if ((signupsToday ?? 0) >= 5 && (signupsToday ?? 0) > avgDaily * 2) {
    insights.push({ id: 'signup-spike', severity: 'info', text: `${signupsToday} signups today — more than double the 7-day average.` })
  }
  if (avgDaily >= 5 && (signupsToday ?? 0) < avgDaily / 2) {
    insights.push({ id: 'signup-drop', severity: 'warning', text: `Signups today (${signupsToday}) are less than half the 7-day average.` })
  }

  return insights
}
