'use client'

import { motion, AnimatePresence } from "motion/react"
import { User, CheckCheck } from 'lucide-react'
import { useState, useEffect } from 'react'

export function LiveDemoSandbox() {
  const [step, setStep] = useState<0 | 1 | 2>(0) // 0: Broken, 1: AI Detecting, 2: Fixed
  const [clickCount, setClickCount] = useState(0)

  // Simulation sequence
  useEffect(() => {
    if (clickCount >= 3 && step === 0) {
      setStep(1)
      setTimeout(() => setStep(2), 2500)
    }
  }, [clickCount, step])

  return (
    <div className="relative w-full max-w-md mx-auto" style={{ zIndex: 10 }}>
      {/* The AI Action Feed */}
      <AnimatePresence>
        {step > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="absolute -top-24 left-0 right-0 bg-white dark:bg-[#0F0F1A] border border-[var(--glass-border-heavy)] p-4 rounded-[var(--rounded-md)] shadow-[var(--shadow-glow-primary)]"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 rounded-full bg-[var(--amber)] animate-pulse" />
              <div className="font-mono text-xs tracking-wider text-[var(--muted)] uppercase">
                {step === 1 ? 'AI Remediation Active' : 'Patch Deployed'}
              </div>
            </div>
            <div className="font-sans text-sm text-[var(--text-primary)] font-medium">
              {step === 1 
                ? 'Rage clicks detected. Analyzing DOM...' 
                : 'Z-index collision fixed. Checkout flow unlocked.'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The Mock App (SaaS Checkout) */}
      <div className="bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] rounded-[var(--rounded-lg)] p-6 shadow-2xl transition-all duration-500">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-full bg-[var(--primary-dim)] flex items-center justify-center">
            <User size={16} style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <div className="text-sm font-bold text-[var(--text-primary)]">Pro Subscription</div>
            <div className="text-xs text-[var(--muted)]">$299/mo</div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="h-2 w-full bg-[var(--glass-border)] rounded-full" />
          <div className="h-2 w-3/4 bg-[var(--glass-border)] rounded-full" />
          <div className="h-2 w-5/6 bg-[var(--glass-border)] rounded-full" />
        </div>

        <div className="mt-8 relative">
          {/* The broken invisible layer that causes rage clicks in step 0 */}
          {step === 0 && (
            <div 
              className="absolute inset-0 z-50 cursor-pointer" 
              onClick={() => setClickCount(c => c + 1)}
            />
          )}

          <motion.button 
            className="w-full py-3 rounded-[var(--rounded-sm)] font-sans font-bold text-sm transition-all flex items-center justify-center gap-2"
            style={{
              backgroundColor: step === 2 ? 'var(--green)' : 'var(--primary)',
              color: step === 2 ? '#000' : '#fff',
              opacity: step === 0 ? 0.8 : 1,
            }}
            animate={step === 0 && clickCount > 0 ? { x: [-2, 2, -2, 2, 0] } : {}}
            transition={{ duration: 0.2 }}
          >
            {step === 2 ? 'Upgraded Successfully' : 'Confirm Upgrade'}
            {step === 2 && (
              <CheckCheck size={16} />
            )}
          </motion.button>
        </div>
      </div>
    </div>
  )
}
