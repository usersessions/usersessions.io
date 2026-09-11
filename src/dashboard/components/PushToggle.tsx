'use client'

import { useEffect, useState } from 'react'

/** Converts a base64url VAPID public key into the Uint8Array pushManager expects. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(Array.from(raw, (c) => c.charCodeAt(0)))
}

/**
 * Device push opt-in. Fail-soft: unsupported browsers render nothing, a missing
 * VAPID key or denied permission shows an honest message instead of a broken toggle.
 */
export function PushToggle() {
  const [supported, setSupported] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    setSupported(true)
    void navigator.serviceWorker.ready
      .then(async (reg) => {
        const sub = await reg.pushManager.getSubscription()
        setEnabled(Boolean(sub))
      })
      .catch(() => {})
  }, [])

  const enable = async () => {
    setBusy(true)
    setError(null)
    try {
      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapid) throw new Error('Push is not configured on this deployment.')
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') throw new Error('Notification permission was not granted.')
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid) as any,
      })
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })
      if (!res.ok) throw new Error('Could not save the subscription.')
      setEnabled(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable push notifications.')
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    setBusy(true)
    setError(null)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setEnabled(false)
    } catch {
      setError('Failed to disable push notifications.')
    } finally {
      setBusy(false)
    }
  }

  if (!supported) return null

  return (
    <div className="card card--dense flex flex-col" style={{ gap: 'var(--space-xs)' }}>
      <p className="font-mono-label">Device push notifications</p>
      <p className="font-mono-micro">
        Get a native notification when an autonomous action is executed or when you reach a monthly limit.
      </p>
      <div>
        <button className="btn-ghost" onClick={enabled ? disable : enable} disabled={busy}>
          {busy ? 'Working…' : enabled ? 'Disable push notifications' : 'Enable push notifications'}
        </button>
      </div>
      {error && (
        <p className="font-mono-micro" style={{ color: 'var(--red)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
