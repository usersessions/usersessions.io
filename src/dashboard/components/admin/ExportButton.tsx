'use client'

import { useState } from 'react'

// Per-table export: downloads CSV/JSON from the audit-logged admin export endpoint.
export default function ExportButton({ dataset, format = 'csv' }: { dataset: string; format?: 'csv' | 'json' }) {
  const [state, setState] = useState<'idle' | 'busy' | 'failed'>('idle')

  async function download() {
    setState('busy')
    try {
      const res = await fetch(`/api/admin/export?dataset=${dataset}&format=${format}`)
      if (!res.ok) throw new Error(`export ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${dataset}-${new Date().toISOString().slice(0, 10)}.${format}`
      a.click()
      URL.revokeObjectURL(url)
      setState('idle')
    } catch {
      setState('failed')
      setTimeout(() => setState('idle'), 4000)
    }
  }

  return (
    <button className="btn-ghost" type="button" disabled={state === 'busy'} onClick={download}>
      {state === 'busy' ? 'Exporting…' : state === 'failed' ? 'Export failed ✕' : `Export ${format.toUpperCase()}`}
    </button>
  )
}
