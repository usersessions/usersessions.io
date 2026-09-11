'use client'

import { useState } from 'react'
import { PiCheckCircleBold, PiWarningCircleBold, PiClockBold, PiLightningBold, PiXCircleBold } from 'react-icons/pi'

// Stage pipeline: shadow → canary → live | rolled_back
const STAGES = ['shadow', 'canary', 'live'] as const

const STAGE_META: Record<string, { label: string; color: string; bg: string; borderColor: string }> = {
  shadow:      { label: 'Shadow',    color: '#6366f1', bg: 'rgba(99,102,241,0.1)',   borderColor: 'rgba(99,102,241,0.25)' },
  canary:      { label: 'Canary',    color: '#f97316', bg: 'rgba(249,115,22,0.1)',   borderColor: 'rgba(249,115,22,0.25)' },
  live:        { label: 'Live',      color: '#22c55e', bg: 'rgba(34,197,94,0.1)',    borderColor: 'rgba(34,197,94,0.25)' },
  rolled_back: { label: 'Rolled Back', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)' },
  disabled:    { label: 'Disabled',  color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', borderColor: 'rgba(148,163,184,0.2)' },
}

type Patch = {
  id: string
  patch_type: string
  target_selector: string
  status: string
  canary_percentage: number
  created_at: string
  canary_started_at?: string
  promoted_to_live_at?: string
  rolled_back_at?: string
  patch_payload?: any
}

function StagePip({ status }: { status: string }) {
  const stageIdx = STAGES.indexOf(status as any)
  if (status === 'rolled_back') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <PiXCircleBold size={14} color="#ef4444" />
        <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Rolled Back</span>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {STAGES.map((stage, i) => {
        const isActive = i === stageIdx
        const isDone = i < stageIdx
        const meta = STAGE_META[stage]
        return (
          <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{
              padding: '3px 8px',
              borderRadius: 20,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase' as const,
              background: isActive ? meta.bg : isDone ? 'rgba(34,197,94,0.08)' : 'var(--bg-canvas)',
              color: isActive ? meta.color : isDone ? '#22c55e' : 'var(--text-muted)',
              border: `1px solid ${isActive ? meta.borderColor : isDone ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`,
              opacity: isActive ? 1 : isDone ? 0.8 : 0.4,
            }}>
              {isDone ? '✓ ' : ''}{meta.label}
            </div>
            {i < STAGES.length - 1 && (
              <span style={{ color: 'var(--text-muted)', fontSize: 10, opacity: 0.5 }}>›</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function PatchList({ patches, clientId }: { patches: Patch[], clientId: string }) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [localPatches, setLocalPatches] = useState(patches)

  const doAction = async (patchId: string, action: string) => {
    setLoadingId(patchId)
    try {
      const res = await fetch('/api/patches/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patchId, action, clientId }),
      })
      const json = await res.json()
      if (json.status) {
        setLocalPatches(prev => prev.map(p => p.id === patchId ? { ...p, status: json.status } : p))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="ds-stat-card" style={{ padding: 0, overflow: 'hidden' }}>
      {localPatches.map((patch, i) => {
        const isLoading = loadingId === patch.id
        const canPromote = patch.status === 'shadow' || patch.status === 'canary'
        const canKill = ['shadow', 'canary', 'live'].includes(patch.status)
        const promoteAction = patch.status === 'shadow' ? 'promote_to_canary' : 'promote_to_live'
        const promoteLabel = patch.status === 'shadow' ? 'Start Canary' : 'Promote to Live'
        const summary = patch.patch_payload?.description ?? patch.target_selector

        return (
          <div key={patch.id} style={{
            padding: '18px 24px',
            borderBottom: i < localPatches.length - 1 ? '1px solid var(--border)' : 'none',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              {/* Stage Pipeline */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <StagePip status={patch.status} />
                <p style={{
                  margin: '8px 0 4px',
                  fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
                  lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {summary}
                </p>
                <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                  <PiLightningBold size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  {patch.patch_type}
                  {patch.status === 'canary' && patch.canary_percentage != null && (
                    <span style={{ marginLeft: 8, color: 'var(--orange)' }}>{patch.canary_percentage}% traffic</span>
                  )}
                </p>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                {canPromote && (
                  <button
                    onClick={() => doAction(patch.id, promoteAction)}
                    disabled={isLoading}
                    style={{
                      padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      background: 'rgba(34,197,94,0.1)', color: '#22c55e',
                      border: '1px solid rgba(34,197,94,0.25)', transition: 'all 150ms',
                      opacity: isLoading ? 0.6 : 1,
                    }}
                  >
                    {isLoading ? '…' : promoteLabel}
                  </button>
                )}
                {canKill && (
                  <button
                    onClick={() => doAction(patch.id, 'kill')}
                    disabled={isLoading}
                    style={{
                      padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                      border: '1px solid rgba(239,68,68,0.2)', transition: 'all 150ms',
                      opacity: isLoading ? 0.6 : 1,
                    }}
                  >
                    {patch.status === 'live' ? 'Roll back' : 'Kill'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
