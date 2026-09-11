'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from "motion/react"
import {
  PiChatCircleTextBold,
  PiBugBold,
  PiLightbulbBold,
  PiHandsClappingBold,
  PiChatsBold,
  PiXBold,
  PiLightningBold,
} from 'react-icons/pi'

type FeedbackType = 'general' | 'bug' | 'feature' | 'praise'

interface FeedbackButtonProps {
  label?: string
  /** Pre-fill the email field with the signed-in user's address */
  userEmail?: string
}

const TYPE_OPTIONS: { id: FeedbackType; icon: React.ReactNode; label: string; color: string; desc: string }[] = [
  { id: 'bug',     icon: <PiBugBold size={14} />,             label: 'Bug',             color: '#ef4444', desc: 'Something is broken' },
  { id: 'feature', icon: <PiLightbulbBold size={14} />,       label: 'Feature Request', color: '#f59e0b', desc: 'I wish it could…' },
  { id: 'general', icon: <PiChatsBold size={14} />,           label: 'General',         color: '#6366f1', desc: 'General feedback' },
  { id: 'praise',  icon: <PiHandsClappingBold size={14} />,   label: 'Praise',          color: '#10b981', desc: 'Something I love' },
]

export function FeedbackButton({ label = 'Feedback', userEmail }: FeedbackButtonProps) {
  const [open, setOpen]       = useState(false)
  const [mounted, setMounted] = useState(false)
  const [type, setType]       = useState<FeedbackType>('bug')
  const [email, setEmail]     = useState(userEmail ?? '')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep]       = useState<'form' | 'success'>('form')
  const [error, setError]     = useState('')
  const textareaRef           = useRef<HTMLTextAreaElement>(null)

  // Portal mount guard — ensures we only render into document.body on the client
  useEffect(() => { setMounted(true) }, [])

  // Sync email if userEmail prop changes
  useEffect(() => {
    setEmail(userEmail ?? '')
  }, [userEmail])

  // Escape to close
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  // On open: reset to form, focus textarea
  useEffect(() => {
    if (open) {
      setStep('form')
      setError('')
      setMessage('')
      setType('bug')
      // Don't reset email — keep the pre-filled value
      setTimeout(() => textareaRef.current?.focus(), 150)
    }
  }, [open])

  // Lock body scroll while modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  const handleSubmit = useCallback(async () => {
    if (!message.trim()) { setError('Please describe the issue so we can fix it fast.'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() || undefined, type, message }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? 'Something went wrong. Please try again.')
      }
      setStep('success')
      setMessage('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [email, type, message])

  const activeOption = TYPE_OPTIONS.find(o => o.id === type)!

  return (
    <>
      {/* ── Trigger Button ── */}
      <button
        id="feedback-trigger-btn"
        onClick={() => setOpen(true)}
        className="feedback-trigger-btn"
        aria-label="Open feedback"
      >
        <PiChatCircleTextBold size={14} />
        {label}
      </button>

      {/* ── Modal — rendered via portal to escape sticky header stacking context ── */}
      {mounted && createPortal(
      <AnimatePresence>
        {open && (
          <motion.div
            key="feedback-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
            style={{
              // Scroll the backdrop — the panel sits at the top with padding
              // This ensures the full form is always reachable regardless of height
              position: 'fixed',
              inset: 0,
              zIndex: 10000,
              overflowY: 'auto',
              padding: '64px 16px 32px', // 64px top clears the sticky header
              background: 'rgba(0,0,0,0.28)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
            }}
          >
            <motion.div
              key="feedback-panel"
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 480,
                background: 'var(--bg-canvas, #ffffff)',
                border: '1px solid var(--border, rgba(0,0,0,0.1))',
                borderRadius: 20,
                padding: '28px 28px 24px',
                position: 'relative',
                boxShadow: '0 24px 64px -8px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.04)',
              }}
            >
              {/* Close button */}
              <button
                onClick={() => setOpen(false)}
                aria-label="Close feedback"
                style={{
                  position: 'absolute', top: 14, right: 14,
                  width: 28, height: 28,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--bg-primary, rgba(0,0,0,0.04))',
                  border: '1px solid var(--border, rgba(0,0,0,0.09))',
                  borderRadius: 8,
                  color: 'var(--text-secondary, rgba(0,0,0,0.4))',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <PiXBold size={12} />
              </button>

              {step === 'form' ? (
                <>
                  {/* ── Header ── */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '3px 10px', borderRadius: 99,
                      background: 'rgba(229,90,0,0.08)',
                      border: '1px solid rgba(229,90,0,0.2)',
                      marginBottom: 10,
                    }}>
                      <PiLightningBold size={10} color="var(--orange, #e55a00)" />
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10, fontWeight: 600,
                        letterSpacing: '0.08em', textTransform: 'uppercase',
                        color: 'var(--orange, #e55a00)',
                      }}>
                        We fix bugs fast
                      </span>
                    </div>
                    <h2 style={{
                      fontSize: 20, fontWeight: 700,
                      color: 'var(--text-primary, #0a0a0a)',
                      margin: '0 0 5px', letterSpacing: '-0.03em', lineHeight: 1.2,
                    }}>
                      Tell us what's going on
                    </h2>
                    <p style={{
                      fontSize: 13,
                      color: 'var(--text-secondary, rgba(0,0,0,0.5))',
                      margin: 0, lineHeight: 1.5,
                    }}>
                      Every report goes directly to the team. We read everything and ship fixes fast.
                    </p>
                  </div>

                  {/* ── Type Picker ── */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 18 }}>
                    {TYPE_OPTIONS.map(opt => {
                      const isActive = type === opt.id
                      return (
                        <button
                          key={opt.id}
                          onClick={() => setType(opt.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 7,
                            padding: '8px 12px',
                            borderRadius: 10,
                            border: `1.5px solid ${isActive ? opt.color + '60' : 'var(--border, rgba(0,0,0,0.1))'}`,
                            background: isActive ? opt.color + '0f' : 'var(--bg-primary, rgba(0,0,0,0.03))',
                            color: isActive ? opt.color : 'var(--text-secondary, rgba(0,0,0,0.5))',
                            fontSize: 12, fontWeight: isActive ? 600 : 500,
                            cursor: 'pointer', fontFamily: 'inherit',
                            transition: 'all 0.15s',
                            textAlign: 'left',
                          }}
                        >
                          <span style={{ color: isActive ? opt.color : 'var(--text-secondary, rgba(0,0,0,0.4))', flexShrink: 0 }}>
                            {opt.icon}
                          </span>
                          <span>{opt.label}</span>
                        </button>
                      )
                    })}
                  </div>

                  {/* ── Message ── */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{
                      display: 'block', fontSize: 11, fontWeight: 600,
                      letterSpacing: '0.07em', textTransform: 'uppercase',
                      color: 'var(--text-secondary, rgba(0,0,0,0.45))',
                      marginBottom: 7, fontFamily: 'var(--font-mono)',
                    }}>
                      {type === 'bug' ? 'What broke?' : type === 'feature' ? 'What should we build?' : type === 'praise' ? 'What did you love?' : 'Your message'} *
                    </label>
                    <textarea
                      ref={textareaRef}
                      rows={4}
                      placeholder={
                        type === 'bug'     ? 'Describe what happened and what you expected...' :
                        type === 'feature' ? 'Describe the feature and how it would help you...' :
                        type === 'praise'  ? 'What made your day? We love hearing this 🙌' :
                        'Share whatever is on your mind...'
                      }
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleSubmit() }}
                      style={{
                        width: '100%', padding: '11px 14px',
                        background: 'var(--bg-primary, rgba(0,0,0,0.03))',
                        border: `1.5px solid ${error && !message.trim() ? '#ef4444' : 'var(--border, rgba(0,0,0,0.1))'}`,
                        borderRadius: 10,
                        color: 'var(--text-primary, #0a0a0a)',
                        fontSize: 14, fontFamily: 'inherit',
                        outline: 'none', resize: 'vertical',
                        minHeight: 110, boxSizing: 'border-box',
                        transition: 'border-color 0.15s',
                      }}
                    />
                    <p style={{ fontSize: 11, color: 'var(--text-secondary, rgba(0,0,0,0.3))', margin: '5px 0 0', textAlign: 'right' }}>
                      ⌘↵ to send
                    </p>
                  </div>

                  {/* ── Email ── */}
                  <div style={{ marginBottom: 18 }}>
                    <label style={{
                      display: 'block', fontSize: 11, fontWeight: 600,
                      letterSpacing: '0.07em', textTransform: 'uppercase',
                      color: 'var(--text-secondary, rgba(0,0,0,0.45))',
                      marginBottom: 7, fontFamily: 'var(--font-mono)',
                    }}>
                      Reply email {!userEmail && <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span>}
                    </label>
                    <input
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      style={{
                        width: '100%', padding: '10px 14px',
                        background: 'var(--bg-primary, rgba(0,0,0,0.03))',
                        border: '1.5px solid var(--border, rgba(0,0,0,0.1))',
                        borderRadius: 10,
                        color: 'var(--text-primary, #0a0a0a)',
                        fontSize: 13, fontFamily: 'inherit',
                        outline: 'none', boxSizing: 'border-box',
                        transition: 'border-color 0.15s',
                      }}
                    />
                    <p style={{ fontSize: 11, color: 'var(--text-secondary, rgba(0,0,0,0.35))', margin: '5px 0 0' }}>
                      {userEmail
                        ? 'Pre-filled from your account. Clear it to send anonymously.'
                        : 'Leave your email and we\'ll follow up directly.'}
                    </p>
                  </div>

                  {/* ── Error ── */}
                  {error && (
                    <div style={{
                      fontSize: 13, color: '#dc2626',
                      margin: '0 0 14px',
                      padding: '10px 14px',
                      background: 'rgba(220,38,38,0.06)',
                      border: '1px solid rgba(220,38,38,0.18)',
                      borderRadius: 8,
                    }}>
                      {error}
                    </div>
                  )}

                  {/* ── Submit ── */}
                  <button
                    id="feedback-submit-btn"
                    onClick={handleSubmit}
                    disabled={loading}
                    style={{
                      width: '100%', padding: '13px 20px',
                      background: loading ? 'rgba(229,90,0,0.55)' : activeOption.color === '#6366f1' ? 'var(--orange, #e55a00)' : activeOption.color,
                      color: '#fff', border: 'none', borderRadius: 10,
                      fontSize: 14, fontWeight: 700,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit', letterSpacing: '-0.01em',
                      transition: 'all 0.2s',
                      boxShadow: loading ? 'none' : `0 4px 16px ${activeOption.color}40`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                  >
                    {loading ? (
                      <>
                        <span style={{
                          width: 14, height: 14, borderRadius: '50%',
                          border: '2px solid rgba(255,255,255,0.35)',
                          borderTopColor: '#fff',
                          display: 'inline-block',
                          animation: 'fb-spin 0.7s linear infinite',
                        }} />
                        Sending…
                      </>
                    ) : (
                      <>
                        {activeOption.icon}
                        {type === 'bug' ? 'Report this bug →' : type === 'feature' ? 'Request this feature →' : type === 'praise' ? 'Send your praise →' : 'Send feedback →'}
                      </>
                    )}
                  </button>

                  <p style={{
                    fontSize: 11,
                    color: 'var(--text-secondary, rgba(0,0,0,0.35))',
                    textAlign: 'center', marginTop: 10, marginBottom: 0, lineHeight: 1.5,
                  }}>
                    Reports go directly to the team · Bugs are typically fixed within 24–48h
                  </p>
                </>
              ) : (
                /* ── Success ── */
                <div style={{ textAlign: 'center', padding: '20px 12px' }}>
                  <div style={{
                    width: 68, height: 68, borderRadius: '50%',
                    background: 'rgba(16,185,129,0.1)',
                    border: '1.5px solid rgba(16,185,129,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 20px', fontSize: 30,
                  }}>
                    🙏
                  </div>
                  <h2 style={{
                    fontSize: 22, fontWeight: 700,
                    color: 'var(--text-primary, #0a0a0a)',
                    margin: '0 0 8px', letterSpacing: '-0.03em',
                  }}>
                    Got it — we're on it.
                  </h2>
                  <p style={{
                    fontSize: 14,
                    color: 'var(--text-secondary, rgba(0,0,0,0.5))',
                    marginBottom: 8, lineHeight: 1.6,
                  }}>
                    Your {type === 'bug' ? 'bug report' : type === 'feature' ? 'feature request' : 'feedback'} went straight to the team.
                  </p>
                  {type === 'bug' && (
                    <p style={{
                      fontSize: 13,
                      color: 'var(--text-secondary, rgba(0,0,0,0.45))',
                      marginBottom: 24, lineHeight: 1.5,
                      padding: '10px 14px',
                      background: 'rgba(239,68,68,0.05)',
                      border: '1px solid rgba(239,68,68,0.15)',
                      borderRadius: 8,
                    }}>
                      🐛 Bugs are our top priority. We'll investigate and typically ship a fix within 24–48 hours.
                      {email?.trim() && ' We\'ll email you when it\'s resolved.'}
                    </p>
                  )}
                  {type === 'feature' && (
                    <p style={{
                      fontSize: 13,
                      color: 'var(--text-secondary, rgba(0,0,0,0.45))',
                      marginBottom: 24, lineHeight: 1.5,
                    }}>
                      💡 We track every request and build the most-wanted features first.
                      {email?.trim() && ' We\'ll let you know when this ships.'}
                    </p>
                  )}
                  {(type === 'general' || type === 'praise') && (
                    <p style={{
                      fontSize: 13,
                      color: 'var(--text-secondary, rgba(0,0,0,0.45))',
                      marginBottom: 24, lineHeight: 1.5,
                    }}>
                      Your message helps us build something people genuinely love. Thank you.
                    </p>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    style={{
                      padding: '10px 28px',
                      background: 'var(--bg-primary, rgba(0,0,0,0.04))',
                      border: '1px solid var(--border, rgba(0,0,0,0.1))',
                      borderRadius: 8, color: 'var(--text-primary, #0a0a0a)',
                      fontSize: 14, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                      transition: 'all 0.15s',
                    }}
                  >
                    Close
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      , document.body)}

      <style>{`
        @keyframes fb-spin { to { transform: rotate(360deg); } }
        .feedback-trigger-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 5px 13px;
          font-size: 13px;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          border-radius: 8px;
          border: 1px solid var(--border, rgba(0,0,0,0.1));
          background: var(--bg-primary, rgba(0,0,0,0.04));
          color: var(--text-secondary, rgba(0,0,0,0.55));
          transition: all 0.15s;
          letter-spacing: -0.01em;
          white-space: nowrap;
        }
        .feedback-trigger-btn:hover {
          border-color: rgba(229,90,0,0.4);
          background: rgba(229,90,0,0.07);
          color: var(--orange, #e55a00);
        }
      `}</style>
    </>
  )
}
