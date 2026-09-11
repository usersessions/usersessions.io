'use client'

import { useEffect, useState } from 'react'
import { motion } from "motion/react"
import { createClient } from '@/lib/supabase/client'

const SPRING = { type: 'spring', bounce: 0, duration: 0.35 } as const

interface PatchStats {
  id: string
  patch_id: string
  status: string // 'monitoring', 'safe', 'rollback'
  control_group_size: number
  canary_group_size: number
  control_conversion_rate: number
  canary_conversion_rate: number
  control_error_rate: number
  canary_error_rate: number
}

export function CanaryLivePanel({ patchId }: { patchId: string }) {
  const [stats, setStats] = useState<PatchStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    const load = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('us_ui_patches')
        .select('id, patch_id, status, control_group_size, canary_group_size, control_conversion_rate, canary_conversion_rate, control_error_rate, canary_error_rate')
        .eq('patch_id', patchId)
        .single()
      
      if (data) setStats(data as PatchStats)
      setLoading(false)
    }

    load()

    const channel = supabase
      .channel(`patch_canary_${patchId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'us_ui_patches', filter: `patch_id=eq.${patchId}` }, (payload) => {
        setStats(prev => ({ ...prev, ...(payload.new as unknown as PatchStats) }))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [patchId])

  if (loading) return (
    <div style={{ padding: 16, border: '1px solid var(--border-dark)', borderRadius: 12, background: 'var(--glass-bg)', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--text-secondary)', animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: 13, color: 'var(--muted)' }}>Connecting to live telemetry…</span>
    </div>
  )

  if (!stats) return null

  const isSafe = stats.status === 'safe'
  const isRollback = stats.status === 'rollback'
  const isMonitoring = stats.status === 'monitoring'

  const convDiff = stats.canary_conversion_rate - stats.control_conversion_rate
  const errDiff = stats.canary_error_rate - stats.control_error_rate

  return (
    <div style={{ padding: 20, border: '1px solid var(--border-dark)', borderRadius: 12, background: 'var(--glass-bg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Live Canary Rollout</h4>
        
        {/* Status Badge */}
        <div style={{ 
          padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
          background: isSafe ? 'rgba(52,211,153,0.1)' : isRollback ? 'rgba(248,113,113,0.1)' : 'rgba(251,191,36,0.1)',
          color: isSafe ? 'rgba(52,211,153,0.9)' : isRollback ? '#f87171' : 'rgba(251,191,36,0.9)',
          border: `1px solid ${isSafe ? 'rgba(52,211,153,0.3)' : isRollback ? 'rgba(248,113,113,0.3)' : 'rgba(251,191,36,0.3)'}`,
          display: 'flex', alignItems: 'center', gap: 6
        }}>
          {isMonitoring && <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />}
          {isSafe ? 'Safe / Promoted' : isRollback ? 'Auto-Rollback' : 'Monitoring…'}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 32 }}>
        {/* Group sizes */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Traffic Split</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
              <span style={{ color: 'var(--text-primary)' }}>Control</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{stats.control_group_size.toLocaleString()} users</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
              <span style={{ color: 'var(--text-primary)' }}>Canary</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--orange)' }}>{stats.canary_group_size.toLocaleString()} users</span>
            </div>
          </div>
        </div>

        {/* Conversion */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Conversion Rate</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 20, fontFamily: 'var(--font-mono)' }}>{(stats.canary_conversion_rate * 100).toFixed(1)}%</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              vs {(stats.control_conversion_rate * 100).toFixed(1)}% control
              <span style={{ color: convDiff >= 0 ? 'rgba(52,211,153,0.9)' : '#f87171', marginLeft: 8 }}>
                {convDiff >= 0 ? '+' : ''}{(convDiff * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Errors */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Error Rate</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 20, fontFamily: 'var(--font-mono)' }}>{(stats.canary_error_rate * 100).toFixed(2)}%</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              vs {(stats.control_error_rate * 100).toFixed(2)}% control
              <span style={{ color: errDiff <= 0 ? 'rgba(52,211,153,0.9)' : '#f87171', marginLeft: 8 }}>
                {errDiff > 0 ? '+' : ''}{(errDiff * 100).toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
