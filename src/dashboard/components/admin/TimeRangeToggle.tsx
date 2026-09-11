'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

const RANGES = ['24h', '7d', '30d', '90d'] as const

// Segmented control writing ?range= so server components recompute aggregates.
export default function TimeRangeToggle({ defaultRange = '7d' }: { defaultRange?: (typeof RANGES)[number] }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const active = params.get('range') ?? defaultRange

  return (
    <div
      className="flex"
      role="tablist"
      aria-label="Time range"
      style={{ gap: 2, background: 'var(--ink-2)', border: '1px solid var(--border)', borderRadius: 'var(--rounded-sm)', padding: 2 }}
    >
      {RANGES.map((r) => (
        <button
          key={r}
          type="button"
          role="tab"
          aria-selected={active === r}
          className="font-mono-micro"
          onClick={() => {
            const next = new URLSearchParams(params)
            next.set('range', r)
            router.replace(`${pathname}?${next.toString()}`)
          }}
          style={{
            padding: '2px 10px',
            borderRadius: 'var(--rounded-sm)',
            border: active === r ? '1px solid var(--primary, var(--amber))' : '1px solid transparent',
            background: 'transparent',
            color: active === r ? 'var(--text-primary)' : 'var(--muted)',
            cursor: 'pointer',
          }}
        >
          {r}
        </button>
      ))}
    </div>
  )
}
