'use client'

/**
 * AuthPage — warm editorial split-screen auth.
 *
 * @design-principles
 *  - @emil-design-eng: inputs respond on focus with spring-like CSS transitions,
 *    CTA scales on press via onPointerDown, staggered mount for value props.
 *  - @apple-design: backdrop glass for the form card, critically-damped transitions.
 *  - @color: deep dark (--ink) and off-white (--bg-primary), matching the new premium aesthetic.
 *  - Typography: Syne, Instrument Serif, and DM Mono.
 */

import { CheckCircle2, ChevronRight, Mail, ArrowRight } from 'lucide-react'
import { Google, Github } from '@lobehub/icons'
import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from "motion/react"
import { createClient } from '@/lib/supabase/client'

const SPRING = { type: 'spring', bounce: 0, duration: 0.35 } as const

const VALUE_PROPS = [
  {
    label: '01 — Connect',
    copy: 'Connect the session tool you already run. FullStory, PostHog, Datadog — no new SDK, no migration.',
  },
  {
    label: '02 — Analyze',
    copy: 'Every session gets evaluated by AI heuristics. Friction, rage clicks, and abandonment — all surfaced automatically.',
  },
  {
    label: '03 — Act',
    copy: 'Fixes fire across your stack automatically. Jira tickets. Slack alerts. Salesforce tasks. Before it becomes churn.',
  },
]

