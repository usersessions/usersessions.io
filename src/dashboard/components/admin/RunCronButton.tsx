'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

// Manual cron trigger — POSTs to the audit-logged admin endpoint, then refreshes.
export default function RunCronButton({ job }: { job: string }) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'running' | 'ok' | 'failed'>('idle')

  async function run() {
    setState('running')
    try {
      const res = await fetch('/api/admin/cron/trigger', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ job }),
      })
      const body = await res.json().catch(() => null)
      setState(res.ok && body?.ok ? 'ok' : 'failed')
      router.refresh()
    } catch {
      setState('failed')
    }
    setTimeout(() => setState('idle'), 4000)
  }

  return (
    <button className="btn-ghost" type="button" disabled={state === 'running'} onClick={run}>
      {state === 'idle' ? 'Run now' : state === 'running' ? 'Running…' : state === 'ok' ? 'Done ✓' : 'Failed ✕'}
    </button>
  )
}
