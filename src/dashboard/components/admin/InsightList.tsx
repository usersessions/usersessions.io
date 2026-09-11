'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { Insight } from '@/lib/insights'

const STORAGE_KEY = 'admin-insights-dismissed'
const BORDER: Record<Insight['severity'], string> = {
  info: 'var(--cyan, #22d3ee)',
  warning: 'var(--amber)',
  critical: 'var(--red)',
}

// Renders computed insights with per-insight dismissal persisted in localStorage.
export default function InsightList({ insights }: { insights: Insight[] }) {
  const [dismissed, setDismissed] = useState<string[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      setDismissed(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'))
    } catch {
      setDismissed([])
    }
    setReady(true)
  }, [])

  function dismiss(id: string) {
    const next = [...dismissed, id]
    setDismissed(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // storage unavailable — dismissal is session-only
    }
  }

  if (!ready) return null
  const visible = insights.filter((i) => !dismissed.includes(i.id))
  if (visible.length === 0) return null

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-sm)' }}>
      {visible.map((i) => (
        <div
          key={i.id}
          className="ds-stat-card flex"
          style={{ borderLeft: `3px solid ${BORDER[i.severity]}`, alignItems: 'center', gap: 'var(--space-md)', padding: '16px 24px' }}
        >
          <p className="font-sans-body" style={{ flex: 1 }}>
            {i.text}
            {i.href ? (
              <>
                {' '}
                <Link href={i.href} style={{ color: 'inherit' }}>Review →</Link>
              </>
            ) : null}
          </p>
          <button className="btn-ghost" type="button" aria-label={`Dismiss insight: ${i.text}`} onClick={() => dismiss(i.id)}>✕</button>
        </div>
      ))}
    </div>
  )
}
