export type DeltaPeriod = '24h' | '7d' | '30d' | '90d' | 'day' | 'week' | 'month'

const PERIOD_LABEL: Record<DeltaPeriod, string> = {
  '24h': 'vs prev 24h',
  '7d': 'vs prev 7d',
  '30d': 'vs prev 30d',
  '90d': 'vs prev 90d',
  day: 'vs yesterday',
  week: 'vs last week',
  month: 'vs last month',
}

// Delta vs previous period: green up, red down, grey dash. Null = no baseline yet.
export default function DeltaBadge({ value, period = '7d' }: { value: number | null; period?: DeltaPeriod }) {
  const label = PERIOD_LABEL[period]
  if (value === null || Number.isNaN(value)) {
    return (
      <span className="font-mono-micro" style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
        — {label}
      </span>
    )
  }
  const rounded = Math.round(value)
  const positive = rounded > 0
  const zero = rounded === 0
  const color = zero ? 'var(--muted)' : positive ? 'var(--green, #22c55e)' : 'var(--red)'
  return (
    <span className="font-mono-micro" style={{ fontSize: '0.75rem', color }}>
      {zero ? '—' : positive ? '↑' : '↓'} {positive ? '+' : ''}{rounded}% {label}
    </span>
  )
}
