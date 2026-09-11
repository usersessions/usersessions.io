'use client'

import { useCallback, useEffect, useState } from 'react'
import AdminAlertItem, { type AdminAlert } from './AdminAlertItem'

// Sticky, collapsible alert feed. Polls every 5s so a test alert lands within
// the Alert Gate window. Renders nothing when there is nothing to say.
export default function AdminAlertFeed() {
  const [alerts, setAlerts] = useState<AdminAlert[]>([])
  const [open, setOpen] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/alerts')
      if (!res.ok) return
      const body = (await res.json()) as { alerts?: AdminAlert[] }
      setAlerts(body.alerts ?? [])
    } catch {
      // keep last known state; next poll retries
    }
  }, [])

  useEffect(() => {
    void load()
    const id = setInterval(() => void load(), 5000)
    return () => clearInterval(id)
  }, [load])

  async function dismiss(id: string) {
    setAlerts((all) => all.filter((a) => a.id !== id))
    await fetch('/api/admin/alerts', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {})
  }

  if (alerts.length === 0) return null

  const hasCritical = alerts.some((a) => a.severity === 'critical')
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 20 }}>
      <div 
        className="ds-stat-card"
        style={{ 
          border: `1px solid ${hasCritical ? 'rgba(220,38,38,0.3)' : 'var(--border)'}`,
          boxShadow: hasCritical ? '0 0 24px rgba(220,38,38,0.1)' : '0 4px 20px rgba(0,0,0,0.1)',
          padding: '16px 20px',
        }}
      >
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          style={{ 
            background: 'transparent', 
            border: 'none', 
            cursor: 'pointer', 
            padding: 0, 
            fontFamily: 'var(--font-mono, monospace)', 
            fontSize: '11px', 
            fontWeight: 700, 
            letterSpacing: '0.1em', 
            textTransform: 'uppercase', 
            color: hasCritical ? '#dc2626' : 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          Alerts ({alerts.length})
          <span style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            width: '20px', 
            height: '20px', 
            background: 'var(--bg-primary)', 
            borderRadius: '4px',
            transition: 'transform 0.2s ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0)'
          }}>
            ▾
          </span>
        </button>
        {open ? (
          <div className="flex flex-col" style={{ marginTop: '16px' }}>
            {alerts.map((a) => (
              <AdminAlertItem key={a.id} alert={a} onDismiss={dismiss} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
