'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'

interface HeatPoint {
  x: number
  y: number
  intensity: number
  age: number
  isClick: boolean
}

// Simulated user journey — a checkout page being analyzed
const SIMULATED_EVENTS: Array<{ t: number; x: number; y: number; click: boolean; label?: string }> = [
  { t: 500,  x: 0.22, y: 0.18, click: false },
  { t: 700,  x: 0.34, y: 0.21, click: false },
  { t: 900,  x: 0.48, y: 0.24, click: false },
  { t: 1100, x: 0.62, y: 0.28, click: false },
  { t: 1300, x: 0.74, y: 0.24, click: false },
  { t: 1600, x: 0.74, y: 0.24, click: true,  label: 'rage-click' },
  { t: 1900, x: 0.74, y: 0.24, click: true,  label: 'rage-click' },
  { t: 2200, x: 0.74, y: 0.24, click: true,  label: 'rage-click' },
  { t: 2700, x: 0.50, y: 0.42, click: false },
  { t: 3000, x: 0.50, y: 0.55, click: false },
  { t: 3300, x: 0.50, y: 0.68, click: false },
  { t: 3600, x: 0.30, y: 0.75, click: true },
  { t: 4000, x: 0.20, y: 0.75, click: false },
  { t: 4200, x: 0.12, y: 0.75, click: false },
  { t: 4500, x: 0.12, y: 0.60, click: false },
  { t: 4800, x: 0.12, y: 0.45, click: false },
  { t: 5100, x: 0.22, y: 0.35, click: true },
  { t: 5500, x: 0.65, y: 0.50, click: false },
  { t: 5800, x: 0.65, y: 0.50, click: true },
  { t: 6200, x: 0.80, y: 0.88, click: false },
  { t: 6500, x: 0.80, y: 0.88, click: true  },
]

