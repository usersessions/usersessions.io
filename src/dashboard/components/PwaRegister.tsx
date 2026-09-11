'use client'

import { useEffect } from 'react'

/** Registers the service worker that makes the dashboard installable as a PWA. */
export function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Registration failure must never break the app.
      })
    }
  }, [])
  return null
}
