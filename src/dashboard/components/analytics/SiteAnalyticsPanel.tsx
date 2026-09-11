'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  PiUsersBold, PiFlameBold, PiLockKeyBold, PiTrendUpBold,
  PiArrowUpBold, PiArrowDownBold, PiMinusBold,
} from 'react-icons/pi'
import { ActivityPulse } from '@/components/queue/ActivityPulse'
import NumberFlow from '@number-flow/react'
import { TrendChart } from './TrendChart'

type Period = '7d' | '30d' | '90d'

interface PeriodData {
  sessions: number
  friction: number
  frictionRate: number
  chartData: { date: string; sessions: number; friction: number }[]
}

interface SiteAnalyticsPanelProps {
  clientId: string | null
  isAtLeastStarter: boolean
  stats: { sessions: number; rageClicks: number }
  chartData: { date: string; sessions: number; friction: number }[]
}

const PERIOD_DAYS: Record<Period, number> = { '7d': 7, '30d': 30, '90d': 90 }
const PERIOD_LABELS: Record<Period, string> = { '7d': '7 days', '30d': '30 days', '90d': '90 days' }

function buildChartDays(days: number, rows: { ingested_at: string; rage_click_count: number | null; error_count: number | null }[]) {
  const daily: Record<string, { sessions: number; friction: number }> = {}
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    daily[d.toISOString().split('T')[0]] = { sessions: 0, friction: 0 }
  }
  for (const s of rows) {
    const day = String(s.ingested_at).split('T')[0]
    if (daily[day]) {
      daily[day].sessions += 1
      if ((s.rage_click_count && s.rage_click_count > 0) || (s.error_count && s.error_count > 0)) {
        daily[day].friction += 1
      }
    }
  }
  return Object.keys(daily).sort().map(date => ({ date, sessions: daily[date].sessions, friction: daily[date].friction }))
}

