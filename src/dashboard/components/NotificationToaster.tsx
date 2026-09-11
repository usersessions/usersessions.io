'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Toast {
  id: string
  title: string
  body: string | null
}

/**
 * Realtime toasts: subscribes to INSERTs on the user's notifications rows
 * (publication set up in migration 0009) and surfaces each one for 6 seconds.
 * RealtimeRefresh handles data re-rendering; this handles the human-visible ping.
 */
export function NotificationToaster({ userId }: { userId: string }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`notifications-toast-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as Toast
          setToasts((prev) => [...prev, { id: row.id, title: row.title, body: row.body }])
          setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== row.id))
          }, 6000)
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId])

  if (toasts.length === 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 'var(--space-md)',
        right: 'var(--space-md)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-sm)',
        maxWidth: 360,
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="card card--dense"
          style={{
            background: 'var(--ink-2)',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          <p className="font-sans-label" style={{ color: 'var(--text-primary)' }}>
            {t.title}
          </p>
          {t.body ? (
            <p className="font-mono-micro" style={{ color: 'var(--muted-2)' }}>
              {t.body}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  )
}
