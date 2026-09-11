'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

/**
 * Live-updates toggle for admin pages. Service-role-only tables (cron_logs,
 * admin_notifications, ...) are invisible to client Realtime by design (RLS),
 * so the admin overview re-fetches server data on an interval instead.
 */
export default function RealtimeIndicator({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter()
  const [live, setLive] = useState(true)

  useEffect(() => {
    if (!live) return
    const id = setInterval(() => router.refresh(), intervalMs)
    return () => clearInterval(id)
  }, [live, intervalMs, router])

  return (
    <button
      type="button"
      className="font-mono-micro"
      aria-pressed={live}
      onClick={() => setLive((v) => !v)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: 'transparent',
        border: 'none',
        color: live ? 'var(--cyan, #22d3ee)' : 'var(--muted)',
        cursor: 'pointer',
      }}
    >
      <span
        aria-hidden="true"
        className={live ? 'animate-pulse' : undefined}
        style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }}
      />
      {live ? 'Live updates' : 'Paused'}
    </button>
  )
}
