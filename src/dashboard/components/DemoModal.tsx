'use client'

/**
 * DemoModal — "Request a Demo" gating modal for usersessions.io
 *
 * Design:
 * - Dark premium glassmorphism overlay, consistent with homepage aesthetic
 * - Framer Motion entrance/exit
 * - Business-email validation (live, blocks on consumer domains)
 * - Escape key + backdrop click to close
 * - Three states: form → submitting → success
 */

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from "motion/react"

// Consumer/disposable domains blocked at submission time
const BLOCKED_DOMAINS = new Set([
  'gmail.com','googlemail.com','yahoo.com','yahoo.co.uk','yahoo.co.in',
  'yahoo.fr','yahoo.de','yahoo.es','yahoo.it','yahoo.ca','yahoo.com.au',
  'hotmail.com','hotmail.co.uk','hotmail.fr','hotmail.de','hotmail.es',
  'outlook.com','outlook.co.uk','outlook.fr','outlook.de','live.com',
  'live.co.uk','msn.com','icloud.com','me.com','mac.com',
  'aol.com','aol.co.uk','protonmail.com','protonmail.ch','pm.me',
  'zohomail.com','yandex.com','yandex.ru','mail.com','email.com',
  'gmx.com','gmx.de','gmx.net','web.de','libero.it','virgilio.it',
  'wanadoo.fr','orange.fr','free.fr','laposte.net','sfr.fr',
  'yopmail.com','guerrillamail.com','mailinator.com','10minutemail.com',
  'tempmail.com','temp-mail.org','throwawaymail.com','sharklasers.com',
  'dispostable.com','trashmail.com','fakeinbox.com','maildrop.cc',
])

function isBusinessEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain || !domain.includes('.')) return false
  return !BLOCKED_DOMAINS.has(domain)
}

interface Props {
  open: boolean
  onClose: () => void
}

const SPRING = { type: 'spring', bounce: 0, duration: 0.38 } as const

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: '8px',
  border: '1px solid rgba(245,243,238,0.12)',
  background: 'var(--bg-canvas)',
  color: '#F5F3EE',
  fontFamily: "'DM Mono', monospace",
  fontSize: '14px',
  outline: 'none',
  transition: 'border-color 180ms ease, box-shadow 180ms ease',
  boxSizing: 'border-box',
}

const LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'rgba(245,243,238,0.45)',
  marginBottom: '6px',
  fontFamily: "'DM Mono', monospace",
}

