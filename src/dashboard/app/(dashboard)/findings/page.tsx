import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PiCrosshairBold, PiCheckCircleBold, PiClockBold, PiXCircleBold, PiLightningBold, PiPlayBold, PiCursorClickBold } from 'react-icons/pi'
import { DashboardPageHeader } from '@/components/DashboardPageHeader'
import { ACTION_STATUSES, FINDING_STATUSES } from '@/types/constants'
import { SEV_COLORS, STATUS_ICONS, CATEGORY_LABELS as CAT_LABELS } from '@/lib/ui-constants'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Findings | UserSessions',
}

export default async function FindingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; severity?: string; category?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: client } = await supabase
    .from('us_clients')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()

  let query = supabase
    .from('us_findings')
    .select(`
      id, session_id, category, severity, confidence, summary, account_value, status, created_at,
      us_sessions(source, replay_url, rage_click_count),
      us_actions(id, status)
    `, { count: 'exact' })

  if (client?.id) query = query.eq('client_id', client.id)

  const activeStatus = params.status || 'pending'
  if (activeStatus !== 'all') {
    query = (query as any).eq('status', activeStatus)
  }

  if (params.severity) query = (query as any).eq('severity', params.severity)
  if (params.category) query = (query as any).eq('category', params.category)

  query = (query as any)
    .order('severity', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(100)

  const { data: findings, count } = await query

  const auditFindings = findings?.filter((f: any) => f.summary?.includes('[Initial Audit]')) || []
  const showAuditCallout = auditFindings.length > 0 && activeStatus === 'pending' && !params.severity && !params.category

  const severities = ['P0', 'P1', 'P2', 'P3']
  const statuses = [FINDING_STATUSES.PENDING, FINDING_STATUSES.PARTIALLY_EXECUTED, FINDING_STATUSES.DISMISSED, FINDING_STATUSES.EXECUTED]

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', width: '100%', paddingBottom: 120 }}>
      <DashboardPageHeader 
        icon={<PiCrosshairBold size={20} />} 
        title="Findings" 
        rightContent={count != null && count > 0 ? (
          <span style={{
            background: 'rgba(252,163,17,0.12)', color: 'var(--orange)',
            border: '1px solid rgba(252,163,17,0.25)', borderRadius: 99,
            padding: '4px 12px', fontSize: 13, fontWeight: 700,
          }}>
            {count} finding{count !== 1 ? 's' : ''}
          </span>
        ) : undefined}
      />

      {/* Audit Callout Banner */}
      {showAuditCallout && (
        <div style={{
          padding: '16px 20px', marginBottom: 24, borderRadius: 12,
          background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)',
          display: 'flex', alignItems: 'flex-start', gap: 14
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <PiLightningBold size={18} color="var(--blue)" />
          </div>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
              We audited your site before your first session arrived.
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
              Our AI found <strong>{auditFindings.length} issue{auditFindings.length !== 1 ? 's' : ''}</strong>. They are highlighted with the <code style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--blue)', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>[Initial Audit]</code> tag below.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <details style={{ marginBottom: 24 }}>
        <summary style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue)', cursor: 'pointer', marginBottom: 12 }}>
          Filters {activeStatus !== 'pending' || params.severity || params.category ? '(Active)' : ''}
        </summary>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <Link href="/findings?status=all" style={{
            padding: '6px 14px', borderRadius: 99, fontSize: 12, fontWeight: 600,
            background: activeStatus === 'all' ? 'var(--orange)' : 'var(--bg-canvas)',
            color: activeStatus === 'all' ? 'var(--bg-primary)' : 'var(--text-secondary)',
            border: '1px solid var(--border)', textDecoration: 'none', transition: 'all 150ms',
          }}>All</Link>
          {statuses.map(s => (
            <Link key={s} href={`/findings?status=${s}`} style={{
              padding: '6px 14px', borderRadius: 99, fontSize: 12, fontWeight: 600,
              background: activeStatus === s ? 'var(--orange)' : 'var(--bg-canvas)',
              color: activeStatus === s ? 'var(--bg-primary)' : 'var(--text-secondary)',
              border: '1px solid var(--border)', textDecoration: 'none', transition: 'all 150ms',
              textTransform: 'capitalize',
            }}>{s}</Link>
          ))}
          <div style={{ width: 1, background: 'var(--border)', margin: '0 4px', alignSelf: 'stretch' }} />
          {severities.map(sv => {
            const c = SEV_COLORS[sv]
            return (
              <Link key={sv} href={`/findings?severity=${sv}`} style={{
                padding: '6px 14px', borderRadius: 99, fontSize: 12, fontWeight: 700,
                background: params.severity === sv ? c.color : c.bg,
                color: params.severity === sv ? 'var(--bg-primary)' : c.color,
                border: `1px solid ${c.color}40`, textDecoration: 'none', transition: 'all 150ms',
              }}>{sv}</Link>
            )
          })}
        </div>
      </details>

      {(!findings || findings.length === 0) ? (
        <div className="ds-empty" style={{ border: '1px dashed var(--glass-border-heavy)', gap: 20 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <PiCrosshairBold size={24} color="var(--blue)" />
          </div>
          <div>
            <p className="ds-empty-title" style={{ marginBottom: 6 }}>No findings yet</p>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
              Sessions are being recorded. Findings appear once we spot a pattern worth flagging.
            </p>
          </div>
        </div>
      ) : (
        <div className="ds-stat-card" style={{ padding: 0, overflow: 'hidden' }}>
          {findings.map((f: any, i: number) => {
            const sev = SEV_COLORS[f.severity] ?? SEV_COLORS.P3
            const actions = f.us_actions ?? []
            const pendingActions = actions.filter((a: any) => a.status === ACTION_STATUSES.APPROVE_REQUIRED).length
            return (
              <div key={f.id} style={{
                padding: '18px 24px',
                borderBottom: i < findings.length - 1 ? '1px solid var(--border)' : 'none',
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  {/* Severity pill */}
                  <span style={{
                    background: sev.bg, color: sev.color,
                    border: `1px solid ${sev.color}30`,
                    borderRadius: 99, padding: '2px 10px',
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.02em',
                    flexShrink: 0, marginTop: 2,
                  }}>{f.severity}</span>

                  {/* Summary */}
                  <p style={{ flex: 1, margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    {f.summary}
                  </p>

                  {/* Status */}
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '3px 10px', borderRadius: 99,
                    background: f.status === FINDING_STATUSES.EXECUTED ? 'rgba(16,185,129,0.1)' :
                                f.status === FINDING_STATUSES.PARTIALLY_EXECUTED ? 'rgba(59,130,246,0.1)' :
                                f.status === FINDING_STATUSES.DISMISSED ? 'rgba(107,114,128,0.1)' : 'rgba(252,163,17,0.1)',
                    color: f.status === FINDING_STATUSES.EXECUTED ? 'var(--green)' :
                           f.status === FINDING_STATUSES.PARTIALLY_EXECUTED ? 'var(--blue)' :
                           f.status === FINDING_STATUSES.DISMISSED ? 'var(--text-muted)' : 'var(--orange)',
                    fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
                  }}>
                    {STATUS_ICONS[f.status]}
                    {f.status}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  {/* Category */}
                  {f.category && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                      {CAT_LABELS[f.category] ?? f.category}
                    </span>
                  )}
                  {/* Account value */}
                  {f.account_value && (
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      ARR: <strong style={{ color: 'var(--text-primary)' }}>${f.account_value.toLocaleString()}</strong>
                    </span>
                  )}
                  {/* Rage clicks */}
                  {f.us_sessions?.rage_click_count > 0 && (
                    <span style={{ fontSize: 12, color: 'var(--orange)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <PiCursorClickBold size={12} /> {f.us_sessions.rage_click_count} rage-clicks
                    </span>
                  )}
                  {/* Pending actions badge */}
                  {pendingActions > 0 && (
                    <Link href="/approvals" style={{
                      fontSize: 11, fontWeight: 700, color: 'var(--orange)',
                      background: 'rgba(252,163,17,0.1)', borderRadius: 99,
                      padding: '2px 10px', textDecoration: 'none',
                    }}>
                      {pendingActions} action{pendingActions > 1 ? 's' : ''} pending
                    </Link>
                  )}
                  {/* Replay link — only when session replay is still available */}
                  {f.us_sessions?.replay_url && (
                    <Link
                      href={`/sessions/${f.session_id}`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        fontSize: 11, fontWeight: 700, color: 'var(--blue)',
                        background: 'rgba(59,130,246,0.08)', borderRadius: 99,
                        padding: '2px 10px', textDecoration: 'none',
                        border: '1px solid rgba(59,130,246,0.2)',
                      }}
                    >
                      <PiPlayBold size={10} /> Watch Replay
                    </Link>
                  )}
                  {/* Timestamp */}
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    {new Date(f.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
