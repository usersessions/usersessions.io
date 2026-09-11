'use client'

import { useEffect, useState } from 'react'

function fmt(from: number): string {
  const s = Math.floor((Date.now() - from) / 1000)
  if (s < 60) return 'Just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return new Date(from).toISOString().replace('T', ' ').slice(0, 16)
}

// "Last updated" relative timestamp, re-rendered every 30s.
export default function FreshnessTimestamp({ generatedAt }: { generatedAt: string }) {
  const ts = new Date(generatedAt).getTime()
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000)
    return () => clearInterval(id)
  }, [])
  return (
    <span suppressHydrationWarning className="font-mono-micro" style={{ fontSize: '0.625rem', color: 'var(--muted-2, var(--muted))' }}>
      Last updated: {fmt(ts)}
    </span>
  )
}
