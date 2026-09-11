'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from "motion/react"

export function SampleReplayDemo() {
  const [phase, setPhase] = useState<'idle' | 'moving' | 'clicking' | 'finding'>('idle')
  const [cursorPos, setCursorPos] = useState({ x: 200, y: 150 })
  const [clicks, setClicks] = useState(0)

  useEffect(() => {
    let timeout: NodeJS.Timeout

    const runSequence = () => {
      setPhase('moving')
      setCursorPos({ x: 120, y: 180 })
      
      timeout = setTimeout(() => {
        setPhase('clicking')
        
        // Simulate rage clicks
        let clickCount = 0
        const clickInterval = setInterval(() => {
          clickCount++
          setClicks(clickCount)
          if (clickCount >= 3) {
            clearInterval(clickInterval)
            setPhase('finding')
            
            setTimeout(() => {
              // Reset after a while
              setPhase('idle')
              setCursorPos({ x: 200, y: 150 })
              setClicks(0)
              setTimeout(runSequence, 2000)
            }, 5000)
          }
        }, 300)
      }, 1000)
    }

    const initialTimeout = setTimeout(runSequence, 1000)
    return () => {
      clearTimeout(initialTimeout)
      clearTimeout(timeout)
    }
  }, [])

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      minHeight: '240px',
      backgroundColor: '#0a0a0a',
      borderRadius: '16px',
      overflow: 'hidden',
      border: '1px solid var(--border-dark)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Label */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-dark)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Demo 2: Sample Session Replay</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--orange)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', backgroundColor: 'var(--orange)', borderRadius: '50%', display: 'inline-block' }} />
          Recording
        </span>
      </div>

      {/* Fake UI */}
      <div style={{ flex: 1, padding: '24px', position: 'relative' }}>
        <div style={{ width: '60%', height: '16px', backgroundColor: '#333', borderRadius: '4px', marginBottom: '16px' }} />
        <div style={{ width: '40%', height: '12px', backgroundColor: '#222', borderRadius: '4px', marginBottom: '32px' }} />
        
        <button style={{
          padding: '12px 24px',
          backgroundColor: '#333',
          color: '#888',
          border: 'none',
          borderRadius: '8px',
          cursor: 'not-allowed',
          position: 'relative',
          overflow: 'hidden'
        }}>
          Checkout (Broken)
          {/* Ripple effects for fake clicks */}
          <AnimatePresence>
            {Array.from({ length: clicks }).map((_, i) => (
              <motion.span
                key={i}
                initial={{ scale: 0, opacity: 0.5 }}
                animate={{ scale: 2, opacity: 0 }}
                transition={{ duration: 0.5 }}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: '40px',
                  height: '40px',
                  backgroundColor: 'rgba(255,0,0,0.4)',
                  borderRadius: '50%',
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none'
                }}
              />
            ))}
          </AnimatePresence>
        </button>

        {/* Fake Cursor */}
        <motion.div
          animate={{ x: cursorPos.x, y: cursorPos.y, scale: phase === 'clicking' ? 0.9 : 1 }}
          transition={{ 
            x: { type: 'spring', stiffness: 100, damping: 20 },
            y: { type: 'spring', stiffness: 100, damping: 20 },
            scale: { type: 'spring', stiffness: 500, damping: 20 }
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '24px',
            height: '24px',
            zIndex: 10
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4.3013 3.19777L19.2612 11.2359C20.4076 11.8524 20.2173 13.5601 18.9463 13.882L13.8808 15.1652L11.5835 19.9885C11.0267 21.157 9.35122 21.0553 8.93297 19.8252L4.05389 5.48512C3.65586 4.31499 4.80164 3.09062 6.00282 3.51355L4.3013 3.19777Z" fill="white" stroke="black" strokeWidth="1.5"/>
          </svg>
        </motion.div>

        {/* Finding Notification */}
        <AnimatePresence>
          {phase === 'finding' && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              style={{
                position: 'absolute',
                bottom: '24px',
                right: '24px',
                backgroundColor: 'rgba(229, 90, 0, 0.1)',
                border: '1px solid var(--orange)',
                padding: '16px',
                borderRadius: '12px',
                width: '240px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                backdropFilter: 'blur(8px)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>🤖</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white' }}>Rage Click Detected</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', margin: 0, lineHeight: 1.4 }}>
                User repeatedly clicked disabled checkout button. Generated CSS patch to clarify disabled state.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
