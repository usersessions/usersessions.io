'use client'

import { useEffect } from 'react'

export function PremiumEffects() {
  useEffect(() => {
    // 1. Scroll-Driven Cinematic Reveals
    // Use a small delay to let the DOM fully paint before observing
    const timer = setTimeout(() => {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add('reveal-visible')
            observer.unobserve(e.target)
          }
        })
      }, { threshold: 0.05, rootMargin: '0px 0px -20px 0px' })

      const hiddenElements = document.querySelectorAll('.reveal-hidden')
      hiddenElements.forEach(el => observer.observe(el))

      // Immediately reveal anything already in the viewport
      hiddenElements.forEach(el => {
        const rect = el.getBoundingClientRect()
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          el.classList.add('reveal-visible')
          observer.unobserve(el)
        }
      })

      return () => observer.disconnect()
    }, 50)

    // 2. Cursor-Tracking Lighting on Glass Panels
    let ticking = false
    let lastX = 0
    let lastY = 0

    const handleMouse = (e: MouseEvent) => {
      lastX = e.clientX
      lastY = e.clientY

      if (!ticking) {
        window.requestAnimationFrame(() => {
          const panels = document.querySelectorAll<HTMLElement>('.glass-panel')
          panels.forEach(el => {
            const rect = el.getBoundingClientRect()
            const x = lastX - rect.left
            const y = lastY - rect.top
            el.style.setProperty('--mouse-x', `${x}px`)
            el.style.setProperty('--mouse-y', `${y}px`)

            if (lastX >= rect.left && lastX <= rect.right && lastY >= rect.top && lastY <= rect.bottom) {
              const centerX = rect.width / 2
              const centerY = rect.height / 2
              const rotateX = ((y - centerY) / centerY) * -6
              const rotateY = ((x - centerX) / centerX) * 6
              el.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`
              el.style.transition = 'none'
            } else {
              el.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)'
              el.style.transition = 'transform 600ms cubic-bezier(0.23, 1, 0.32, 1)'
            }
          })
          ticking = false
        })
        ticking = true
      }
    }
    window.addEventListener('mousemove', handleMouse, { passive: true })

    return () => {
      clearTimeout(timer)
      window.removeEventListener('mousemove', handleMouse)
    }
  }, [])

  return null
}
