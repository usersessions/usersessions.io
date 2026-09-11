'use client'

import { useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'

export function CanvasHeatmap() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { theme } = useTheme()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = window.innerWidth
    let height = window.innerHeight

    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width
      canvas.height = height
    }
    window.addEventListener('resize', resize)
    resize()

    let mouse = { x: -1000, y: -1000 }
    let isMoving = false

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
      isMoving = true
    }
    window.addEventListener('mousemove', handleMouseMove)

    let animationFrameId: number
    const draw = () => {
      // Fade layer matches the theme background to create trails
      const fadeColor = theme === 'dark' ? 'rgba(9, 9, 15, 0.04)' : 'rgba(252, 251, 249, 0.04)'
      ctx.fillStyle = fadeColor
      ctx.fillRect(0, 0, width, height)

      if (isMoving) {
        const radius = 70
        const gradient = ctx.createRadialGradient(
          mouse.x, mouse.y, 0,
          mouse.x, mouse.y, radius
        )
        // Red/Orange heat core
        gradient.addColorStop(0, 'rgba(255, 60, 0, 0.25)')
        gradient.addColorStop(0.4, 'rgba(255, 140, 64, 0.1)')
        gradient.addColorStop(1, 'rgba(255, 180, 80, 0)')

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(mouse.x, mouse.y, radius, 0, Math.PI * 2)
        ctx.fill()
        
        isMoving = false
      }

      animationFrameId = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', handleMouseMove)
      cancelAnimationFrame(animationFrameId)
    }
  }, [theme])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        opacity: 0.8,
        mixBlendMode: 'multiply', // Better heat saturation in light mode
      }}
    />
  )
}
