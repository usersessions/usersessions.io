'use client'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', alignItems: 'flex-start' }}>
      <p className="font-mono-label" style={{ color: 'var(--red)' }}>Could not load admin data</p>
      <p className="font-sans-body">Something went wrong fetching this page.</p>
      <button className="btn-ghost" type="button" onClick={() => reset()}>Try again</button>
    </div>
  )
}