export function LiveHeatmapDemo() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointsRef = useRef<HeatPoint[]>([])
  const frameRef = useRef<number>(0)
  const simTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const [phase, setPhase] = useState<'idle' | 'recording' | 'analyzing' | 'done'>('idle')
  const [rageAlert, setRageAlert] = useState(false)
  const [patchReady, setPatchReady] = useState(false)
  const [activeLabel, setActiveLabel] = useState('')

  const addPoint = useCallback((x: number, y: number, isClick: boolean) => {
    pointsRef.current.push({ x, y, intensity: isClick ? 1.0 : 0.4, age: 0, isClick })
    if (pointsRef.current.length > 300) pointsRef.current.shift()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = container.offsetWidth
      canvas.height = container.offsetHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    const draw = () => {
      const W = canvas.width, H = canvas.height
      // Clear with a very soft trail
      ctx.fillStyle = 'rgba(250,250,252,0.18)'
      ctx.fillRect(0, 0, W, H)

      pointsRef.current = pointsRef.current.filter(p => p.age < 200)

      for (const p of pointsRef.current) {
        const r = p.isClick ? W * 0.08 : W * 0.04
        const alpha = (1 - p.age / 200) * p.intensity

        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r)
        if (p.isClick) {
          // Rage-click = deep red/orange
          grad.addColorStop(0, `rgba(255,60,0,${alpha * 0.9})`)
          grad.addColorStop(0.4, `rgba(255,120,0,${alpha * 0.5})`)
          grad.addColorStop(1, `rgba(255,60,0,0)`)
        } else {
          // Normal hover = cool blue/teal
          grad.addColorStop(0, `rgba(59,130,246,${alpha * 0.7})`)
          grad.addColorStop(0.5, `rgba(99,102,241,${alpha * 0.3})`)
          grad.addColorStop(1, `rgba(59,130,246,0)`)
        }

        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()

        p.age += 1
      }

      frameRef.current = requestAnimationFrame(draw)
    }
    draw()

    // Start simulation
    setPhase('recording')
    setRageAlert(false)
    setPatchReady(false)

    const W = () => container.offsetWidth
    const H = () => container.offsetHeight

    const timers: ReturnType<typeof setTimeout>[] = []
    SIMULATED_EVENTS.forEach(ev => {
      const t = setTimeout(() => {
        const px = ev.x * W()
        const py = ev.y * H()
        addPoint(px, py, ev.click)
        if (ev.label === 'rage-click') {
          setRageAlert(true)
          setActiveLabel('Rage-click cluster detected')
        }
      }, ev.t)
      timers.push(t)
    })

    const analyzeTimer = setTimeout(() => {
      setPhase('analyzing')
      setActiveLabel('Analyzing interaction patterns...')
    }, 3500)

    const doneTimer = setTimeout(() => {
      setPhase('done')
      setPatchReady(true)
      setActiveLabel('Patch #4021 generated ✓')
    }, 7000)

    // Loop: restart after 9s
    const loopTimer = setTimeout(() => {
      setPhase('idle')
      setRageAlert(false)
      setPatchReady(false)
      setActiveLabel('')
      pointsRef.current = []
    }, 9000)

    timers.push(analyzeTimer, doneTimer, loopTimer)
    simTimers.current = timers

    // Handle live mouse input too
    const handleMouse = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      addPoint(e.clientX - rect.left, e.clientY - rect.top, false)
    }
    const handleClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      addPoint(e.clientX - rect.left, e.clientY - rect.top, true)
    }
    container.addEventListener('mousemove', handleMouse)
    container.addEventListener('click', handleClick)

    return () => {
      cancelAnimationFrame(frameRef.current)
      ro.disconnect()
      timers.forEach(clearTimeout)
      container.removeEventListener('mousemove', handleMouse)
      container.removeEventListener('click', handleClick)
    }
  }, [addPoint])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        flex: 1,
        minHeight: 320,
        background: '#f8f9fc',
        overflow: 'hidden',
        cursor: 'crosshair',
        borderRadius: '0 0 12px 12px',
      }}
    >
      {/* Canvas for heatmap */}
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      />

      {/* Fake webpage skeleton to simulate what's being recorded */}
      <div style={{ padding: '16px 20px', position: 'relative', zIndex: 1 }}>
        {/* Fake nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid #eee' }}>
          <div style={{ width: 80, height: 10, borderRadius: 4, background: '#ddd' }} />
          <div style={{ flex: 1 }} />
          {['Home','Products','Pricing','Checkout'].map(l => (
            <div key={l} style={{ width: 48, height: 8, borderRadius: 4, background: l === 'Checkout' ? '#111' : '#e2e2e2' }} />
          ))}
        </div>

        {/* Hero / product section */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ width: '70%', height: 14, borderRadius: 4, background: '#222', marginBottom: 8 }} />
            <div style={{ width: '90%', height: 9, borderRadius: 4, background: '#ddd', marginBottom: 6 }} />
            <div style={{ width: '80%', height: 9, borderRadius: 4, background: '#ddd', marginBottom: 6 }} />
            <div style={{ width: '55%', height: 9, borderRadius: 4, background: '#ddd', marginBottom: 16 }} />

            {/* CTA that's rage-clicked */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: rageAlert ? '#ff3c00' : '#111',
              color: 'white',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 11,
              fontWeight: 700,
              fontFamily: 'DM Mono, monospace',
              transition: 'background 0.5s',
              boxShadow: rageAlert ? '0 0 0 4px rgba(255,60,0,0.3)' : 'none',
            }}>
              {rageAlert ? '🔥 Add to Cart (broken)' : 'Add to Cart'}
            </div>
          </div>

          <div style={{ background: '#e8edf2', borderRadius: 12, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
            {/* Product image placeholder */}
            <div style={{ width: 60, height: 60, background: '#cdd5df', borderRadius: 8 }} />
            {rageAlert && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(255,60,0,0.08)',
                border: '2px solid rgba(255,60,0,0.5)',
                borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: '#ff3c00', fontFamily: 'DM Mono', fontWeight: 700,
              }}>
                RAGE-CLICK CLUSTER
              </div>
            )}
          </div>
        </div>

        {/* More skeleton rows */}
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{ background: '#eef0f4', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ width: '60%', height: 8, borderRadius: 4, background: '#d0d4dc', marginBottom: 6 }} />
              <div style={{ width: '80%', height: 6, borderRadius: 4, background: '#dde0e8', marginBottom: 4 }} />
              <div style={{ width: '45%', height: 6, borderRadius: 4, background: '#dde0e8' }} />
            </div>
          ))}
        </div>
      </div>

      {/* Status ribbon at the bottom */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        background: phase === 'done'
          ? 'linear-gradient(135deg, #0a2f1e, #0d4f30)'
          : phase === 'analyzing'
            ? 'linear-gradient(135deg, #1a1a2e, #16213e)'
            : 'rgba(17,17,17,0.95)',
        backdropFilter: 'blur(12px)',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        transition: 'background 0.8s',
        zIndex: 10,
      }}>
        {/* Pulsing dot */}
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: phase === 'done' ? '#22c55e' : phase === 'analyzing' ? '#f59e0b' : '#ff3c00',
          boxShadow: `0 0 0 ${phase === 'done' ? '3px rgba(34,197,94,0.4)' : '3px rgba(255,60,0,0.4)'}`,
          animation: phase === 'done' ? 'none' : 'hp-pulse 1s ease-in-out infinite',
          flexShrink: 0,
        }} />

        <span style={{
          fontFamily: 'DM Mono, monospace',
          fontSize: 11,
          color: phase === 'done' ? '#4ade80' : '#e0e0e0',
          flex: 1,
          letterSpacing: '0.02em',
        }}>
          {phase === 'idle' && 'Initializing session capture...'}
          {phase === 'recording' && (activeLabel || '● Recording live session...')}
          {phase === 'analyzing' && (activeLabel || 'Analyzing interaction patterns...')}
          {phase === 'done' && (activeLabel || 'Patch #4021 generated ✓')}
        </span>

        {patchReady && (
          <span style={{
            background: 'rgba(34,197,94,0.15)',
            border: '1px solid rgba(34,197,94,0.4)',
            color: '#4ade80',
            fontFamily: 'DM Mono',
            fontSize: 10,
            padding: '2px 8px',
            borderRadius: 4,
            fontWeight: 700,
            letterSpacing: '0.05em',
          }}>
            VIEW PATCH →
          </span>
        )}

        <span style={{ fontFamily: 'DM Mono', fontSize: 10, color: '#666', letterSpacing: '0.04em' }}>
          {pointsRef.current.length} pts
        </span>
      </div>
    </div>
  )
}
