'use client'

import DeltaBadge, { type DeltaPeriod } from './DeltaBadge'
import Sparkline from './Sparkline'

export type Metric = {
  label: string
  value: string | number
  sub?: string
  delta?: number | null
  period?: DeltaPeriod
  spark?: number[]
}

export default function MetricCard({ label, value, sub, delta, period, spark }: Metric) {
  return (
    <div 
      className="ds-stat-card"
      style={{
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        cursor: 'default',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
        <p style={{ 
          fontFamily: 'var(--font-mono, monospace)', 
          fontSize: '11px', 
          fontWeight: 700, 
          letterSpacing: '0.08em', 
          textTransform: 'uppercase', 
          color: 'var(--muted)', 
          margin: 0 
        }}>
          {label}
        </p>
        {delta !== undefined ? (
          <div style={{ 
            background: 'var(--bg-canvas)', 
            padding: '4px 8px', 
            borderRadius: '6px', 
            border: '1px solid var(--glass-bg-hover)' 
          }}>
            <DeltaBadge value={delta} period={period} />
          </div>
        ) : null}
      </div>

      <div style={{ 
        fontSize: '36px', 
        fontFamily: 'var(--font-serif, serif)', 
        fontStyle: 'italic', 
        color: 'var(--text-primary)',
        lineHeight: 1,
        marginTop: '4px'
      }}>
        {value}
      </div>

      {spark && spark.length > 1 ? (
        <div style={{ marginTop: '8px' }}>
          <Sparkline points={spark} />
        </div>
      ) : null}

      {sub ? (
        <p style={{ 
          fontFamily: 'var(--font-mono, monospace)', 
          fontSize: '11px', 
          color: 'rgba(245, 243, 238, 0.4)', 
          margin: 0,
          marginTop: 'auto'
        }}>
          {sub}
        </p>
      ) : null}
    </div>
  )
}
