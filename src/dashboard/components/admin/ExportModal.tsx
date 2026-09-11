'use client'

import { useState } from 'react'

const DATASETS = [
  { id: 'users', label: 'Users' },
  { id: 'revenue', label: 'Revenue events' },
  { id: 'cron_logs', label: 'Cron logs' },
  { id: 'audit', label: 'Audit log' },
  { id: 'platform_health', label: 'Platform health' },
  { id: 'support_tickets', label: 'Support tickets' },
]

export default function ExportModal({ onClose }: { onClose: () => void }) {
  const [dataset, setDataset] = useState('users')
  const [format, setFormat] = useState<'csv' | 'json'>('csv')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function download() {
    setBusy(true)
    setError(null)
    try {
      void fetch('/api/admin/quick-action', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'export_download', detail: { dataset, format } }),
      }).catch(() => {})
      const res = await fetch(`/api/admin/export?dataset=${dataset}&format=${format}`)
      if (!res.ok) throw new Error(`Export failed (${res.status})`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${dataset}-${new Date().toISOString().slice(0, 10)}.${format}`
      a.click()
      URL.revokeObjectURL(url)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.')
    }
    setBusy(false)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Export data"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 'var(--space-xl)' }}
    >
      <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 400 }}>
        <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
          <p className="font-mono-label">Export data</p>
          <button className="btn-ghost" type="button" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <label className="font-mono-micro" style={{ display: 'block', marginBottom: 'var(--space-sm)' }}>
          Dataset
          <select
            value={dataset}
            onChange={(e) => setDataset(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4, background: '#ffffff', border: '1px solid var(--border)', borderRadius: 'var(--rounded-sm)', color: 'var(--text-primary)', padding: 'var(--space-sm)' }}
          >
            {DATASETS.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </label>
        <label className="font-mono-micro" style={{ display: 'block', marginBottom: 'var(--space-md)' }}>
          Format
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as 'csv' | 'json')}
            style={{ display: 'block', width: '100%', marginTop: 4, background: '#ffffff', border: '1px solid var(--border)', borderRadius: 'var(--rounded-sm)', color: 'var(--text-primary)', padding: 'var(--space-sm)' }}
          >
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
        </label>
        {error ? <p className="font-mono-micro" style={{ color: 'var(--red)' }}>{error}</p> : null}
        <button className="btn-ghost" type="button" disabled={busy} onClick={download}>
          {busy ? 'Exporting…' : 'Download'}
        </button>
        <p className="font-mono-micro" style={{ marginTop: 'var(--space-sm)', color: 'var(--muted)' }}>Capped at 5,000 rows. Every export is audit-logged.</p>
      </div>
    </div>
  )
}
