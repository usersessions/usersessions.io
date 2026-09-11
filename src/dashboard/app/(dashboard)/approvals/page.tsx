import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { PiCheckSquareBold, PiXCircleBold, PiLightningBold, PiClockBold, PiArrowSquareOutBold } from 'react-icons/pi'
import { approveAction as runApproveAction, dismissAction as runDismissAction } from '@/services/approval'
import { getFeatureAccess } from '@/hooks/useFeatureAccess'
import Link from 'next/link'
import { ACTION_STATUSES } from '@/types/constants'
import { DashboardPageHeader } from '@/components/DashboardPageHeader'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Actions | UserSessions',
}

/** Returns the action id only if it belongs to the signed-in user's client and is still pending. */
async function ownedActionId(formData: FormData): Promise<{ id: string; email: string } | null> {
  const id = String(formData.get('id') ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: client } = await supabase.from('us_clients').select('id').eq('profile_id', user.id).maybeSingle()
  if (!client) return null
  const { data: action } = await supabase
    .from('us_actions')
    .select('id')
    .eq('id', id)
    .eq('client_id', client.id)
    .eq('status', ACTION_STATUSES.APPROVE_REQUIRED)
    .maybeSingle()
  if (!action) return null
  return { id: action.id, email: user.email ?? user.id }
}

async function approveFormAction(formData: FormData) {
  'use server'
  const owned = await ownedActionId(formData)
  if (!owned) return
  await runApproveAction({ actionId: owned.id, approvedByEmail: owned.email })
  revalidatePath('/approvals')
}

async function dismissFormAction(formData: FormData) {
  'use server'
  const owned = await ownedActionId(formData)
  if (!owned) return
  await runDismissAction({ actionId: owned.id, dismissedByEmail: owned.email })
  revalidatePath('/approvals')
}

const SEV_COLORS: Record<string, string> = {
  P0: '#ef4444', P1: '#f97316', P2: '#ca8a04', P3: '#6366f1',
}

const TOOLKIT_LABELS: Record<string, string> = {
  gmail: 'Gmail', slack: 'Slack', salesforce: 'Salesforce', hubspot: 'HubSpot',
  linear: 'Linear', github: 'GitHub', notion: 'Notion', jira: 'Jira',
  zendesk: 'Zendesk',
}

