'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform } from "motion/react"
import { SplitText } from './SplitText'

export function HeroParallax({ children, demo }: { children: React.ReactNode; demo: React.ReactNode }) {
  const ref = useRef(null)
  const { scrollY } = useScroll()

  // Parallax transforms: move up slower than scrolling
  const yText = useTransform(scrollY, [0, 800], [0, 200])
  const opacityText = useTransform(scrollY, [0, 400], [1, 0])

  // Hero glow expands and fades as you scroll down
  const scaleGlow = useTransform(scrollY, [0, 800], [1, 1.5])
  const yGlow = useTransform(scrollY, [0, 800], [0, 400])
  const opacityGlow = useTransform(scrollY, [0, 400], [1, 0])

  return (
    <div ref={ref} className="hero-parallax-container" style={{ position: 'relative', zIndex: 1, width: '100%' }}>
      <motion.div
        className="hero-glow"
        style={{ scale: scaleGlow, y: yGlow, opacity: opacityGlow }}
        aria-hidden="true"
      />

      <div className="wrap">
        <motion.div style={{ y: yText, opacity: opacityText }}>
          <h1 className="hero-heading">
            <SplitText text="Website analytics, heatmaps and session replays don't fix issues.
" className="hero-split" />
          </h1>
          <div className="hero-content">
            {children}
          </div>
        </motion.div>
        {demo}
      </div>
    </div>
  )
}