function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>—</span>
  if (previous === 0) return <span style={{ fontSize: 11, color: 'var(--green)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 2 }}><PiArrowUpBold size={10} />new</span>

  const pct = Math.round(((current - previous) / previous) * 100)
  const up = pct >= 0
  const color = up ? 'var(--green)' : '#ef4444'

  return (
    <span style={{ fontSize: 11, color, fontFamily: 'var(--font-mono)', display: 'inline-flex', alignItems: 'center', gap: 2, fontWeight: 600 }}>
      {up ? <PiArrowUpBold size={9} /> : <PiArrowDownBold size={9} />}
      {Math.abs(pct)}%
    </span>
  )
}

export function SiteAnalyticsPanel({ clientId, isAtLeastStarter, stats: initialStats, chartData: initialChartData }: SiteAnalyticsPanelProps) {
  const [activeUsers, setActiveUsers] = useState(0)
  const [period, setPeriod] = useState<Period>('30d')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<PeriodData>({
    sessions: initialStats.sessions,
    friction: initialStats.rageClicks,
    frictionRate: initialStats.sessions > 0 ? Math.round((initialStats.rageClicks / initialStats.sessions) * 100) : 0,
    chartData: initialChartData,
  })
  const [prevData, setPrevData] = useState<PeriodData | null>(null)

  // Live visitor subscription
  useEffect(() => {
    if (!clientId) return
    const supabase = createClient()
    const fetchActive = async () => {
      const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const { count } = await supabase.from('us_sessions').select('*', { count: 'exact', head: true }).eq('client_id', clientId).gte('ingested_at', cutoff)
      if (count !== null) setActiveUsers(count)
    }
    fetchActive()
    const channel = supabase.channel('sessions:live').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'us_sessions', filter: `client_id=eq.${clientId}` }, () => setActiveUsers(p => p + 1)).subscribe()
    const iv = setInterval(fetchActive, 30_000)
    return () => { supabase.removeChannel(channel); clearInterval(iv) }
  }, [clientId])

  // Fetch data for selected period + previous period for delta
  const fetchPeriod = useCallback(async (p: Period) => {
    if (!clientId) return
    setLoading(true)
    const supabase = createClient()
    const days = PERIOD_DAYS[p]
    const now = Date.now()

    const [curFrom, prevFrom, prevTo] = [
      new Date(now - days * 86_400_000).toISOString(),
      new Date(now - 2 * days * 86_400_000).toISOString(),
      new Date(now - days * 86_400_000).toISOString(),
    ]

    const [curRes, prevRes] = await Promise.all([
      supabase.from('us_sessions').select('ingested_at, rage_click_count, error_count').eq('client_id', clientId).gte('ingested_at', curFrom),
      supabase.from('us_sessions').select('ingested_at, rage_click_count, error_count').eq('client_id', clientId).gte('ingested_at', prevFrom).lt('ingested_at', prevTo),
    ])

    const curRows = curRes.data ?? []
    const prevRows = prevRes.data ?? []

    const curSessions = curRows.length
    const curFriction = curRows.filter(s => (s.rage_click_count ?? 0) > 0 || (s.error_count ?? 0) > 0).length
    const prevSessions = prevRows.length
    const prevFriction = prevRows.filter(s => (s.rage_click_count ?? 0) > 0 || (s.error_count ?? 0) > 0).length

    setData({
      sessions: curSessions,
      friction: curFriction,
      frictionRate: curSessions > 0 ? Math.round((curFriction / curSessions) * 100) : 0,
      chartData: buildChartDays(days, curRows),
    })
    setPrevData({
      sessions: prevSessions,
      friction: prevFriction,
      frictionRate: prevSessions > 0 ? Math.round((prevFriction / prevSessions) * 100) : 0,
      chartData: [],
    })
    setLoading(false)
  }, [clientId])

  useEffect(() => { fetchPeriod(period) }, [period, fetchPeriod])

  if (!clientId) return null

  const PERIODS: Period[] = ['7d', '30d', '90d']

  return (
    <div>
      {/* ── Header row ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>
            Site Analytics
          </h2>

          {/* Period pills */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-primary, rgba(0,0,0,0.04))', borderRadius: 10, padding: '3px' }}>
            {PERIODS.map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  padding: '4px 11px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.04em', textTransform: 'uppercase',
                  background: period === p ? 'var(--surface, #fff)' : 'transparent',
                  color: period === p ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: period === p ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {isAtLeastStarter ? (
          <Link href="/sessions" style={{ fontSize: 12, color: 'var(--blue)', textDecoration: 'none', fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 5 }}>
            Explore Heatmaps →
          </Link>
        ) : (
          <Link href="/billing" style={{ fontSize: 12, color: 'var(--orange)', textDecoration: 'none', fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 5 }}>
            <PiLockKeyBold size={12} /> Unlock Heatmaps →
          </Link>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>

        {/* ── Stat cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {/* Live Now */}
          <div style={{
            padding: '18px 20px', borderRadius: 14, border: '1px solid var(--border)',
            background: activeUsers > 0
              ? 'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, var(--surface) 100%)'
              : 'var(--surface)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
              <ActivityPulse active={activeUsers > 0} />
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Live Now</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>
                <NumberFlow value={activeUsers} />
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>visitors</span>
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>past 5 min</div>
          </div>

          {/* Sessions */}
          <div style={{ padding: '18px 20px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
              <PiUsersBold size={13} color="var(--text-secondary)" />
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Sessions ({PERIOD_LABELS[period]})
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>
                <NumberFlow value={data.sessions} />
              </span>
            </div>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
              {prevData && <DeltaBadge current={data.sessions} previous={prevData.sessions} />}
              {prevData && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>vs prev {PERIOD_LABELS[period]}</span>}
            </div>
          </div>

          {/* Friction Sessions */}
          <div style={{
            padding: '18px 20px', borderRadius: 14,
            border: '1px solid rgba(239,68,68,0.15)',
            background: data.friction > 0
              ? 'linear-gradient(135deg, rgba(239,68,68,0.05) 0%, var(--surface) 100%)'
              : 'var(--surface)',
            boxShadow: '0 2px 12px rgba(239,68,68,0.05)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <PiFlameBold size={13} color="#ef4444" />
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Friction</span>
              </div>
              {data.frictionRate > 0 && (
                <span style={{
                  fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
                  padding: '2px 7px', borderRadius: 99,
                  background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                  border: '1px solid rgba(239,68,68,0.2)',
                }}>
                  {data.frictionRate}%
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>
                <NumberFlow value={data.friction} />
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>sessions</span>
            </div>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
              {prevData && <DeltaBadge current={data.friction} previous={prevData.friction} />}
              {prevData && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>vs prev {PERIOD_LABELS[period]}</span>}
            </div>
          </div>
        </div>

        {/* ── Chart ── */}
        <div style={{ padding: '20px 24px 16px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PiTrendUpBold size={14} color="var(--text-secondary)" />
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Traffic vs Friction — {PERIOD_LABELS[period]}
              </span>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: '#3b82f6' }} />
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>Sessions</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: '#ef4444' }} />
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>Friction</span>
              </div>
            </div>
          </div>
          <TrendChart data={data.chartData} />
        </div>
      </div>
    </div>
  )
}
