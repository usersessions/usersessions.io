'use client'

import React, { useState } from 'react'
import { motion } from "motion/react"

export function LivePatchDemo() {
  const [status, setStatus] = useState<'idle' | 'patching' | 'fixed'>('idle')

  const handleFix = async () => {
    setStatus('patching')
    try {
      // Simulate network delay for dramatic effect if it's too fast
      const minDelay = new Promise(resolve => setTimeout(resolve, 800))
      
      const res = await fetch('/api/demo/patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selector: '#demo-broken-box',
          issue_description: 'The layout of this box is broken. It has terrible contrast (dark grey text on dark grey background) and the alignment is completely off.',
          html: '<div id="demo-broken-box" style="background-color: #333; color: #444; padding: 2px; margin-left: -20px; border: 3px dashed red;">Broken Element</div>'
        })
      })

      const data = await res.json()
      await minDelay // ensure the animation runs a bit

      if (data.patch && data.patch.patch_payload && data.patch.patch_payload.styles) {
        const el = document.getElementById('demo-broken-box')
        if (el) {
          Object.assign(el.style, data.patch.patch_payload.styles)
        }
      }
      setStatus('fixed')
    } catch (e) {
      console.error(e)
      setStatus('idle')
    }
  }

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      minHeight: '240px',
      backgroundColor: '#0a0a0a',
      borderRadius: '16px',
      border: '1px solid var(--border-dark)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-dark)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Demo 3: Live Patching Engine</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontFamily: 'monospace' }}>Sandbox Mode</span>
      </div>

      <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px' }}>
        
        {/* The Sandboxed Element */}
        <div style={{ width: '100%', maxWidth: '300px', padding: '24px', backgroundColor: '#1a1a1a', borderRadius: '12px', border: '1px solid #333', display: 'flex', justifyContent: 'center' }}>
          <div id="demo-broken-box" style={{ 
            backgroundColor: '#333', 
            color: '#444', 
            padding: '2px', 
            marginLeft: '-20px', 
            border: '3px dashed red',
            transition: 'all 0.5s ease'
          }}>
            {status === 'fixed' ? 'Fixed Element' : 'Broken Element'}
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          {status === 'idle' && (
            <button 
              onClick={handleFix}
              style={{ padding: '10px 20px', backgroundColor: 'var(--orange)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
            >
              Show me how it fixes this
            </button>
          )}
          {status === 'patching' && (
            <motion.div 
              animate={{ opacity: [0.5, 1, 0.5] }} 
              transition={{ repeat: Infinity, duration: 1 }}
              style={{ color: 'var(--orange)', fontSize: '0.9rem', fontWeight: 500 }}
            >
              Analyzing and generating patch via LLM...
            </motion.div>
          )}
          {status === 'fixed' && (
            <div style={{ color: '#10b981', fontSize: '0.9rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
              Patch applied successfully
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
