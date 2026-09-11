'use client'

import { useMemo } from 'react'
import { motion } from "motion/react"
import { AreaChart } from '../charts/area-chart'
import { Area } from '../charts/area'
import { Background } from '../charts/background'

interface DailyData {
  date: string
  sessions: number
  friction: number
}

interface TrendChartProps {
  data: DailyData[]
}

export function TrendChart({ data }: TrendChartProps) {
  // Add some slight motion layout entrance
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
      style={{ width: '100%', height: 280, position: 'relative' }}
    >
      <AreaChart
        data={data as any}
        status="ready"
        aspectRatio="auto"
        animationDuration={500}
        yDomainTweenDuration={0}
        enterTransition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
        margin={{ top: 12, right: 0, bottom: 24, left: 0 }}
        className="h-full w-full"
        xLabelFormat={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      >
        <Background pattern="dots" opacity={0.4} />
        
        {/* Total Sessions (Blue) */}
        <Area
          dataKey="sessions"
          fill="#3b82f6"
          fillOpacity={0.08}
          strokeWidth={1.5}
          strokeOpacity={0.45}
          dimOpacity={0.28}
          fadeEdges
          loadingStyle="sweep"
          loadingStrokeWidth={0.6}
          loadingStroke="var(--muted-foreground)"
          loadingStrokeOpacity={0.35}
        />

        {/* Friction Sessions (Red) */}
        <Area
          dataKey="friction"
          fill="#ef4444"
          fillOpacity={0.12}
          strokeWidth={1.5}
          strokeOpacity={0.7}
          dimOpacity={0.28}
          fadeEdges
          loadingStyle="sweep"
          loadingStrokeWidth={0.6}
          loadingStroke="var(--muted-foreground)"
          loadingStrokeOpacity={0.35}
        />
      </AreaChart>
    </motion.div>
  )
}
