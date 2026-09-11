'use client'

import { useState } from 'react'
import { useFeatureAccess } from '@/hooks/useFeatureAccess'
import { UpgradeModal } from '@/components/UpgradeModal'
export function TeamManagementView({ plan }: { plan: string }) {
  const access = useFeatureAccess(plan)
  const [upgradeFor, setUpgradeFor] = useState<string | null>(null)
  
  // Hardcoded for now until we have a real team table
  const members = [
    { id: '1', name: 'You (Owner)', email: 'owner@example.com', role: 'admin' }
  ]
  
  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault()
    if (members.length >= access.maxTeamSeats) {
      setUpgradeFor('Team Seats')
    } else {
      alert('Invitation sent! (Mock)')
    }
  }

  const usagePercent = Math.min((members.length / access.maxTeamSeats) * 100, 100)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 48, maxWidth: 880, margin: '0 auto', width: '100%' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <h1 className="ds-page-title">Team Management</h1>
          <p className="ds-page-sub">
            Invite members to collaborate on findings, actions, and approvals.
          </p>
        </div>
      </header>
      
      <section className="ds-stat-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 className="ds-section-label">Seat Usage</h2>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>
            {members.length} / {access.maxTeamSeats === Infinity ? 'Unlimited' : access.maxTeamSeats} seats used
          </span>
        </div>
        
        {/* Progress bar */}
        <div style={{ width: '100%', height: 8, borderRadius: 999, overflow: 'hidden', background: 'var(--bg-canvas)' }}>
          <div 
            style={{ 
              height: '100%',
              borderRadius: 999,
              width: `${usagePercent}%`, 
              background: 'var(--orange)',
            }}
          />
        </div>
      </section>

      <section className="ds-stat-card" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <h2 className="ds-section-label">Invite Member</h2>
        <form onSubmit={handleInvite} style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200 }}>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>Email Address</label>
            <input 
              type="email" 
              placeholder="colleague@company.com" 
              required 
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid var(--glass-border-heavy)',
                fontSize: '13px',
                fontFamily: "'DM Sans', system-ui",
                background: 'rgba(0,0,0,0.2)',
                color: 'var(--text-primary)',
                transition: 'border-color 200ms ease',
                outline: 'none',
              }}
              onFocus={(e) => e.target.style.borderColor = 'rgba(252,163,17,0.5)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--glass-border-heavy)'}
            />
          </div>
          <button type="submit" className="ds-btn-approve" style={{ height: '42px', padding: '0 24px', fontSize: '13px' }}>
            Send Invite
          </button>
        </form>
      </section>

      <section className="ds-stat-card" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', background: 'var(--bg-canvas)', borderBottom: '1px solid var(--bg-canvas)' }}>
          <h2 className="ds-section-label">Active Members</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {members.map((m, i) => (
            <div key={m.id} style={{ 
              padding: '16px 24px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              borderTop: i > 0 ? '1px solid var(--bg-canvas)' : 'none'
            }}>
              <div>
              </div>
              <span style={{ 
                fontFamily: 'var(--font-mono)', 
                fontSize: '11px', 
                fontWeight: 600,
                padding: '4px 8px', 
                background: 'var(--glass-bg-hover)', 
                border: '1px solid var(--glass-border-heavy)', 
                borderRadius: '6px',
                color: 'var(--text-primary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                {m.role}
              </span>
            </div>
          ))}
        </div>
      </section>

      {upgradeFor && (
        <UpgradeModal
          open={true}
          featureName={upgradeFor}
          requiredPlan={plan === 'starter' ? 'pro' : 'enterprise'}
          currentPlan={plan}
          onClose={() => setUpgradeFor(null)}
        />
      )}
    </div>
  )
}
