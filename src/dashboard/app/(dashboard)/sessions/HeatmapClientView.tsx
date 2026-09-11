'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion } from "motion/react"
import { PiCursorClickBold, PiTrendUpBold, PiMagnifyingGlassBold, PiPulseBold, PiArrowClockwiseBold } from 'react-icons/pi'
import Link from 'next/link'

type HeatmapAggregate = {
  id: string
  page_url_pattern: string
  viewport_bucket: string
  date_trunc_hour: string
  click_density_grid: any
  scroll_depth_histogram: any
  rage_click_clusters: any[]
}

type Session = {
  id: string
  source: string
  source_session_id: string
  rage_click_count: number
  created_at: string
  has_findings: boolean // Derived or queried
}

export function HeatmapClientView({ initialAggregates, initialSessions, clientId }: {
  initialAggregates: HeatmapAggregate[],
  initialSessions: Session[],
  clientId: string
}) {
  const supabase = createClient()
  const [aggregates, setAggregates] = useState<HeatmapAggregate[]>(initialAggregates)
  const [sessions, setSessions] = useState<Session[]>(initialSessions)
  const [activeTab, setActiveTab] = useState<'rage' | 'click' | 'scroll' | 'move'>('rage')
  const [filterHasFinding, setFilterHasFinding] = useState(false)
  const [isLive, setIsLive] = useState(true)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    // Draw real data onto canvas whenever aggregates or activeTab changes
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (aggregates.length === 0) return

    // Simple implementation: merge the first few aggregates
    const combinedClicks: Record<string, number> = {}
    
    for (const agg of aggregates) {
      if (activeTab === 'click' || activeTab === 'rage') {
        const grid = agg.click_density_grid || {}
        for (const [coord, count] of Object.entries(grid)) {
          combinedClicks[coord] = (combinedClicks[coord] || 0) + (count as number)
        }
      }
    }

    if (activeTab === 'click' || activeTab === 'rage') {
      let maxDensity = 1
      for (const count of Object.values(combinedClicks)) {
        if (count > maxDensity) maxDensity = count
      }

      for (const [coord, count] of Object.entries(combinedClicks)) {
        const [xStr, yStr] = coord.split(',')
        const x = parseInt(xStr, 10)
        const y = parseInt(yStr, 10)
        if (isNaN(x) || isNaN(y)) continue

        const intensity = Math.min((count / maxDensity) * 1.5, 1)
        
        ctx.beginPath()
        ctx.arc(x, y, 20, 0, 2 * Math.PI, false)
        
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 20)
        if (activeTab === 'rage') {
          gradient.addColorStop(0, `rgba(239, 68, 68, ${intensity})`) // Red
          gradient.addColorStop(1, 'rgba(239, 68, 68, 0)')
        } else {
          gradient.addColorStop(0, `rgba(59, 130, 246, ${intensity})`) // Blue
          gradient.addColorStop(1, 'rgba(59, 130, 246, 0)')
        }
        
        ctx.fillStyle = gradient
        ctx.fill()
      }
    }
  }, [aggregates, activeTab])

  useEffect(() => {
    // Subscribe to realtime updates for heatmap aggregates
    const channel = supabase.channel('heatmap-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'us_heatmap_aggregates',
        filter: `client_id=eq.${clientId}`
      }, (payload) => {
        if (!isLive) return
        const incoming = payload.new as HeatmapAggregate
        setAggregates(current => {
          const updated = [...current]
          const idx = updated.findIndex(a => a.id === incoming.id)
          if (idx >= 0) {
            updated[idx] = incoming
          } else {
            updated.unshift(incoming)
          }
          return updated
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [clientId, supabase, isLive])

  const filteredSessions = sessions.filter(s => {
    if (filterHasFinding && !s.has_findings) return false
    return true
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      
      {/* Heatmap Visualizer Section */}
      <div className="ds-stat-card" style={{ padding: 24, minHeight: 400 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <PiPulseBold size={18} color="var(--blue)" />
            Aggregate Heatmaps
          </h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button 
              onClick={() => setIsLive(!isLive)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: isLive ? 'rgba(52,211,153,0.1)' : 'var(--bg-canvas)',
                color: isLive ? '#059669' : 'var(--text-secondary)',
                border: `1px solid ${isLive ? 'rgba(52,211,153,0.2)' : 'var(--border)'}`,
                padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer'
              }}
            >
              <PiArrowClockwiseBold size={12} className={isLive ? "animate-spin" : ""} />
              {isLive ? 'Live' : 'Paused'}
            </button>

            <select className="ds-input" style={{ padding: '6px 12px', height: 'auto', fontSize: 12 }}>
              <option>desktop</option>
              <option>tablet</option>
              <option>mobile</option>
            </select>
          </div>
        </div>
        
        {/* Mock visualizer area */}
        <div style={{ 
          background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: 12,
          height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', gap: 8, zIndex: 10 }}>
            {['rage', 'click', 'scroll', 'move'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                style={{
                  background: activeTab === tab ? 'var(--blue)' : 'var(--bg-canvas)',
                  color: activeTab === tab ? '#fff' : 'var(--text-secondary)',
                  border: '1px solid',
                  borderColor: activeTab === tab ? 'var(--blue)' : 'var(--border)',
                  padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  boxShadow: activeTab === tab ? '0 2px 8px rgba(59,130,246,0.3)' : 'none'
                }}
              >
                {tab === 'rage' ? 'Rage Clicks' : tab === 'click' ? 'Click Density' : tab === 'scroll' ? 'Scroll Depth' : 'Move Map'}
              </button>
            ))}
          </div>

          <div style={{ color: 'var(--text-muted)', fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, position: 'absolute', zIndex: 1, pointerEvents: 'none' }}>
            <PiPulseBold size={32} style={{ opacity: 0.5 }} />
            {aggregates.length === 0 && (
              <span>No aggregate data available yet</span>
            )}
          </div>

          <canvas 
            ref={canvasRef} 
            width={800} 
            height={320} 
            style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 5 }} 
          />
        </div>
      </div>

      {/* Session List */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 className="ds-section-label" style={{ margin: 0 }}>High-Fidelity Replays</h2>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={filterHasFinding}
              onChange={(e) => setFilterHasFinding(e.target.checked)}
              style={{ accentColor: 'var(--orange)' }}
            />
            Has AI Finding
          </label>
        </div>

        <div className="ds-stat-card" style={{ padding: 0, overflow: 'hidden' }}>
          {filteredSessions.length > 0 ? filteredSessions.map((s, i) => (
            <Link href={`/sessions/${s.id}`} key={s.id} style={{ textDecoration: 'none' }}>
              <div style={{
                padding: '14px 24px',
                borderBottom: i < (filteredSessions.length - 1) ? '1px solid var(--border)' : 'none',
                display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--glass-bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    Session {s.source_session_id ?? s.id.split('-')[0]}
                  </p>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                    {new Date(s.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
                
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {s.source && s.source.toLowerCase().includes('scrape') ? (
                    <span style={{ fontSize: 11, background: 'rgba(99,102,241,0.1)', color: '#6366f1', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
                      Static Crawl
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, background: 'rgba(34,197,94,0.1)', color: '#22c55e', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
                      Live Visitor Data
                    </span>
                  )}
                  {s.has_findings && (
                    <span style={{ fontSize: 11, background: 'rgba(59,130,246,0.1)', color: 'var(--blue)', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
                      Has Findings
                    </span>
                  )}
                  {s.rage_click_count > 0 && (
                    <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <PiCursorClickBold size={11} />
                      {s.rage_click_count} rage-clicks
                    </span>
                  )}
                </div>
              </div>
            </Link>
          )) : (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No matching sessions found.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
