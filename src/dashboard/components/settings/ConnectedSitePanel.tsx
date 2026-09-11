'use client'

import { useState } from 'react'
import { Server, Globe, PowerOff } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function ConnectedSitePanel({ client }: { client: any }) {
  const router = useRouter()
  const [disconnecting, setDisconnecting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const handleDisconnect = async () => {
    // Tesla Reduce Clicks: No confirmation modal, just single click and instant disconnect
    setDisconnecting(true)
    try {
      const res = await fetch('/api/integrations/site/disconnect', { method: 'POST' })
      if (res.ok) {
        setToast('Site disconnected')
        setTimeout(() => setToast(null), 3000)
        router.refresh()
      } else {
        setToast('Failed to disconnect')
        setTimeout(() => setToast(null), 3000)
        setDisconnecting(false)
      }
    } catch (err) {
      setToast('Failed to disconnect')
      setTimeout(() => setToast(null), 3000)
      setDisconnecting(false)
    }
  }

  return (
    <section className="ds-stat-card" style={{ display: 'flex', flexDirection: 'column', gap: 24, position: 'relative' }}>
      
      {/* Toast Overlay */}
      {toast && (
        <div style={{
          position: 'absolute', top: 16, right: 16, background: '#10b981', color: '#fff', 
          padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600,
          animation: 'fade-in 0.2s ease-out'
        }}>
          ✓ {toast}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'rgba(59,130,246,0.07)',
          border: '1px solid rgba(59,130,246,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Globe size={16} color="var(--blue)" strokeWidth={1.5} />
        </div>
        <h2 className="ds-section-label" style={{ margin: 0 }}>Connected Site</h2>
      </div>

      {!client?.client_domain ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, background: 'rgba(59,130,246,0.03)', border: '1px dashed rgba(59,130,246,0.2)', borderRadius: 12 }}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
            No site is currently connected. Install the tracking snippet to start capturing sessions.
          </p>
          <div>
            <button onClick={() => router.push('/onboarding')} className="ds-btn-approve" style={{ padding: '8px 16px', fontSize: '12px' }}>
              Connect Site
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Domain</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{client.client_domain}</span>
            </div>
            {client.script_installed_at ? (
              <span className="ds-status ds-status--approved">Active</span>
            ) : (
              <span className="ds-status ds-status--pending">Pending verification</span>
            )}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Public Capture Key</span>
              <code style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'var(--bg-canvas)', padding: '2px 6px', borderRadius: 4 }}>
                {client.capture_public_key}
              </code>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Audit Status</span>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                {client.audit_status || 'Not started'}
              </span>
            </div>
            
            <button 
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="ds-btn-dismiss" 
              style={{ padding: '8px 16px', fontSize: '12px', color: '#ef4444', borderColor: 'rgba(220,38,38,0.4)', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <PowerOff size={14} />
              {disconnecting ? 'Disconnecting...' : 'Disconnect Site'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