// Consumer/disposable domains no longer blocked.
export function AuthPage({ initialMode }: { initialMode: 'signin' | 'signup' }) {
  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const [pressing, setPressing] = useState(false)
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get('error')
    if (err === 'auth') setError('Sign-in failed — request a fresh link and try again.')
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function sendMagicLink(e?: React.FormEvent) {
    e?.preventDefault()
    if (!email) return

    setBusy(true)
    setError(null)
    
    try {
      // 1. Request magic link
      const supabase = createClient()
      
      // Validate redirect path to prevent open redirects
      const params = new URLSearchParams(window.location.search)
      const redirectParam = params.get('redirect')
      const isValidRedirect = redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')
      const redirectUrl = new URL(`${window.location.origin}/auth/callback`)
      if (isValidRedirect) {
        redirectUrl.searchParams.set('next', redirectParam)
      }
      
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl.toString(),
        },
      })

      if (authError) {
        setError(authError.message)
      } else {
        setSent(true)
        setCooldown(30)
      }
    } catch (err) {
      console.error(err)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function signInWithProvider(provider: 'google' | 'github') {
    setBusy(true)
    setError(null)
    const supabase = createClient()
    
    const params = new URLSearchParams(window.location.search)
    const redirectParam = params.get('redirect')
    const isValidRedirect = redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')
    const redirectUrl = new URL(`${window.location.origin}/auth/callback`)
    if (isValidRedirect) {
      redirectUrl.searchParams.set('next', redirectParam)
    }

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUrl.toString(),
      }
    })

    if (authError) setError(authError.message)
    setBusy(false)
  }

  return (
    <main
      className="min-h-screen grid lg:grid-cols-2"
      style={{ background: 'var(--bg-primary)', color: 'var(--ink)' }}
    >
      {/* ── Left: Brand panel ── */}
      <section
        className="hidden lg:flex flex-col justify-between"
        style={{
          background: 'var(--bg-primary)',
          color: 'var(--ink)',
          padding: '48px 56px',
          position: 'relative',
          overflow: 'hidden',
          borderRight: '1px solid var(--line)',
        }}
      >
        {/* Ambient orange glow */}
        <div style={{
          position: 'absolute',
          top: -160, right: -100,
          width: 480, height: 480,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(232,90,43,0.28) 0%, transparent 65%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute',
          bottom: -120, left: '20%',
          width: 320, height: 320,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(253,198,138,0.15) 0%, transparent 65%)',
          filter: 'blur(30px)',
          pointerEvents: 'none',
        }} />

        {/* Wordmark */}
        <motion.span
          initial={shouldReduceMotion ? {} : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING}
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: '1.25rem',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: 'var(--ink)',
            position: 'relative', zIndex: 1,
          }}
        >
          usersessions.io
        </motion.span>

        {/* Value props */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 40, maxWidth: 400, position: 'relative', zIndex: 1 }}>
          <motion.h1
            initial={shouldReduceMotion ? {} : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.08 }}
            style={{
              fontFamily: "var(--display)",
              fontSize: '2.4rem',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1.05,
              color: 'var(--ink)',
            }}
          >
            The AI Session Analysis Dashboard that{' '}
            <span style={{
              background: 'linear-gradient(135deg, var(--ember), #ff8c40)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              watches, learns, and fixes.
            </span>
          </motion.h1>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {VALUE_PROPS.map((v, i) => (
              <motion.div
                key={v.label}
                initial={shouldReduceMotion ? {} : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...SPRING, delay: 0.14 + i * 0.06 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 5 }}
              >
                <p style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--ember)',
                }}>
                  {v.label}
                </p>
                <p style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: '15px',
                  fontWeight: 500,
                  color: 'var(--ink-soft)',
                  lineHeight: 1.5,
                  letterSpacing: '0',
                }}>
                  {v.copy}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Footer note */}
        <p style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--ink-muted)', textTransform: 'uppercase', position: 'relative', zIndex: 1 }}>
          The Autonomous Remediation Layer · UserSessions.io
        </p>
      </section>

      {/* ── Right: Auth panel ── */}
      <section
        className="flex items-center justify-center"
        style={{ padding: '32px 24px', background: 'var(--bg-primary)' }}
      >
        <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* Mobile wordmark */}
          <span
            className="lg:hidden"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: '1.25rem',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: 'var(--ink)',
              textAlign: 'center',
              display: 'block',
            }}
          >
            usersessions.io
          </span>

          {/* Auth card */}
          <motion.div
            className="glass-panel"
            initial={shouldReduceMotion ? {} : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.06 }}
            style={{
              borderRadius: 20,
              padding: '40px 32px',
              display: 'flex',
              flexDirection: 'column',
              gap: 28,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Radial glow top left */}
            <div style={{
              position: 'absolute', top: -100, left: -100,
              width: 250, height: 250,
              background: 'radial-gradient(circle, rgba(255,102,0,0.1), transparent 60%)',
              pointerEvents: 'none',
            }} />

            {/* Heading */}
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h2 style={{
                fontFamily: "var(--display)",
                fontSize: '1.5rem',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: 'var(--ink)',
                lineHeight: 1.1,
                marginBottom: 8,
              }}>
                {mode === 'signup' ? 'Create your account' : 'Welcome back'}
              </h2>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: '14px', color: 'var(--ink-soft)', lineHeight: 1.55, fontWeight: 500 }}>
                {mode === 'signup' ? 'Start your free trial.' : 'Sign in to your account.'}
              </p>
            </div>

            {/* Form or confirmation */}
            {sent ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{
                  padding: '16px',
                  borderRadius: 12,
                  background: 'var(--ember-glow)',
                  border: '1px solid rgba(232,90,43,0.15)',
                }}>
                  <p style={{ fontSize: '13px', color: 'var(--ink)', lineHeight: 1.55 }}>
                    Check your inbox — your sign-in link is on its way to{' '}
                    <strong style={{ color: 'var(--ink)', fontFamily: "'DM Mono', monospace" }}>{email}</strong>.
                  </p>
                </div>
                <button
                  style={{
                    padding: '11px 16px',
                    borderRadius: 10,
                    border: '1.5px solid var(--line)',
                    background: 'var(--prussian-blue)',
                    color: 'var(--text-secondary)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: busy || cooldown > 0 ? 'not-allowed' : 'pointer',
                    opacity: busy || cooldown > 0 ? 0.6 : 1,
                    transition: 'background 160ms ease',
                  }}
                  disabled={busy || cooldown > 0}
                  onClick={() => sendMagicLink()}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : busy ? 'Sending…' : 'Resend link'}
                </button>
                <button
                  onClick={() => setSent(false)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--ink-muted)', fontSize: '12px', letterSpacing: '0.02em',
                    fontWeight: 600,
                  }}
                >
                  Use a different email
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => signInWithProvider('google')}
                  style={{
                    padding: '11px 20px',
                    borderRadius: 12,
                    border: '1px solid var(--line)',
                    background: 'white',
                    color: 'var(--ink)',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: busy ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    transition: 'background 200ms ease',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                  }}
                >
                  <Google size={18} />
                  Continue with Google
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => signInWithProvider('github')}
                  style={{
                    padding: '11px 20px',
                    borderRadius: 12,
                    border: '1px solid var(--line)',
                    background: 'white',
                    color: 'var(--ink)',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: busy ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    transition: 'background 200ms ease',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                  }}
                >
                  <Github size={18} />
                  Continue with GitHub
                </button>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                  <span style={{ fontSize: 12, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>or</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                </div>
                
                <form onSubmit={sendMagicLink} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>
                      Email address
                    </span>
                    <input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      padding: '11px 14px',
                      borderRadius: 10,
                      border: '1.5px solid var(--line)',
                      background: 'white',
                      fontSize: '14px',
                      color: 'var(--ink)',
                      outline: 'none',
                      transition: 'border-color 200ms ease, box-shadow 200ms ease',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--ember)'
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(229,90,0,0.1)'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--line)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  />
                </label>

                <motion.button
                  type="submit"
                  disabled={busy}
                  onPointerDown={() => setPressing(true)}
                  onPointerUp={() => setPressing(false)}
                  onPointerLeave={() => setPressing(false)}
                  animate={shouldReduceMotion ? {} : { scale: pressing ? 0.97 : 1 }}
                  transition={SPRING}
                  className="btn btn--ember btn-spring"
                  style={{
                    width: '100%',
                    padding: '13px 20px',
                    borderRadius: 12,
                    fontSize: '14px',
                  }}
                >
                  {busy ? 'Sending…' : 'Email me a sign-in link'}
                </motion.button>
                </form>
              </div>
            )}

            {error && (
              <p role="alert" style={{ fontFamily: "var(--font-sans)", fontSize: '13px', color: '#ff6600', letterSpacing: '0', lineHeight: 1.4, fontWeight: 500 }}>
                ⚠ {error}
              </p>
            )}
          </motion.div>
          
          <p style={{ textAlign: 'center', fontFamily: "var(--font-sans)", fontSize: '13px', color: 'var(--ink-soft)', letterSpacing: '0', fontWeight: 500 }}>
            {mode === 'signup' ? (
              <>Already have an account? <button type="button" onClick={() => setMode('signin')} style={{ color: 'var(--ember)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Sign in</button></>
            ) : (
              <>Don't have an account? <button type="button" onClick={() => setMode('signup')} style={{ color: 'var(--ember)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Sign up for free</button></>
            )}
          </p>

        </div>
      </section>
    </main>
  )
}
