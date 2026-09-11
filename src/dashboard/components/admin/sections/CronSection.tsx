import { CRON_JOBS } from '@/lib/cron-jobs'
import { nextRun } from '@/lib/cron-jobs'
import { createServiceClient } from '@/lib/supabase/server'
import RunCronButton from '../RunCronButton'

type CronLog = { job_name: string; status: string; detail: unknown; ran_at: string }

function statusFor(log?: CronLog): { color: string; bg: string; label: string } {
  if (!log) return { color: 'var(--text-muted)', bg: 'var(--glass-bg-hover)', label: '—' }
  if (log.status !== 'ok') return { color: 'rgba(220,38,38,1)', bg: 'rgba(220,38,38,0.1)', label: 'FAILED' }
  const age = Date.now() - new Date(log.ran_at).getTime()
  if (age < 3600e3) return { color: 'rgba(34,197,94,1)', bg: 'rgba(34,197,94,0.1)', label: 'OK' }
  if (age < 24 * 3600e3) return { color: 'rgba(245,158,11,1)', bg: 'rgba(245,158,11,0.1)', label: 'STALE' }
  return { color: 'rgba(220,38,38,1)', bg: 'rgba(220,38,38,0.1)', label: 'OVERDUE' }
}

/** UTC display: "2026-07-28 04:00" */
const fmtUtc = (iso: string) => new Date(iso).toISOString().replace('T', ' ').slice(0, 16)

/** EAT = UTC+3. No library needed — just offset the timestamp by 3 hours. */
const fmtEat = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 3 * 60 * 60 * 1000)
  return d.toISOString().replace('T', ' ').slice(0, 16)
}

/** Renders both UTC and EAT in a stacked format. */
function DualTime({ iso, fallback = 'Never' }: { iso?: string | null; fallback?: string }) {
  if (!iso) return <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', color: 'var(--muted)' }}>{fallback}</span>
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', color: 'var(--text-primary)' }}>{fmtUtc(iso)} UTC</span>
      <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '10px', color: 'var(--muted)' }}>{fmtEat(iso)} EAT</span>
    </span>
  )
}

// Full cron table — every registered job is visible even with zero runs (Cron Gate).
export default async function CronSection() {
  const db = createServiceClient()
  const { data: logs } = await db
    .from('cron_logs')
    .select('job_name, status, detail, ran_at')
    .order('ran_at', { ascending: false })
    .limit(100)

  const latest = new Map<string, CronLog>()
  for (const log of (logs ?? []) as CronLog[]) {
    if (!latest.has(log.job_name)) latest.set(log.job_name, log)
  }

  return (
    <div className="ds-stat-card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', margin: 0 }}>Cron jobs</p>
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', color: 'var(--muted)', opacity: 0.6 }}>{CRON_JOBS.length} jobs registered</span>
      </div>

      {/* Column headers */}
      <div style={{
        display: 'flex',
        gap: '16px',
        padding: '10px 24px',
        background: 'var(--bg-canvas)',
        borderBottom: '1px solid var(--border)',
        overflowX: 'auto',
        minWidth: 820,
      }}>
        {[
          { label: 'Job', width: 'flex' },
          { label: 'Schedule', width: 90 },
          { label: 'Last run', width: 160 },
          { label: 'Status', width: 70 },
          { label: 'Duration', width: 80 },
          { label: 'Next run', width: 160 },
          { label: 'Actions', width: 100 },
        ].map((col) => (
          <span key={col.label} style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            ...(col.width === 'flex' ? { flex: 1, minWidth: 130 } : { width: col.width }),
          }}>
            {col.label}
          </span>
        ))}
      </div>

      {/* Rows */}
      <div style={{ overflowX: 'auto' }}>
        {CRON_JOBS.map((job) => {
          const log = latest.get(job.name)
          const s = statusFor(log)
          const next = nextRun(job.schedule)
          const durationMs = (log?.detail as { duration_ms?: number } | null | undefined)?.duration_ms
          return (
            <div
              key={job.name}
              className="flex admin-cron-row"
              style={{
                gap: '16px',
                borderBottom: '1px solid var(--border)',
                padding: '14px 24px',
                alignItems: 'center',
                minWidth: 820,
                transition: 'background 0.2s ease',
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '13px', color: 'var(--text-primary)', flex: 1, minWidth: 130 }} title={job.description}>{job.name}</span>
              <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', color: 'var(--muted)', width: 90 }}>{job.schedule}</span>
              <span style={{ width: 160 }}><DualTime iso={log?.ran_at} /></span>
              <span style={{ width: 70 }}>
                <span style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  padding: '3px 8px',
                  borderRadius: '8px',
                  background: s.bg,
                  color: s.color,
                }}>
                  {s.label}
                </span>
              </span>
              <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', color: 'var(--muted)', width: 80 }}>{durationMs ? `${durationMs}ms` : '—'}</span>
              <span style={{ width: 160 }}><DualTime iso={next?.toISOString()} fallback="—" /></span>
              <span style={{ width: 100 }}>
                {job.path ? (
                  <RunCronButton job={job.name} />
                ) : (
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '10px', color: 'var(--muted)', opacity: 0.6 }} title="Owned by an external scheduler">external</span>
                )}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
