'use client'

// Inline error state for a single admin section: red border, message, retry.
export default function ErrorCard({
  message = 'Failed to load this section.',
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  return (
    <div
      className="ds-stat-card"
      role="alert"
      style={{ borderColor: 'var(--red)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', alignItems: 'flex-start' }}
    >
      <p className="font-mono-label" style={{ color: 'var(--red)' }}>Error</p>
      <p className="font-sans-body">{message}</p>
      {onRetry ? (
        <button className="btn-ghost" type="button" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  )
}
