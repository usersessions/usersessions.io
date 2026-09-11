'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type Result = { category: string; id: string; label: string; href: string }

/**
 * "View as user" — finds a user and opens their admin detail view, audit-logged.
 * True session impersonation needs dedicated auth infrastructure; do not fake it.
 */
export default function ImpersonateModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [users, setUsers] = useState<Result[]>([])

  useEffect(() => {
    if (q.trim().length < 2) {
      setUsers([])
      return
    }
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`)
        if (!res.ok) return
        const body = (await res.json()) as { results?: Result[] }
        setUsers((body.results ?? []).filter((r) => r.category === 'Users'))
      } catch {
        // retry on next keystroke
      }
    }, 300)
    return () => clearTimeout(id)
  }, [q])

  function view(user: Result) {
    void fetch('/api/admin/quick-action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'impersonate_view', detail: { user_id: user.id } }),
    }).catch(() => {})
    onClose()
    router.push(user.href)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Impersonate user"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 'var(--space-xl)' }}
    >
      <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 480 }}>
        <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
          <p className="font-mono-label">Impersonate user</p>
          <button className="btn-ghost" type="button" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by email or name…"
          className="font-mono-micro"
          style={{ width: '100%', background: '#ffffff', border: '1px solid var(--border)', borderRadius: 'var(--rounded-sm)', color: 'var(--text-primary)', padding: 'var(--space-sm)' }}
        />
        <div className="flex flex-col" style={{ marginTop: 'var(--space-sm)' }}>
          {users.map((u) => (
            <button
              key={u.id}
              type="button"
              className="font-sans-label"
              onClick={() => view(u)}
              style={{ textAlign: 'left', background: 'transparent', border: 'none', borderTop: '1px solid var(--border)', color: 'var(--text-primary)', padding: 'var(--space-sm) 0', cursor: 'pointer' }}
            >
              {u.label}
            </button>
          ))}
          {q.trim().length >= 2 && users.length === 0 ? <p className="font-mono-micro">No matching users.</p> : null}
        </div>
        <p className="font-mono-micro" style={{ marginTop: 'var(--space-md)', color: 'var(--muted)' }}>
          Opens the user's admin view (audit-logged). Session-level impersonation requires auth infra.
        </p>
      </div>
    </div>
  )
}