export function DemoModal({ open, onClose }: Props) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [currentTool, setCurrentTool] = useState('')
  const [teamSize, setTeamSize] = useState('')

  const [emailError, setEmailError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState(false)

  const firstInputRef = useRef<HTMLInputElement>(null)

  // Focus first input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => firstInputRef.current?.focus(), 120)
    }
  }, [open])

  // Escape to close
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  function validateEmail(val: string) {
    if (!val.includes('@')) return
    if (!isBusinessEmail(val)) {
      setEmailError('Please use your work email — we don\'t accept Gmail, Yahoo, or similar.')
    } else {
      setEmailError(null)
    }
  }

  function resetForm() {
    setFullName(''); setEmail(''); setCompany(''); setRole('')
    setCurrentTool(''); setTeamSize(''); setEmailError(null)
    setSubmitError(null); setBusy(false); setSuccess(false)
  }

  function handleClose() {
    onClose()
    setTimeout(resetForm, 400)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitError(null)

    if (!isBusinessEmail(email)) {
      setEmailError('Please use your work email — we don\'t accept Gmail, Yahoo, or similar.')
      return
    }

    setBusy(true)
    try {
      const res = await fetch('/api/demo-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, email, company, role, current_tool: currentTool, team_size: teamSize }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setSubmitError(data.error ?? 'Something went wrong. Please try again.')
        setBusy(false)
        return
      }
      setSuccess(true)
    } catch {
      setSubmitError('Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  const focusStyle = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = 'rgba(255,102,0,0.5)'
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,102,0,0.1)'
  }
  const blurStyle = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = 'rgba(245,243,238,0.12)'
    e.currentTarget.style.boxShadow = 'none'
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={handleClose}
            style={{
              position: 'fixed', inset: 0, zIndex: 9998,
              background: 'rgba(5,5,8,0.85)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
            aria-hidden
          />

          {/* Modal */}
          <motion.div
            key="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="demo-modal-title"
            initial={{ opacity: 0, y: 32, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={SPRING}
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '20px',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                width: '100%', maxWidth: 520,
                background: 'rgba(12,12,16,0.95)',
                border: '1px solid var(--glass-border-heavy)',
                borderRadius: '20px',
                boxShadow: '0 40px 120px rgba(0,0,0,0.7), 0 0 0 1px rgba(245,243,238,0.05), inset 0 1px 0 rgba(245,243,238,0.08)',
                padding: '40px',
                pointerEvents: 'auto',
                position: 'relative',
                maxHeight: '90vh',
                overflowY: 'auto',
              }}
            >
              {/* Close button */}
              <button
                onClick={handleClose}
                aria-label="Close"
                style={{
                  position: 'absolute', top: 20, right: 20,
                  background: 'rgba(245,243,238,0.06)',
                  border: '1px solid var(--glass-border-heavy)',
                  borderRadius: '8px', width: 32, height: 32,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'rgba(245,243,238,0.5)',
                  fontSize: '16px', lineHeight: 1,
                  transition: 'background 160ms ease, color 160ms ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--glass-border-heavy)'; e.currentTarget.style.color = '#F5F3EE' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(245,243,238,0.06)'; e.currentTarget.style.color = 'rgba(245,243,238,0.5)' }}
              >
                ×
              </button>

              {/* Ambient glow */}
              <div style={{
                position: 'absolute', top: -80, right: -80,
                width: 300, height: 300,
                background: 'radial-gradient(circle, rgba(255,102,0,0.12) 0%, transparent 70%)',
                borderRadius: '50%', pointerEvents: 'none',
              }} />

              <AnimatePresence mode="wait">
                {success ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={SPRING}
                    style={{ textAlign: 'center', padding: '16px 0' }}
                  >
                    <div style={{
                      width: 60, height: 60, borderRadius: '50%',
                      background: 'rgba(26,122,74,0.12)',
                      border: '1px solid rgba(26,122,74,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto 24px', fontSize: '24px',
                    }}>✓</div>
                    <h2 id="demo-modal-title" style={{
                      fontFamily: "'Instrument Serif', serif",
                      fontSize: '2rem', fontWeight: 400,
                      color: '#F5F3EE', lineHeight: 1.15,
                      margin: '0 0 16px', letterSpacing: '-.02em',
                    }}>
                      You're in.
                    </h2>
                    <p style={{ fontSize: '15px', color: 'rgba(245,243,238,0.6)', lineHeight: 1.7, margin: '0 0 32px' }}>
                      Check your inbox — we've sent you access to the dashboard along with next steps.<br />
                      <strong style={{ color: 'rgba(245,243,238,0.85)' }}>{email}</strong>
                    </p>
                    <a
                      href="/login"
                      style={{
                        display: 'inline-block',
                        background: '#F5F3EE', color: '#0A0A0F',
                        fontFamily: "'Syne', sans-serif",
                        fontWeight: 700, fontSize: '15px',
                        padding: '14px 32px', borderRadius: '8px',
                        textDecoration: 'none', letterSpacing: '.02em',
                        transition: 'transform 160ms ease',
                      }}
                    >
                      Sign in now →
                    </a>
                    <button
                      onClick={handleClose}
                      style={{
                        display: 'block', margin: '16px auto 0',
                        background: 'none', border: 'none',
                        color: 'rgba(245,243,238,0.35)', cursor: 'pointer',
                        fontSize: '13px',
                      }}
                    >
                      Close
                    </button>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    onSubmit={handleSubmit}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative' }}
                  >
                    {/* Header */}
                    <div style={{ marginBottom: '32px' }}>
                      <p style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: '10px', letterSpacing: '.15em',
                        textTransform: 'uppercase', color: '#FF6600',
                        margin: '0 0 12px',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}>
                        <span style={{ display: 'inline-block', width: 20, height: 1, background: '#FF6600' }} />
                        Request Access
                      </p>
                      <h2 id="demo-modal-title" style={{
                        fontFamily: "'Instrument Serif', serif",
                        fontSize: '2rem', fontWeight: 400,
                        color: '#F5F3EE', lineHeight: 1.15,
                        margin: '0 0 10px', letterSpacing: '-.02em',
                      }}>
                        See your sessions<br /><em style={{ color: 'rgba(245,243,238,0.45)' }}>the way we do.</em>
                      </h2>
                      <p style={{ fontSize: '14px', color: 'rgba(245,243,238,0.5)', lineHeight: 1.65, margin: 0 }}>
                        Free session audit for your last 30 days. No credit card. Takes 2 minutes to connect.
                      </p>
                    </div>

                    {/* Row 1: Name + Email */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                      <div>
                        <label htmlFor="dm-full-name" style={LABEL_STYLE}>Full name</label>
                        <input
                          id="dm-full-name"
                          ref={firstInputRef}
                          type="text" required autoComplete="name"
                          placeholder="Ada Lovelace"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          style={INPUT_STYLE}
                          onFocus={focusStyle} onBlur={blurStyle}
                        />
                      </div>
                      <div>
                        <label htmlFor="dm-company" style={LABEL_STYLE}>Company</label>
                        <input
                          id="dm-company"
                          type="text" required autoComplete="organization"
                          placeholder="Acme Corp"
                          value={company}
                          onChange={(e) => setCompany(e.target.value)}
                          style={INPUT_STYLE}
                          onFocus={focusStyle} onBlur={blurStyle}
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div style={{ marginBottom: '16px' }}>
                      <label htmlFor="dm-email" style={LABEL_STYLE}>Work email</label>
                      <input
                        id="dm-email"
                        type="email" required autoComplete="work email"
                        placeholder="you@yourcompany.com"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); if (emailError) validateEmail(e.target.value) }}
                        onBlur={(e) => { validateEmail(e.target.value); blurStyle(e) }}
                        onFocus={focusStyle}
                        style={{
                          ...INPUT_STYLE,
                          borderColor: emailError ? 'rgba(239,68,68,0.5)' : 'rgba(245,243,238,0.12)',
                        }}
                      />
                      {emailError && (
                        <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#f87171' }}>⚠ {emailError}</p>
                      )}
                    </div>

                    {/* Row 2: Role + Tool */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                      <div>
                        <label htmlFor="dm-role" style={LABEL_STYLE}>Your role</label>
                        <select
                          id="dm-role" required
                          value={role}
                          onChange={(e) => setRole(e.target.value)}
                          style={{ ...INPUT_STYLE, appearance: 'none', cursor: 'pointer' }}
                          onFocus={focusStyle} onBlur={blurStyle}
                        >
                          <option value="">Select role…</option>
                          <option>VP Customer Success</option>
                          <option>RevOps Lead</option>
                          <option>CEO / Founder</option>
                          <option>Head of CS</option>
                          <option>CSM Manager</option>
                          <option>Product Manager</option>
                          <option>Other</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="dm-tool" style={LABEL_STYLE}>Session tool you use</label>
                        <select
                          id="dm-tool" required
                          value={currentTool}
                          onChange={(e) => setCurrentTool(e.target.value)}
                          style={{ ...INPUT_STYLE, appearance: 'none', cursor: 'pointer' }}
                          onFocus={focusStyle} onBlur={blurStyle}
                        >
                          <option value="">Select tool…</option>
                          <option>FullStory</option>
                          <option>PostHog</option>
                          <option>Datadog RUM</option>
                          <option>LogRocket</option>
                          <option>Hotjar</option>
                          <option>Microsoft Clarity</option>
                          <option>Other</option>
                          <option>None yet</option>
                        </select>
                      </div>
                    </div>

                    {/* Team size */}
                    <div style={{ marginBottom: '28px' }}>
                      <label style={{ ...LABEL_STYLE, marginBottom: '10px' }}>Team size</label>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {['1–10','11–50','51–200','201–500','500+'].map((s) => (
                          <button
                            key={s} type="button"
                            onClick={() => setTeamSize(s)}
                            style={{
                              padding: '8px 16px',
                              borderRadius: '6px',
                              border: `1px solid ${teamSize === s ? 'rgba(255,102,0,0.5)' : 'var(--glass-border-heavy)'}`,
                              background: teamSize === s ? 'rgba(255,102,0,0.1)' : 'var(--glass-bg)',
                              color: teamSize === s ? '#FF6600' : 'rgba(245,243,238,0.5)',
                              fontFamily: "'DM Mono', monospace",
                              fontSize: '12px', cursor: 'pointer',
                              transition: 'all 160ms ease',
                            }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Error */}
                    {submitError && (
                      <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#f87171' }}>⚠ {submitError}</p>
                    )}

                    {/* Submit */}
                    <button
                      type="submit"
                      disabled={busy || !!emailError || !teamSize}
                      style={{
                        width: '100%',
                        padding: '15px 24px',
                        borderRadius: '10px',
                        border: 'none',
                        background: busy || !teamSize ? 'var(--glass-border-heavy)' : '#F5F3EE',
                        color: busy || !teamSize ? 'rgba(245,243,238,0.3)' : '#0A0A0F',
                        fontFamily: "'Syne', sans-serif",
                        fontWeight: 700, fontSize: '15px',
                        cursor: busy || !teamSize ? 'not-allowed' : 'pointer',
                        letterSpacing: '.02em',
                        transition: 'all 200ms ease',
                      }}
                    >
                      {busy ? 'Submitting…' : 'Request access — it\'s free →'}
                    </button>

                    <p style={{ textAlign: 'center', marginTop: '14px', fontSize: '12px', color: 'rgba(245,243,238,0.25)' }}>
                      No credit card. No sales call unless you want one.
                    </p>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
