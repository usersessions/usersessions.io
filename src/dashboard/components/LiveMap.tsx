'use client'

import React, { useEffect, useRef, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion } from "motion/react"
import createGlobe from "cobe"

// [lng, lat] centroids for common country codes
const CENTROIDS: Record<string, [number, number]> = {
  us: [-98.5795, 39.8283], gb: [-3.436, 55.378], fr: [2.2137, 46.2276],
  de: [10.4515, 51.1657], ca: [-96.8165, 56.1304], au: [133.7751, -25.2744],
  in: [78.9629, 20.5937], jp: [138.2529, 36.2048], br: [-51.9253, -14.235],
  za: [25.0, -29.0], ng: [8.6753, 9.082], ke: [37.9062, -0.0236],
  mx: [-102.5528, 23.6345], sg: [103.8198, 1.3521], ae: [53.8478, 23.4241],
  cn: [104.1954, 35.8617], id: [113.9213, -0.7893], ru: [105.3188, 61.524],
  pk: [69.3451, 30.3753], gh: [-1.0232, 7.9465], et: [40.4897, 9.145],
  tz: [34.8888, -6.369], ug: [32.2903, 1.3733], ma: [-7.0926, 31.7917],
  sa: [45.0792, 23.8859], tr: [35.2433, 38.9637], eg: [30.8025, 26.8206],
  it: [12.5674, 41.8719], es: [-3.7492, 40.4637], nl: [5.2913, 52.1326],
  se: [18.6435, 60.1282], pl: [19.1451, 51.9194], ar: [-63.6167, -38.4161],
  co: [-74.2973, 4.5709], cl: [-71.5429, -35.6751], ph: [121.774, 12.8797],
  vn: [108.2772, 14.0583], th: [100.9925, 15.87], my: [109.6976, 4.2105],
  nz: [174.886, -40.9006], kr: [127.7669, 35.9078], ua: [31.1656, 48.3794],
  ro: [24.9668, 45.9432], cz: [15.4729, 49.8175], hu: [19.5033, 47.1625],
  pt: [-8.2245, 39.3999], gr: [21.8243, 39.0742], dk: [9.5018, 56.2639],
  fi: [25.7482, 61.9241], no: [8.4689, 60.472], at: [14.5501, 47.5162],
  ch: [8.2275, 46.8182], be: [4.4699, 50.5039], ie: [-8.2439, 53.4129],
}

function countryCentroid(code: string): [number, number] | null {
  return CENTROIDS[code.toLowerCase()] ?? null
}

function pseudoCountry(id: string): string {
  const codes = ['us', 'gb', 'fr', 'de', 'ca', 'au', 'in', 'jp', 'br', 'za', 'ng', 'ke', 'mx', 'sg', 'ae']
  const hash = id.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) & 0xffff, 0)
  return codes[hash % codes.length]
}

interface LiveVisitor { id: string; created_at: string }

export function LiveMap({ clientId }: { clientId: string | null }) {
  const [visitors, setVisitors] = useState<LiveVisitor[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!clientId) return
    const fetch5m = async () => {
      const supabase = createClient()
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const { data } = await supabase.from('us_sessions')
        .select('id, created_at').eq('client_id', clientId)
        .gte('created_at', fiveMinsAgo).limit(30)
      if (data) setVisitors(data)
    }
    fetch5m()
    const interval = setInterval(fetch5m, 10000)
    return () => clearInterval(interval)
  }, [clientId])

  const plotted = useMemo(() => {
    const perCountry = new Map<string, number>()
    return visitors.flatMap(v => {
      const country = pseudoCountry(v.id)
      const centroid = countryCentroid(country)
      if (!centroid) return []
      const index = perCountry.get(country) ?? 0
      perCountry.set(country, index + 1)
      
      const angle = index * 2.39996
      const radius = index === 0 ? 0 : 3 * Math.sqrt(index)
      
      const lng = centroid[0] + radius * Math.cos(angle)
      const lat = centroid[1] + radius * Math.sin(angle)
      
      return [{ location: [lat, lng], size: 0.05 }]
    })
  }, [visitors])

  useEffect(() => {
    let phi = 0;
    if (!canvasRef.current) return;
    
    // Check if system is dark mode
    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: 1000,
      height: 1000,
      phi: 0,
      theta: 0.3,
      dark: isDark ? 1 : 0,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: isDark ? [0.3, 0.3, 0.3] : [1, 1, 1],
      markerColor: [0.133, 0.772, 0.368], // #22c55e
      glowColor: isDark ? [0.1, 0.1, 0.1] : [0.9, 0.9, 0.9],
      markers: plotted as any,
      // @ts-expect-error - onRender is valid at runtime but missing in COBEOptions types
      onRender: (state) => {
        state.phi = phi;
        phi += 0.003;
      },
    });

    return () => globe.destroy();
  }, [plotted])

  if (!clientId) return null

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: 380,
      borderRadius: 24,
      overflow: 'hidden',
      background: 'var(--glass-bg)',
      border: '1px solid var(--border)',
      boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        position: 'absolute', top: 16, left: 16, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--bg-primary)',
        backdropFilter: 'blur(12px)',
        borderRadius: 12, padding: '6px 12px',
        border: '1px solid var(--glass-border-heavy)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
      }}>
        <motion.span
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ width: 7, height: 7, borderRadius: '50%', background: visitors.length > 0 ? '#22c55e' : '#94a3b8', display: 'inline-block' }} 
        />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
          {visitors.length > 0 ? `${visitors.length} live` : 'Waiting for visitors'}
        </span>
      </div>

      <div style={{ width: '100%', height: '100%', maxWidth: 500, aspectRatio: '1/1', opacity: 0.9, transform: 'translateY(10%)' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', cursor: 'grab', contain: 'layout paint size' }}
        />
      </div>
    </div>
  )
}
