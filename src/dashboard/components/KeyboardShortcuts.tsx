'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

const GO: Record<string, string> = {
  o: '/',
  r: '/sessions',
  a: '/analytics',
  n: '/notifications',
  s: '/settings',
}

/** Linear-style g-then-key navigation. Inert inside inputs and with modifiers. */
export function KeyboardShortcuts() {
  const router = useRouter()
  const pendingG = useRef<number | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const now = Date.now()
      if (pendingG.current !== null && now - pendingG.current < 1500) {
        const href = GO[e.key.toLowerCase()]
        pendingG.current = null
        if (href) {
          e.preventDefault()
          router.push(href)
        }
        return
      }
      if (e.key.toLowerCase() === 'g') pendingG.current = now
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router])

  return null
}