export default async function ApprovalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: client } = await supabase
    .from('us_clients')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()

  const { data: pending } = client ? await supabase
    .from('us_actions')
    .select(`
      id, composio_toolkit, composio_action, autonomy_level, created_at,
      us_findings(id, category, severity, summary, account_value)
    `)
    .eq('client_id', client.id)
    .eq('status', ACTION_STATUSES.APPROVE_REQUIRED)
    .order('created_at', { ascending: false })
    .limit(50)
  : { data: [] }

  const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle()
  const access = getFeatureAccess(profile?.plan)

  const { data: recent } = client ? await supabase
    .from('us_actions')
    .select(`
      id, composio_toolkit, composio_action, status, executed_at, created_at,
      us_findings(severity, summary)
    `)
    .eq('client_id', client.id)
    .in('status', [ACTION_STATUSES.APPROVED, ACTION_STATUSES.DISMISSED, ACTION_STATUSES.EXECUTED])
    .order('created_at', { ascending: false })
    .limit(20)
  : { data: [] }

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', width: '100%', paddingBottom: 120 }}>
      <DashboardPageHeader 
        icon={<PiCheckSquareBold size={20} />} 
        title="Pending Approvals" 
        action={
          (pending?.length ?? 0) > 0 ? (
            <span style={{
              background: 'rgba(252,163,17,0.12)', color: 'var(--orange)',
              border: '1px solid rgba(252,163,17,0.25)', borderRadius: 99,
              padding: '4px 12px', fontSize: 13, fontWeight: 700,
            }}>
              {pending!.length} pending
            </span>
          ) : null
        }
      />

      {/* Pending approvals */}
      {(!pending || pending.length === 0) ? (
        <div className="ds-empty" style={{ border: '1px dashed var(--glass-border-heavy)', gap: 20, marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <PiCheckSquareBold size={24} color="var(--green)" />
          </div>
          <div>
            <p className="ds-empty-title" style={{ marginBottom: 6 }}>Nothing pending</p>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
              No pending actions. When a finding has a proposed fix, it appears here before anything runs.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 40 }}>
          {pending!.map((action: any) => {
            const finding = action.us_findings
            const sevColor = finding?.severity ? SEV_COLORS[finding.severity] ?? '#6366f1' : '#6366f1'
            return (
              <div key={action.id} className="ds-stat-card" style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      {finding?.severity && (
                        <span style={{
                          background: `${sevColor}15`, color: sevColor,
                          border: `1px solid ${sevColor}30`,
                          borderRadius: 99, padding: '2px 10px',
                          fontSize: 11, fontWeight: 700,
                        }}>{finding.severity}</span>
                      )}
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {TOOLKIT_LABELS[action.composio_toolkit] ?? action.composio_toolkit}
                      </span>
                      {action.composio_action && (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          › {action.composio_action.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: 6 }}>
                      {finding?.summary ?? 'Action pending review'}
                    </p>
                    {finding?.account_value && (
                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                        ARR at risk: <strong style={{ color: 'var(--text-primary)' }}>${finding.account_value.toLocaleString()}</strong>
                      </p>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
                    {/* Jira / Linear quick-create — Pro+ */}
                    {access.isAtLeastPro && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Link
                          href={`/connect?q=jira`}
                          title="Create Jira ticket from this finding"
                          style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '7px 12px', fontSize: 12, fontWeight: 600,
                            borderRadius: 8, border: '1px solid rgba(99,102,241,0.25)',
                            background: 'rgba(99,102,241,0.06)', color: '#6366f1',
                            textDecoration: 'none', whiteSpace: 'nowrap',
                          }}
                        >
                          <PiArrowSquareOutBold size={12} />
                          Jira
                        </Link>
                        <Link
                          href={`/connect?q=linear`}
                          title="Create Linear issue from this finding"
                          style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '7px 12px', fontSize: 12, fontWeight: 600,
                            borderRadius: 8, border: '1px solid rgba(139,92,246,0.25)',
                            background: 'rgba(139,92,246,0.06)', color: '#8b5cf6',
                            textDecoration: 'none', whiteSpace: 'nowrap',
                          }}
                        >
                          <PiArrowSquareOutBold size={12} />
                          Linear
                        </Link>
                      </div>
                    )}
                    <form action={dismissFormAction}>
                      <input type="hidden" name="id" value={action.id} />
                      <button className="ds-btn-dismiss" type="submit" style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <PiXCircleBold size={14} />
                        Dismiss
                      </button>
                    </form>
                    <form action={approveFormAction}>
                      <input type="hidden" name="id" value={action.id} />
                      <button className="ds-btn-approve" type="submit" style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <PiLightningBold size={14} />
                        Approve & Execute
                      </button>
                    </form>
                  </div>
                </div>

                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                  <PiClockBold size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                  Received {new Date(action.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Recent history */}
      {(recent?.length ?? 0) > 0 && (
        <section>
          <h2 className="ds-section-label" style={{ marginBottom: 16 }}>Recent History</h2>
          <div className="ds-stat-card" style={{ padding: 0, overflow: 'hidden' }}>
            {recent!.map((a: any, i: number) => (
              <div key={a.id} style={{
                padding: '14px 24px',
                borderBottom: i < recent!.length - 1 ? '1px solid var(--border)' : 'none',
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
              }}>
                <span style={{
                  padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                  textTransform: 'capitalize',
                  background: a.status === 'executed' ? 'rgba(16,185,129,0.1)' : a.status === 'approved' ? 'rgba(59,130,246,0.1)' : 'rgba(107,114,128,0.1)',
                  color: a.status === 'executed' ? 'var(--green)' : a.status === 'approved' ? 'var(--blue)' : 'var(--text-muted)',
                }}>{a.status}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {TOOLKIT_LABELS[a.composio_toolkit] ?? a.composio_toolkit}
                </span>
                <p style={{ flex: 1, margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {a.us_findings?.summary ?? a.composio_action}
                </p>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {new Date(a.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
