'use client'

import { useEffect, useState } from 'react'
import { motion } from "motion/react"
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PiUsersBold, PiCursorClickBold, PiFlameBold, PiLockKeyBold, PiTrendUpBold } from 'react-icons/pi'
import { ActivityPulse } from '@/components/queue/ActivityPulse'
import NumberFlow from '@number-flow/react'
import { TrendChart } from './TrendChart'

interface SiteAnalyticsPanelProps {
  clientId: string | null
  isAtLeastStarter: boolean
  stats: {
    sessions: number
    rageClicks: number
  }
  chartData: { date: string; sessions: number; friction: number }[]
}

export function SiteAnalyticsPanel({ clientId, isAtLeastStarter, stats, chartData }: SiteAnalyticsPanelProps) {
  const [activeUsers, setActiveUsers] = useState(0)

  // Subscribing to active sessions
  useEffect(() => {
    if (!clientId) return
    const supabase = createClient()
    
    const fetchActive = async () => {
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const { count } = await supabase
        .from('us_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .gte('created_at', fiveMinsAgo)
      
      if (count !== null) setActiveUsers(count)
    }
    fetchActive()

    const channel = supabase
      .channel('public:us_sessions')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'us_sessions', filter: `client_id=eq.${clientId}` }, () => {
        setActiveUsers(prev => prev + 1)
      })
      .subscribe()

    const interval = setInterval(fetchActive, 30000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [clientId])



  if (!clientId) {
    return null;
  }

  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 className="ds-section-label" style={{ margin: 0, fontSize: 16 }}>Site Analytics</h2>
        {isAtLeastStarter ? (
          <Link href="/sessions" style={{ fontSize: 13, color: 'var(--blue)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            Explore Heatmaps &rarr;
          </Link>
        ) : (
          <Link href="/billing" style={{ fontSize: 13, color: 'var(--orange)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <PiLockKeyBold /> Unlock Heatmaps &rarr;
          </Link>
        )}
      </div>

      <div style={{ display: 'flex', gap: 16, flexDirection: 'column' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {/* Real-time users */}
          <div style={{ padding: '20px 24px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <ActivityPulse active={activeUsers > 0} />
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Live Now
              </span>
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <NumberFlow value={activeUsers} />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>visitors</span>
            </div>
          </div>

          {/* Monthly Sessions */}
          <div style={{ padding: '20px 24px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <PiUsersBold size={16} color="var(--text-secondary)" />
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Sessions (30d)
              </span>
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-primary)' }}>
              <NumberFlow value={stats.sessions} />
            </div>
          </div>

          {/* Rage Clicks */}
          <div style={{ padding: '20px 24px', borderRadius: 12, background: 'rgba(239,68,68,0.03)', border: '1px solid rgba(239,68,68,0.15)', boxShadow: '0 4px 20px rgba(239,68,68,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <PiFlameBold size={16} color="#ef4444" />
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Friction Sessions
              </span>
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-primary)' }}>
              <NumberFlow value={stats.rageClicks} />
            </div>
          </div>
        </div>

        {/* Trend Chart */}
        <div style={{ padding: '24px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
            <PiTrendUpBold size={16} color="var(--text-secondary)" />
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Traffic vs Friction Over Time
            </span>
          </div>
          <TrendChart data={chartData} />
        </div>
      </div>
    </div>
  )
}
