'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type Insight = { id: string; severity: 'info' | 'warning' | 'critical'; text: string; href?: string }

const COLOR: Record<Insight['severity'], string> = {
  info: 'var(--cyan)',
  warning: 'var(--amber)',
  critical: 'var(--red)',
}

const STORAGE_KEY = 'overview-insights-dismissed'

// GAP 17 — top-of-Overview insights. Max 3 visible, dismissible (localStorage).
export default function InsightsPanel({ insights }: { insights: Insight[] }) {
  const [dismissed, setDismissed] = useState<string[] | null>(null)

  useEffect(() => {
    try {
      setDismissed(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'))
    } catch {
      setDismissed([])
    }
  }, [])

  if (dismissed === null) return null
  const visible = insights.filter((i) => !dismissed.includes(i.id)).slice(0, 3)
  if (visible.length === 0) return null

  const dismiss = (id: string) => {
    const next = [...dismissed, id]
    setDismissed(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* storage unavailable — dismissal is session-only */
    }
  }

  return (
    <div
      className="card card--dense flex flex-col"
      aria-label="Insights"
      style={{ gap: 'var(--space-sm)', background: 'var(--ink-2)' }}
    >
      <p className="font-mono-label">Insights</p>
      {visible.map((i) => (
        <div
          key={i.id}
          className="flex items-center"
          style={{ gap: 'var(--space-md)', borderLeft: `2px solid ${COLOR[i.severity]}`, paddingLeft: 'var(--space-sm)' }}
        >
          <p className="font-sans-body" style={{ flex: 1, color: 'var(--text-primary)' }}>{i.text}</p>
          {i.href && (
            <Link href={i.href} className="font-mono-micro" style={{ color: 'var(--primary)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
              View →
            </Link>
          )}
          <button
            type="button"
            className="btn-ghost"
            aria-label={`Dismiss insight: ${i.text}`}
            onClick={() => dismiss(i.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
