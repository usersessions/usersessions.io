'use client'

import { useEffect, useRef, useState } from 'react'

// Pinned rrweb-player build. Bump deliberately.
const RRWEB_PLAYER_VERSION = '1.0.0-alpha.4'
const RRWEB_PLAYER_JS = `https://cdn.jsdelivr.net/npm/rrweb-player@${RRWEB_PLAYER_VERSION}/dist/index.js`
const RRWEB_PLAYER_CSS = `https://cdn.jsdelivr.net/npm/rrweb-player@${RRWEB_PLAYER_VERSION}/dist/style.css`

type State = 'loading' | 'ready' | 'empty' | 'error'

declare global {
  interface Window {
    rrwebPlayer?: new (opts: { target: HTMLElement; props: Record<string, unknown> }) => unknown
  }
}

function loadScriptOnce(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if (existing) {
      if (window.rrwebPlayer) return resolve()
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Failed to load rrweb-player')), { once: true })
      return
    }
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.crossOrigin = 'anonymous'
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Failed to load rrweb-player'))
    document.head.appendChild(s)
  })
}

function loadStyleOnce(href: string) {
  if (document.querySelector(`link[href="${href}"]`)) return
  const l = document.createElement('link')
  l.rel = 'stylesheet'
  l.href = href
  l.crossOrigin = 'anonymous'
  document.head.appendChild(l)
}

/**
 * Plays an rrweb recording stored in R2. `src` is a short-lived signed URL to
 * the JSON written by /api/ingest/replay (bare events array or { events }).
 */
export function ReplayPlayer({ src }: { src: string | null }) {
  const target = useRef<HTMLDivElement | null>(null)
  const [state, setState] = useState<State>(src ? 'loading' : 'empty')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!src || !target.current) return
    let cancelled = false
    const el = target.current

    ;(async () => {
      try {
        loadStyleOnce(RRWEB_PLAYER_CSS)
        const [, res] = await Promise.all([loadScriptOnce(RRWEB_PLAYER_JS), fetch(src, { credentials: 'omit' })])
        if (!res.ok) throw new Error(`Replay fetch failed (${res.status})`)
        const json = await res.json()
        const events = Array.isArray(json) ? json : Array.isArray(json?.events) ? json.events : []
        if (cancelled) return
        if (events.length < 2) {
          setState('empty')
          return
        }
        if (!window.rrwebPlayer) throw new Error('rrweb-player did not initialise')
        el.innerHTML = ''
        const width = Math.max(320, el.clientWidth)
        const height = Math.max(240, el.clientHeight - 80)
        new window.rrwebPlayer({
          target: el,
          props: { events, width, height, autoPlay: false, skipInactive: true, showController: true, mouseTail: false },
        })
        setState('ready')
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Unable to load replay')
        setState('error')
      }
    })()

    return () => {
      cancelled = true
      el.innerHTML = ''
    }
  }, [src])

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <div ref={target} style={{ width: '100%', height: '100%', display: state === 'ready' ? 'block' : 'none' }} />
      {state !== 'ready' && (
        <p style={{ color: '#94a3b8', fontFamily: 'var(--font-mono)', textAlign: 'center', margin: 0, padding: 24 }}>
          {state === 'loading' && 'Loading replay...'}
          {state === 'empty' && (
            <>
              No replay recorded for this session
              <br />
              <span style={{ fontSize: 12, opacity: 0.6 }}>Replays are captured only when session recording is enabled for the site.</span>
            </>
          )}
          {state === 'error' && (
            <>
              Replay unavailable
              <br />
              <span style={{ fontSize: 12, opacity: 0.6 }}>{error}</span>
            </>
          )}
        </p>
      )}
    </div>
  )
}
