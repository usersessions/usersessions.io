'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'

export default function UserTableRow({ 
  u, 
  setPlanAction, 
  setStatusAction, 
  unsuspendAction, 
  suspendAction 
}: any) {
  const [isPending, startTransition] = useTransition()
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const showSaveMessage = (msg: string) => {
    setSaveMessage(msg)
    setTimeout(() => setSaveMessage(null), 3000)
  }

  const handlePlanChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    const formData = new FormData()
    formData.append('userId', u.id)
    formData.append('plan', val)
    startTransition(async () => {
      await setPlanAction(formData)
      showSaveMessage('Plan updated')
    })
  }

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    const formData = new FormData()
    formData.append('userId', u.id)
    formData.append('status', val)
    startTransition(async () => {
      await setStatusAction(formData)
      showSaveMessage('Status updated')
    })
  }

  return (
    <div 
      className="flex items-center group admin-list-row" 
      style={{ 
        gap: '16px', 
        borderBottom: '1px solid var(--border)', 
        padding: '16px 24px', 
        flexWrap: 'wrap',
        transition: 'background 0.15s ease',
        position: 'relative'
      }}
    >
      {/* Toast Overlay */}
      {saveMessage && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(16, 185, 129, 0.9)',
          color: '#fff',
          padding: '4px 12px',
          borderRadius: '12px',
          fontSize: '11px',
          fontFamily: 'var(--font-mono, monospace)',
          fontWeight: 600,
          zIndex: 10,
          pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
        }}>
          {saveMessage} ✓
        </div>
      )}

      <span style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--glass-bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600 }}>
          {u.email.substring(0, 2).toUpperCase()}
        </div>
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '13px', color: 'var(--text-primary)' }}>
          {u.email}
        </span>
        {u.role === 'admin' && (
          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '10px', letterSpacing: '0.08em', color: 'var(--orange)', background: 'rgba(229, 90, 0, 0.1)', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(229, 90, 0, 0.2)' }}>admin</span>
        )}
      </span>

      {/* Plan override — audited */}
      <div style={{ width: 140 }}>
        <select 
          name="plan" 
          defaultValue={u.plan} 
          disabled={isPending}
          onChange={handlePlanChange}
          style={{ 
            background: 'transparent',
            border: '1px solid transparent',
            color: 'var(--muted)',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '12px',
            padding: '6px 0',
            outline: 'none',
            cursor: isPending ? 'wait' : 'pointer',
            width: '100%',
            opacity: isPending ? 0.5 : 1
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)' }}
        >
          {['free', 'starter', 'pro', 'business', 'enterprise'].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Subscription status override (incl. suspension) — audited */}
      <div style={{ width: 160 }}>
        <select 
          name="status" 
          defaultValue={u.subscription_status} 
          disabled={isPending}
          onChange={handleStatusChange}
          style={{ 
            background: 'transparent',
            border: '1px solid transparent',
            color: 'var(--muted)',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '12px',
            padding: '6px 0',
            outline: 'none',
            cursor: isPending ? 'wait' : 'pointer',
            width: '100%',
            opacity: isPending ? 0.5 : 1
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)' }}
        >
          {['none', 'active', 'non_renewing', 'attention', 'cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div style={{ width: 180, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
        {u.suspended_at && <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '10px', color: 'var(--red)', padding: '2px 8px', background: 'rgba(220,38,38,0.1)', borderRadius: '12px' }}>suspended</span>}
        {u.role !== 'admin' &&
          (u.suspended_at ? (
            <form action={unsuspendAction}>
              <input type="hidden" name="userId" value={u.id} />
              <button type="submit" style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '11px', fontFamily: 'var(--font-mono, monospace)', cursor: 'pointer' }} onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }} onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)' }}>Unsuspend</button>
            </form>
          ) : (
            <form action={suspendAction}>
              <input type="hidden" name="userId" value={u.id} />
              <button type="submit" style={{ background: 'transparent', border: 'none', color: 'var(--red)', fontSize: '11px', fontFamily: 'var(--font-mono, monospace)', cursor: 'pointer', opacity: 0.7 }} onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }} onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7' }}>Suspend</button>
            </form>
          ))}
        <Link style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', color: 'var(--orange)', fontWeight: 600, textDecoration: 'none' }} href={`/admin/users/${u.id}`}>
          view →
        </Link>
      </div>
    </div>
  )
}

