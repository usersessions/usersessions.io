'use client'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', alignItems: 'flex-start', maxWidth: 640 }}>
      <p className="font-mono-label" style={{ color: 'var(--red)' }}>Could not load settings</p>
      <p className="font-sans-body">Something went wrong fetching this page.</p>
      <button className="btn-dash-secondary" type="button" onClick={() => reset()}>Try again</button>
    </div>
  )
}
