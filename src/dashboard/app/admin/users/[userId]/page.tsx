import { notFound } from 'next/navigation'
import { audit, requireAdmin } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/server'
import { limitsFor } from '@/lib/tiers'
import { forceDeleteUser, setPlan, setSubscriptionStatus, suspendUser, unsuspendUser } from '../../actions'

export default async function AdminViewAsPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { user: admin } = await requireAdmin()
  const { userId } = await params
  const db = createServiceClient()

  const { data: target } = await db
    .from('profiles')
    .select('id, email, plan, subscription_status, role, created_at, suspended_at')
    .eq('id', userId)
    .maybeSingle()
  if (!target) notFound()

  await audit(admin.id, 'view_as', userId, null)

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const { data: client } = await db.from('us_clients').select('id').eq('profile_id', userId).maybeSingle()
  const clientId = client?.id

  const [{ count: sessionTotal }, { count: actionsThisMonth }, { data: recentActions }] =
    await Promise.all([
      db.from('us_sessions').select('*', { count: 'exact', head: true }).eq('client_id', clientId),
      db.from('us_actions').select('*', { count: 'exact', head: true }).eq('client_id', clientId).gte('created_at', startOfMonth),
      db.from('us_actions').select('id, composio_action, status, created_at').eq('client_id', clientId).order('created_at', { ascending: false }).limit(10),
    ])

  const planLimits = limitsFor(target.plan)
  const actionsUsed = actionsThisMonth ?? 0
  const actionsTotal = planLimits.actionsIncluded

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      <div className="ds-stat-card" style={{ padding: '16px 24px', borderColor: '#d97706' }}>
        <p style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#d97706', margin: 0 }}>
          Admin view — {target.email} · all actions are audit-logged
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 'var(--space-md)' }}>
        <div className="ds-stat-card">
          <p style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 8px' }}>Total Sessions</p>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--text-primary)', margin: 0 }}>{sessionTotal ?? 0}</p>
        </div>
        <div className="ds-stat-card">
          <p style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 8px' }}>This Month</p>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--text-primary)', margin: 0 }}>{actionsUsed} / {actionsTotal}</p>
        </div>
        <div className="ds-stat-card">
          <p style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 8px' }}>Plan</p>
          <p className="font-mono-data">{target.plan} · {target.subscription_status}</p>
        </div>
      </div>

      {/* Plan Override */}
      <div className="ds-stat-card flex flex-col" style={{ gap: '16px' }}>
        <p className="font-mono-label">Override Plan</p>
        <form action={setPlan} className="flex" style={{ gap: '8px', flexWrap: 'wrap' }}>
          <input type="hidden" name="userId" value={target.id} />
          <select name="plan" defaultValue={target.plan} className="input-dash" style={{ width: 'auto', padding: '6px 10px' }}>
            {['free', 'starter', 'pro', 'business', 'enterprise'].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button className="btn-dash-secondary" type="submit">Set plan</button>
        </form>

        <form action={setSubscriptionStatus} className="flex" style={{ gap: '8px', flexWrap: 'wrap' }}>
          <input type="hidden" name="userId" value={target.id} />
          <select name="status" defaultValue={target.subscription_status ?? 'none'} className="input-dash" style={{ width: 'auto', padding: '6px 10px' }}>
            {['none', 'active', 'non_renewing', 'attention', 'cancelled'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button className="btn-dash-secondary" type="submit">Set status</button>
        </form>
      </div>

      {/* Recent Actions */}
      <div className="ds-stat-card" style={{ padding: '24px' }}>
        <p className="font-mono-label" style={{ marginBottom: '16px' }}>Recent actions</p>
        {(recentActions ?? []).length === 0 ? (
          <p className="font-sans-body">No actions yet.</p>
        ) : (
          (recentActions ?? []).map((v, i) => (
            <div key={i} className="flex" style={{ gap: '16px', borderTop: '1px solid var(--line)', padding: '10px 0', flexWrap: 'wrap' }}>
              <span className="font-mono-data" style={{ flex: 1 }}>{v.composio_action || v.id}</span>
              <span className="font-mono-data">{v.status}</span>
              <span className="font-mono-micro">{new Date(v.created_at).toISOString().slice(0, 10)}</span>
            </div>
          ))
        )}
      </div>

      {/* Danger zone — force delete (admins can never be deleted) */}
      {target.role !== 'admin' && (
        <div className="ds-stat-card flex flex-col" style={{ gap: '12px', borderColor: '#dc2626' }}>
          <p style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#dc2626', margin: 0 }}>Danger zone</p>
          
          <div style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
            <p className="font-sans-body" style={{ marginBottom: '12px' }}>
              Suspending a user blocks API access and future sign-ins.
            </p>
            {target.suspended_at ? (
              <form action={unsuspendUser} className="flex" style={{ gap: '8px', alignItems: 'center' }}>
                <input type="hidden" name="userId" value={target.id} />
                <button className="btn-dash-secondary" type="submit">Unsuspend User</button>
                <span className="font-mono-micro" style={{ color: '#dc2626' }}>Suspended on {new Date(target.suspended_at).toLocaleDateString()}</span>
              </form>
            ) : (
              <form action={suspendUser} className="flex" style={{ gap: '8px', flexWrap: 'wrap' }}>
                <input type="hidden" name="userId" value={target.id} />
                <input name="reason" placeholder="Reason for suspension" className="input-dash" style={{ minWidth: 260 }} required />
                <button className="btn-dash-secondary" style={{ color: '#d97706', borderColor: 'rgba(217,119,6,0.3)' }} type="submit">Suspend User</button>
              </form>
            )}
          </div>

          <div style={{ paddingTop: '4px' }}>
            <p className="font-sans-body" style={{ marginBottom: '12px' }}>
              Force delete permanently removes this user, their sessions, actions, and all account data via
              cascade. This cannot be undone. Type the user's email exactly to confirm.
            </p>
            <form action={forceDeleteUser} className="flex" style={{ gap: '8px', flexWrap: 'wrap' }}>
              <input type="hidden" name="userId" value={target.id} />
              <input name="confirmEmail" placeholder={target.email ?? 'user email'} className="input-dash" style={{ minWidth: 260 }} required />
              <button className="btn-dash-secondary" style={{ color: '#dc2626', borderColor: 'rgba(220,38,38,0.3)' }} type="submit">Force delete user</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
