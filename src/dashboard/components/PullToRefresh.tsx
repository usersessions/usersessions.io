'use client'

import { useEffect, useRef, useState } from 'react'

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const [startY, setStartY] = useState(0)
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        setStartY(e.touches[0].clientY)
      } else {
        setStartY(0)
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (startY === 0 || refreshing) return
      
      const currentY = e.touches[0].clientY
      const distance = currentY - startY

      // Only handle pull down when at the top
      if (distance > 0 && window.scrollY === 0) {
        // Prevent default scrolling when pulling to refresh
        if (distance > 10) e.preventDefault()
        // Add resistance to the pull
        setPullDistance(Math.min(distance * 0.4, 80))
      }
    }

    const handleTouchEnd = () => {
      if (pullDistance > 60 && !refreshing) {
        setRefreshing(true)
        setPullDistance(50) // Snap to refreshing position
        window.location.reload()
      } else {
        setPullDistance(0)
      }
      setStartY(0)
    }

    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [startY, pullDistance, refreshing])

  return (
    <div ref={containerRef} className="relative w-full h-full flex flex-col flex-1">
      {/* Visual Refresh Indicator */}
      <div 
        className="absolute top-0 left-0 w-full flex justify-center overflow-hidden z-50 pointer-events-none transition-transform duration-200"
        style={{ 
          height: `${pullDistance}px`,
          opacity: pullDistance > 10 ? 1 : 0
        }}
      >
        <div className="flex items-end pb-2">
          <div className="bg-white dark:bg-[var(--bg-primary)] shadow-md rounded-full px-4 py-2 flex items-center gap-2 border border-[var(--line)]">
            <svg 
              className={`w-4 h-4 text-[var(--orange)] ${refreshing ? 'animate-spin' : ''}`} 
              style={{ transform: `rotate(${pullDistance * 3}deg)` }}
              xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              {refreshing ? 'Refreshing...' : 'Pull to refresh'}
            </span>
          </div>
        </div>
      </div>
      
      {/* Content wrapper */}
      <div 
        className="transition-transform duration-200 w-full h-full flex flex-col md:flex-row flex-1"
        style={{ transform: `translateY(${pullDistance}px)` }}
      >
        {children}
      </div>
    </div>
  )
}
