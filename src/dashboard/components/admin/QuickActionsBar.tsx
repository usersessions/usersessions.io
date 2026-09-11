'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import ExportModal from './ExportModal'
import ImpersonateModal from './ImpersonateModal'

function logAction(action: string, detail?: unknown) {
  void fetch('/api/admin/quick-action', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, detail }),
  }).catch(() => {})
}

// Common admin operations, one click away. Every action is audit-logged.
export default function QuickActionsBar() {
  const router = useRouter()
  const [modal, setModal] = useState<'impersonate' | 'export' | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  function say(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 5000)
  }

  async function runAdapterCheck() {
    logAction('adapter_check')
    say('Running adapter health check…')
    try {
      const res = await fetch('/api/admin/cron/trigger', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ job: 'adapter-health' }),
      })
      say(res.ok ? 'Adapter check completed.' : 'Adapter check failed — see cron table.')
    } catch {
      say('Adapter check failed — network error.')
    }
    router.refresh()
  }

  async function securityCheck() {
    logAction('security_check')
    try {
      const res = await fetch('/api/admin/health')
      if (!res.ok) throw new Error()
      const { health } = (await res.json()) as { health: Record<string, { status: string }> }
      const attention = Object.entries(health).filter(([, v]) => v.status !== 'live').map(([k]) => k)
      say(attention.length === 0 ? 'Security check: all systems nominal.' : `Attention needed: ${attention.join(', ')}`)
    } catch {
      say('Security check failed to run.')
    }
  }

  return (
    <>
      <div 
        className="ds-stat-card flex" 
        style={{ 
          gap: '8px', 
          flexWrap: 'wrap',
          padding: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px' }}>
          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>Quick Actions</span>
        </div>
        <div style={{ width: '1px', background: 'var(--glass-bg-hover)', margin: '0 4px' }} />
        
        <button 
          type="button" 
          onClick={() => { logAction('impersonate_open'); setModal('impersonate') }}
          style={actionBtnStyle}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-canvas)'; e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)' }}
        >
          Impersonate
        </button>

        <button 
          type="button" 
          onClick={runAdapterCheck}
          style={actionBtnStyle}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-canvas)'; e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)' }}
        >
          Adapter Check
        </button>
        <button 
          type="button" 
          onClick={() => { logAction('export_open'); setModal('export') }}
          style={actionBtnStyle}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-canvas)'; e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)' }}
        >
          Export Data
        </button>
        <button 
          type="button" 
          onClick={securityCheck}
          style={actionBtnStyle}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-canvas)'; e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)' }}
        >
          Security Check
        </button>
        <button 
          type="button" 
          onClick={() => { logAction('refresh_all'); router.refresh(); say('Data refreshed.') }}
          style={{ ...actionBtnStyle, marginLeft: 'auto' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-canvas)'; e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)' }}
        >
          Refresh All
        </button>
      </div>
      {toast ? (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
          <p role="status" style={{ 
            fontFamily: 'var(--font-mono, monospace)', 
            fontSize: '11px', 
            color: 'var(--text-primary)',
            background: 'var(--orange)',
            padding: '4px 12px',
            borderRadius: '12px',
            boxShadow: '0 0 12px rgba(229, 90, 0, 0.4)'
          }}>
            {toast}
          </p>
        </div>
      ) : null}
      {modal === 'impersonate' ? <ImpersonateModal onClose={() => setModal(null)} /> : null}
      {modal === 'export' ? <ExportModal onClose={() => setModal(null)} /> : null}
    </>
  )
}

const actionBtnStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono, monospace)',
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.02em',
  color: 'var(--muted)',
  padding: '8px 16px',
  background: 'transparent',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  outline: 'none',
}
