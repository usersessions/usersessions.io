import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/server'
import { setPlan, setSubscriptionStatus, suspendUser, unsuspendUser } from '../actions'

import UserTableRow from '@/components/admin/UserTableRow'

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  await requireAdmin()
  const { q } = await searchParams
  const db = createServiceClient()

  let query = db
    .from('profiles')
    .select('id, email, plan, subscription_status, role, created_at, suspended_at')
    .order('created_at', { ascending: false })
    .limit(50)
  if (q) query = query.ilike('email', `%${q}%`)
  const { data: users } = await query

  return (
    <div className="flex flex-col" style={{ gap: '32px' }}>
      <h1 className="ds-page-title" style={{ margin: 0 }}>Users</h1>

      <form method="get" className="flex" style={{ gap: '8px' }}>
        <input name="q" defaultValue={q ?? ''} placeholder="search email" className="input-dash" style={{ maxWidth: 280 }} />
        <button className="btn-dash-secondary" type="submit">Search</button>
      </form>

      <div 
        className="ds-stat-card"
        style={{ 
          padding: 0,
          overflow: 'hidden'
        }}
      >
        <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-bg-hover)', padding: '16px 24px', background: 'rgba(255,255,255,0.01)' }}>
          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', flex: 1, minWidth: 200 }}>User</span>
          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', width: 140 }}>Plan</span>
          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', width: 160 }}>Status</span>
          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', width: 180, textAlign: 'right' }}>Actions</span>
        </div>

        {(users ?? []).map((u) => (
          <UserTableRow 
            key={u.id}
            u={u}
            setPlanAction={setPlan}
            setStatusAction={setSubscriptionStatus}
            unsuspendAction={unsuspendUser}
            suspendAction={suspendUser}
          />
        ))}
      </div>
    </div>
  )
}
