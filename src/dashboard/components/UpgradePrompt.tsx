/** Reusable inline upgrade prompt — renders wherever a plan limit is hit or approached. */
export function UpgradePrompt({
  feature,
  requiredPlan = 'founder',
  compact = false,
}: {
  feature: string
  requiredPlan?: string
  compact?: boolean
}) {
  if (compact) {
    return (
      <a
        href="mailto:hello@usersessions.io"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontFamily: 'var(--font-mono)',
          fontSize: '0.6875rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase' as const,
          color: 'var(--amber)',
          textDecoration: 'none',
          padding: '2px 8px',
          border: '1px solid var(--amber)',
          borderRadius: 'var(--rounded-sm)',
          opacity: 0.85,
        }}
      >
        ↑ Upgrade
      </a>
    )
  }

  return (
    <div
      style={{
        border: '1px solid var(--amber)',
        borderRadius: 'var(--rounded-md)',
        padding: 'var(--space-md)',
        background: 'rgba(251,191,36,0.05)',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 'var(--space-sm)',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.6875rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase' as const,
          color: 'var(--amber)',
        }}
      >
        Plan limit reached
      </p>
      <p className="font-sans-body">
        {feature} requires the <strong style={{ color: 'var(--text-primary)', textTransform: 'capitalize' as const }}>{requiredPlan}</strong> plan
        or above.
      </p>
      <a
        href="mailto:hello@usersessions.io"
        className="btn-primary"
        style={{ textDecoration: 'none', display: 'inline-block', textAlign: 'center' as const, width: 'fit-content' }}
      >
        Upgrade to {requiredPlan} →
      </a>
    </div>
  )
}

/** A compact horizontal usage meter with label. */
export function UsageMeter({
  label,
  used,
  total,
  unit = '',
}: {
  label: string
  used: number
  total: number | null
  unit?: string
}) {
  const pct = total ? Math.min(Math.round((used / total) * 100), 100) : 0
  const atLimit = total !== null && used >= total
  const nearLimit = total !== null && used >= total * 0.8

  return (
    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="font-mono-label">{label}</span>
        <span
          className="font-mono-data"
          style={{ color: atLimit ? 'var(--amber)' : 'var(--text-primary)', fontSize: '0.75rem' }}
        >
          {total === null ? `${used} ${unit}` : `${used} / ${total} ${unit}`}
        </span>
      </div>
      {total !== null && (
        <div className="meter">
          <span
            style={{
              width: `${pct}%`,
              background: atLimit ? 'var(--amber)' : nearLimit ? 'var(--cyan)' : undefined,
            }}
          />
        </div>
      )}
    </div>
  )
}
