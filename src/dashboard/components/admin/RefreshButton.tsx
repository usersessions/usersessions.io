'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

// Re-fetches all server data for the current route.
export default function RefreshButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <button
      className="btn-ghost"
      type="button"
      aria-label="Refresh data"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
      style={{ opacity: pending ? 0.5 : 1 }}
    >
      ↻ Refresh
    </button>
  )
}
