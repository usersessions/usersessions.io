'use client'

import { useState } from 'react'

// Sends a test email to the signed-in admin through the Resend wrapper.
export default function EmailTestButton() {
  const [state, setState] = useState<'idle' | 'sending' | 'ok' | 'failed'>('idle')

  async function send() {
    setState('sending')
    try {
      const res = await fetch('/api/admin/settings/email-test', { method: 'POST' })
      const body = (await res.json().catch(() => null)) as { ok?: boolean } | null
      setState(res.ok && body?.ok ? 'ok' : 'failed')
    } catch {
      setState('failed')
    }
    setTimeout(() => setState('idle'), 5000)
  }

  return (
    <button className="btn-ghost" type="button" disabled={state === 'sending'} onClick={send}>
      {state === 'idle' ? 'Send test email' : state === 'sending' ? 'Sending…' : state === 'ok' ? 'Sent ✓' : 'Failed ✕ (check RESEND_API_KEY)'}
    </button>
  )
}
