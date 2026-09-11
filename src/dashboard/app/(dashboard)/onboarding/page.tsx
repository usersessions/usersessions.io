'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from "motion/react"
import { Slock } from '@lobehub/icons'
import { SiHtml5, SiNextdotjs, SiWordpress, SiShopify } from 'react-icons/si'
import { ShimmeringText } from '@/components/unlumen-ui/shimmering-text'

const phrases = [
  "Agent is thinking...",
  "Processing your request...",
  "Analyzing the data...",
  "Generating response...",
  "Almost there...",
];

function ShimmerAnimation() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % phrases.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      marginBottom: 28, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          <ShimmeringText 
            text={phrases[currentIndex]} 
            color="#94a3b8" 
            shimmerColor="#0f172a" 
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
// ── Types ─────────────────────────────────────────────────────
type Step = 1 | 2 | 3 | 4
type Framework = 'html' | 'nextjs' | 'wordpress' | 'shopify'

interface OnboardingStatus {
  clientId: string
  domain: string | null
  capturePublicKey: string | null
  activationStep: string
  scriptInstalled: boolean
  firstHeatmapViewed: boolean
  firstActionSeen: boolean
  onboardingCompleted: boolean
  connectedApps: string[]
  sessionSource: string | null
  auditStatus: 'pending' | 'running' | 'done' | 'error' | null
  latestFinding: { severity: string; summary: string } | null
}

// ── Snippet generators ────────────────────────────────────────
function getSnippet(publicKey: string, framework: Framework): string {
  const scriptTag = `<script\n  src="https://usersessions.io/capture.js"\n  data-client-key="${publicKey}"\n  async\n></script>`

  if (framework === 'html') return `<!-- Paste before </head> on every page -->\n${scriptTag}`
  if (framework === 'nextjs') {
    return `// app/layout.tsx — inside <head>\nimport Script from 'next/script'\n\n<Script\n  src="https://usersessions.io/capture.js"\n  data-client-key="${publicKey}"\n  strategy="afterInteractive"\n/>`
  }
  if (framework === 'wordpress') {
    return `// functions.php\nfunction usersessions_snippet() { ?>\n  ${scriptTag}\n<?php }\nadd_action('wp_head', 'usersessions_snippet');`
  }
  if (framework === 'shopify') return `{%- comment -%} theme.liquid — before </head> {%- endcomment -%}\n${scriptTag}`
  return scriptTag
}

// ── Constants ─────────────────────────────────────────────────
const SPRING = { type: 'spring', bounce: 0, duration: 0.4 } as const
const POLL_INTERVAL = 3000
const MAX_POLLS = 30

const FRAMEWORKS: { id: Framework; label: string; icon: React.ReactNode; guide: string }[] = [
  { id: 'html',      label: 'HTML',      icon: <SiHtml5 size={18} />, guide: 'Paste the snippet just before the closing </head> tag on every page.' },
  { id: 'nextjs',    label: 'Next.js',   icon: <SiNextdotjs size={18} />, guide: 'Paste the Script component inside your root app/layout.tsx.' },
  { id: 'wordpress', label: 'WordPress', icon: <SiWordpress size={18} />, guide: 'Paste this snippet at the bottom of your theme\'s functions.php file.' },
  { id: 'shopify',   label: 'Shopify',   icon: <SiShopify size={18} />, guide: 'Paste the snippet just before the closing </head> tag in theme.liquid.' },
]

// ── Component ─────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter()

  const [step, setStep]           = useState<Step>(1)
  const [status, setStatus]       = useState<OnboardingStatus | null>(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [domain, setDomain]       = useState('')
  const [framework, setFramework] = useState<Framework>('html')
  const [copied, setCopied]       = useState(false)
  const [completed, setCompleted] = useState(false)
  const [verificationTimeout, setVerificationTimeout] = useState(false)
  const [realSessionCount, setRealSessionCount]       = useState<number | null>(null)
  const [auditLoading, setAuditLoading]               = useState(false)
  const [auditFinding, setAuditFinding]               = useState<{ severity: string; summary: string } | null>(null)

  const pollRef        = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollCountRef   = useRef(0)
  const auditTriggered = useRef(false)
  const auditPollRef   = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Load initial status ──────────────────────────────────────
  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch('/api/onboarding/status')
        if (!res.ok) return
        const data: OnboardingStatus = await res.json()
        setStatus(data)
        if (data.onboardingCompleted || data.firstActionSeen) {
          router.push('/findings'); return
        }
        if (data.scriptInstalled) {
          setStep(4)
        } else if (data.domain) {
          setDomain(data.domain)
          setStep(3)
        } else {
          setStep(1)
        }
      } catch {}
    }
    fetchStatus()
  }, [router])

  // ── Poll for script verification (step 3) ───────────────────
  const startPolling = useCallback(() => {
    if (pollRef.current) return
    setVerificationTimeout(false)
    pollCountRef.current = 0
    pollRef.current = setInterval(async () => {
      pollCountRef.current += 1
      if (pollCountRef.current > MAX_POLLS) {
        clearInterval(pollRef.current!)
        pollRef.current = null
        setVerificationTimeout(true)
        return
      }
      try {
        const res = await fetch('/api/onboarding/verify-script')
        if (!res.ok) return
        const data = await res.json()
        if (data.verified) {
          clearInterval(pollRef.current!)
          pollRef.current = null
          setStatus(prev => prev ? { ...prev, scriptInstalled: true } : prev)
          fetch('/api/onboarding/complete', { method: 'POST' }).catch(() => {}) // Auto-complete
          setStep(4)
        }
      } catch {}
    }, POLL_INTERVAL)
  }, [])

  useEffect(() => {
    if (step === 2 || step === 3) startPolling()
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }
  }, [step, startPolling])

  // ── Trigger first-party audit + poll for result on step 4 ──
  useEffect(() => {
    if (step !== 4 || !status?.clientId || !status?.domain) return

    // If already done from a previous visit, surface it immediately
    if (status.auditStatus === 'done' && status.latestFinding) {
      setAuditFinding(status.latestFinding)
      return
    }

    // Kick off the audit exactly once per session.
    // The backend will use first-party capture.js data (sessions, heatmap
    // aggregates) — no third-party scraper needed.
    if (!auditTriggered.current && status.auditStatus == null) {
      auditTriggered.current = true
      setAuditLoading(true)
      fetch('/api/audit/initial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // websiteUrl is optional — used only as a cold-start fallback seed
        body: JSON.stringify({ clientId: status.clientId }),
      }).catch(() => {})
    } else if (status.auditStatus === 'running' || status.auditStatus === 'pending') {
      setAuditLoading(true)
      auditTriggered.current = true
    }

    // Poll status every 3s until audit is done
    if (auditPollRef.current) return
    let auditPollCount = 0
    auditPollRef.current = setInterval(async () => {
      auditPollCount++
      if (auditPollCount > 20) {
        clearInterval(auditPollRef.current!); auditPollRef.current = null
        setAuditLoading(false); return
      }
      try {
        const res = await fetch('/api/onboarding/status')
        if (!res.ok) return
        const data: OnboardingStatus = await res.json()
        setStatus(data)
        if (data.auditStatus === 'done') {
          setAuditLoading(false)
          setAuditFinding(data.latestFinding)
          clearInterval(auditPollRef.current!); auditPollRef.current = null
        } else if (data.auditStatus === 'error') {
          setAuditLoading(false)
          clearInterval(auditPollRef.current!); auditPollRef.current = null
        }
      } catch {}
    }, 3000)

    return () => {
      if (auditPollRef.current) { clearInterval(auditPollRef.current); auditPollRef.current = null }
    }
  }, [step, status?.clientId, status?.domain, status?.auditStatus, status?.latestFinding])

  // ── Fetch real session count on step 4 ──────────────────────
  useEffect(() => {
    if (step !== 4 || !status?.clientId) return
    // Track heatmap viewed
    fetch('/api/onboarding/track-step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 'heatmap_viewed' }),
    }).catch(() => {})

    // Poll for session count (data trickles in within seconds)
    let count = 0
    const t = setInterval(async () => {
      count++
      if (count > 8) { clearInterval(t); return }
      try {
        const r = await fetch('/api/onboarding/session-count')
        if (r.ok) {
          const d = await r.json()
          if ((d.count ?? 0) > 0) {
            setRealSessionCount(d.count)
            clearInterval(t)
          }
        }
      } catch {}
    }, 2000)
    return () => clearInterval(t)
  }, [step, status?.clientId])

  // ── Step 1: Submit domain ────────────────────────────────────
  async function handleDomainSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!domain.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/onboarding/set-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Failed to save domain')
        return
      }
      const statusRes = await fetch('/api/onboarding/status')
      if (statusRes.ok) setStatus(await statusRes.json())
      setStep(2)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: Copy snippet ─────────────────────────────────────
  async function copySnippet() {
    const key = status?.capturePublicKey ?? 'YOUR_KEY'
    await navigator.clipboard.writeText(getSnippet(key, framework))
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  // ── Step 4: Complete onboarding ──────────────────────────────
  async function completeOnboarding() {
    setLoading(true)
    try {
      await fetch('/api/onboarding/track-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'first_action_seen' }),
      })
      await fetch('/api/onboarding/complete', { method: 'POST' })
      setCompleted(true)
      setTimeout(() => router.push('/findings'), 1200)
    } catch {
      setError('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const publicKey     = status?.capturePublicKey ?? 'loading...'
  const snippet       = getSnippet(publicKey, framework)
  const displayDomain = status?.domain ?? domain

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'flex-start',
      justifyContent: 'center', padding: '48px 24px 80px',
      background: 'radial-gradient(circle at top, rgba(249,115,22,0.08) 0%, transparent 40%), radial-gradient(circle at bottom right, rgba(99,102,241,0.05) 0%, transparent 50%)',
    }}>

      {/* Completion overlay */}
      <AnimatePresence>
        {completed && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 50,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(16px)',
            }}
          >
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', bounce: 0.4, duration: 0.6 }}
              style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'rgba(34,197,94,0.12)', border: '2px solid rgba(34,197,94,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 32, marginBottom: 20,
              }}
            >
              ✓
            </motion.div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>You're live.</h2>
            <p style={{ color: '#64748b', fontSize: 14, marginTop: 8 }}>Taking you to your dashboard...</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ width: '100%', maxWidth: 580 }}>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 40 }}>
          {([1, 2, 3, 4] as Step[]).map((n, i) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center' }}>
              <motion.div
                animate={{
                  background: n < step ? '#22c55e' : n === step ? '#f97316' : '#e2e8f0',
                  color: n === step || n < step ? '#fff' : '#94a3b8',
                  scale: n === step ? 1.1 : 1,
                }}
                transition={{ duration: 0.3 }}
                style={{
                  width: 30, height: 30, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                }}
              >
                {n < step ? '✓' : n}
              </motion.div>
              {i < 3 && (
                <div style={{
                  width: 52, height: 2,
                  background: n < step ? '#22c55e' : '#e2e8f0',
                  transition: 'background 0.4s ease',
                }} />
              )}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: '12px 16px', background: 'rgba(239,68,68,0.08)', color: '#dc2626',
            border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, marginBottom: 20, fontSize: 13,
          }}>
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">

          {/* ── Step 1: Domain ── */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={SPRING}>
              <div style={{ marginBottom: 28, textAlign: 'center' }}>
                <div style={{
                  display: 'inline-flex', padding: '4px 12px', marginBottom: 14,
                  background: 'rgba(249,115,22,0.08)', color: '#f97316',
                  borderRadius: 99, fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>
                  No card required
                </div>
                <h1 style={{ fontSize: 28, fontWeight: 700, color: '#0f172a', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
                  Where does your site live?
                </h1>
                <p style={{ fontSize: 15, color: '#64748b', margin: 0 }}>
                  We'll generate your capture snippet against this domain.
                </p>
              </div>

              <StepCard>
                <form onSubmit={handleDomainSubmit}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Your site's domain
                  </label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 14, pointerEvents: 'none', userSelect: 'none' }}>
                        https://
                      </span>
                      <input
                        id="domain-input"
                        type="text"
                        value={domain}
                        onChange={e => setDomain(e.target.value)}
                        placeholder="example.com"
                        autoFocus
                        required
                        style={{
                          width: '100%', padding: '13px 14px 13px 82px',
                          background: '#f8fafc', border: '1.5px solid #e2e8f0',
                          borderRadius: 10, color: '#0f172a', fontSize: 15, outline: 'none',
                          boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.2s',
                        }}
                        onFocus={e => { e.target.style.borderColor = '#f97316' }}
                        onBlur={e => { e.target.style.borderColor = '#e2e8f0' }}
                      />
                    </div>
                    <button
                      type="submit" disabled={loading || !domain.trim()} className="btn-dash-primary"
                      style={{ padding: '13px 22px', fontSize: 14, whiteSpace: 'nowrap', opacity: !domain.trim() ? 0.5 : 1 }}
                    >
                      {loading ? 'Saving...' : 'Continue →'}
                    </button>
                  </div>
                </form>
                <p style={{ marginTop: 16, fontSize: 12, color: '#94a3b8', textAlign: 'center', lineHeight: 1.5 }}>
                  No credit card required · Cancel any time · Data stays yours
                </p>
              </StepCard>
            </motion.div>
          )}

          {/* ── Step 2: Install snippet ── */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={SPRING}>
              <div style={{ marginBottom: 28, textAlign: 'center' }}>
                <h1 style={{ fontSize: 28, fontWeight: 700, color: '#0f172a', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
                  Paste one snippet
                </h1>
                <p style={{ fontSize: 15, color: '#64748b', margin: 0 }}>
                  Add this to the <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontSize: 13 }}>&lt;head&gt;</code> of every page. We detect it automatically.
                </p>
              </div>

              <StepCard>
                {/* Framework selector */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 20, padding: '4px', background: '#f1f5f9', borderRadius: 10 }}>
                  {FRAMEWORKS.map(f => (
                    <button key={f.id} onClick={() => setFramework(f.id)} style={{
                      flex: 1, padding: '8px 4px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                      cursor: 'pointer', border: 'none', transition: 'all 0.2s ease', textAlign: 'center',
                      background: framework === f.id ? '#fff' : 'transparent',
                      color: framework === f.id ? '#0f172a' : '#94a3b8',
                      boxShadow: framework === f.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                      letterSpacing: '0.03em', textTransform: 'uppercase',
                    }}>
                      <span style={{ display: 'flex', justifyContent: 'center', marginBottom: 6, opacity: framework === f.id ? 1 : 0.6 }}>{f.icon}</span>
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Instruction Guide */}
                <p style={{ fontSize: 14, color: '#475569', marginBottom: 16, fontWeight: 500, lineHeight: 1.5 }}>
                  {FRAMEWORKS.find(f => f.id === framework)?.guide}
                </p>

                {/* Code block */}
                <div style={{ position: 'relative', background: '#0f172a', borderRadius: 10, overflow: 'hidden' }}>
                  <pre style={{
                    padding: '20px', margin: 0, overflowX: 'auto',
                    fontSize: 12.5, lineHeight: 1.7, color: '#e2e8f0',
                    fontFamily: 'DM Mono, Fira Code, monospace',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                  }}>
                    {snippet}
                  </pre>
                  <button onClick={copySnippet} style={{
                    position: 'absolute', top: 12, right: 12, padding: '5px 14px', borderRadius: 6,
                    background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.08)',
                    border: `1px solid ${copied ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.15)'}`,
                    color: copied ? '#4ade80' : '#94a3b8', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}>
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>

                {/* Next Step Action */}
                <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <button onClick={() => setStep(3)} className="btn-dash-primary" style={{ padding: '14px 28px', fontSize: 15, width: '100%' }}>
                    I've pasted the code →
                  </button>
                </div>

                <div style={{ marginTop: 24, transform: 'scale(0.9)', opacity: 0.8 }}>
                  <ShimmerAnimation />
                </div>

                <div style={{ marginTop: 4, display: 'flex', justifyContent: 'center' }}>
                  <button onClick={() => setStep(1)} style={{
                    padding: '10px 18px', fontSize: 13, background: 'transparent',
                    border: 'none', color: '#94a3b8', borderRadius: 8, cursor: 'pointer',
                  }}>
                    ← Back to domain
                  </button>
                </div>
              </StepCard>
            </motion.div>
          )}

          {/* ── Step 3: Listening ── */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={SPRING}>
              <div style={{ marginBottom: 28, textAlign: 'center' }}>
                <h1 style={{ fontSize: 28, fontWeight: 700, color: '#0f172a', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
                  Listening for traffic...
                </h1>
                <p style={{ fontSize: 15, color: '#64748b', margin: 0 }}>
                  We'll advance the moment we detect a pageview from{' '}
                  <strong style={{ color: '#0f172a' }}>{displayDomain}</strong>.
                </p>
              </div>

              <StepCard>
                <div style={{ textAlign: 'center', padding: '32px 0' }}>

                  {/* Shimmer animation */}
                  <ShimmerAnimation />

                  {displayDomain && (
                    <div style={{ marginBottom: 24 }}>
                      <a
                        href={`https://${displayDomain}`}
                        target="_blank" rel="noopener noreferrer"
                        className="btn-dash-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', fontSize: 14, textDecoration: 'none' }}
                      >
                        Open your site →
                      </a>
                    </div>
                  )}

                  {verificationTimeout ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      style={{
                        marginTop: 8, padding: '16px 20px', textAlign: 'left',
                        background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)',
                        borderRadius: 10,
                      }}
                    >
                      <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: '#dc2626' }}>
                        We couldn't detect the script yet.
                      </p>
                      <p style={{ margin: '0 0 14px', fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
                        Double-check that the snippet is in the <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4 }}>&lt;head&gt;</code> of <em>every</em> page, then visit your site in a browser.
                      </p>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={() => setStep(2)} style={{
                          padding: '8px 16px', fontSize: 13, background: 'transparent',
                          border: '1.5px solid #e2e8f0', color: '#64748b', borderRadius: 8, cursor: 'pointer',
                        }}>
                          ← Back to snippet
                        </button>
                        <button onClick={() => { setVerificationTimeout(false); startPolling() }} style={{
                          padding: '8px 16px', fontSize: 13, background: '#f1f5f9',
                          border: '1.5px solid #e2e8f0', color: '#0f172a', borderRadius: 8,
                          cursor: 'pointer', fontWeight: 600,
                        }}>
                          Try again
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <button onClick={() => setStep(2)} style={{
                      padding: '8px 16px', fontSize: 13, background: 'transparent',
                      border: '1.5px solid #e2e8f0', color: '#94a3b8', borderRadius: 8, cursor: 'pointer',
                    }}>
                      ← Back to snippet
                    </button>
                  )}
                </div>
              </StepCard>
            </motion.div>
          )}

          {/* ── Step 4: You're live ── */}
          {step === 4 && (
            <motion.div key="step4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={SPRING}>
              <div style={{ marginBottom: 28, textAlign: 'center' }}>
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', bounce: 0.5, duration: 0.6 }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '5px 14px', marginBottom: 14,
                    background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)',
                    borderRadius: 99, fontSize: 13, fontWeight: 600, color: '#16a34a',
                  }}
                >
                  <motion.span
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}
                  />
                  Script detected · Live
                </motion.div>
                <h1 style={{ fontSize: 28, fontWeight: 700, color: '#0f172a', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
                  {displayDomain
                    ? <>Sessions arriving on <span style={{ color: '#f97316' }}>{displayDomain}</span></>
                    : 'Sessions are arriving'}
                </h1>
                <p style={{ fontSize: 15, color: '#64748b', margin: 0 }}>
                  {realSessionCount !== null && realSessionCount > 0
                    ? `${realSessionCount} session${realSessionCount > 1 ? 's' : ''} captured. Heatmap data is ready.`
                    : 'Your first session is being processed. Data appears within seconds of any pageview.'}
                </p>
              </div>

              <div style={{
                background: 'rgba(255, 255, 255, 0.5)',
                backdropFilter: 'blur(24px) saturate(140%)',
                WebkitBackdropFilter: 'blur(24px) saturate(140%)',
                borderRadius: 24,
                border: '1px solid rgba(255, 255, 255, 0.8)',
                padding: '24px',
                boxShadow: '0 12px 40px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
              }}>
                {/* Heatmap link — honest, no fake dots */}
                <a href="/sessions" style={{ display: 'block', textDecoration: 'none', marginBottom: 24 }}>
                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                    style={{
                      background: '#fff', border: '1px solid rgba(0,0,0,0.06)',
                      borderRadius: 16, padding: '16px 20px',
                      display: 'flex', alignItems: 'center', gap: 16,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
                    }}
                  >
                    <div style={{
                      width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                      background: 'linear-gradient(135deg, rgba(249,115,22,0.1), rgba(249,115,22,0.05))', 
                      border: '1px solid rgba(249,115,22,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
                    }}>
                      🔥
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: 'var(--obsidian)' }}>
                        {realSessionCount !== null && realSessionCount > 0
                          ? `${realSessionCount} session${realSessionCount > 1 ? 's' : ''} recorded`
                          : 'Heatmap forming...'}
                      </p>
                      <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-soft)', fontWeight: 500 }}>
                        Open the live heatmap dashboard →
                      </p>
                    </div>
                  </motion.div>
                </a>

                {/* Slack section */}
                <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 24 }}>
                  <p style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, color: 'var(--ink-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>
                    The Autonomous Layer
                  </p>

                  {/* First-party audit result — or loading state */}
                  {auditLoading && !auditFinding ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={{
                        background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 16,
                        padding: '16px 20px', marginBottom: 20,
                        boxShadow: '0 2px 12px rgba(0,0,0,0.02)',
                        display: 'flex', gap: 16, alignItems: 'center',
                      }}
                    >
                      <div style={{
                        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                        background: 'rgba(232,90,43,0.06)', border: '1px solid rgba(232,90,43,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <motion.div
                          animate={{ scale: [0.8, 1.1, 0.8], opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                          style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--ember)' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: 'var(--obsidian)' }}>
                           Analyzing real sessions...
                        </p>
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.4 }}>
                          Reading rage-click signals and friction patterns from your users.
                        </p>
                      </div>
                    </motion.div>
                  ) : auditFinding ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 16,
                        padding: '16px 20px', marginBottom: 20,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
                        display: 'flex', gap: 16, alignItems: 'flex-start',
                      }}
                    >
                      <div style={{
                        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                        background: '#4A154B', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
                      }}>
                        <Slock size={20} color="#fff" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--obsidian)' }}>UserSessions</span>
                          <span style={{ fontSize: 11, color: 'var(--ember)', fontWeight: 600, padding: '2px 6px', background: 'var(--ember-glow)', borderRadius: 4 }}>{auditFinding.severity}</span>
                          <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>just now</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 14, color: 'var(--ink)', lineHeight: 1.5 }}>
                          {auditFinding.summary.replace('[First-Party Audit] ', '').replace('[Initial Audit] ', '')}
                        </p>
                      </div>
                    </motion.div>
                  ) : (
                    /* Empty state: audit hasn't kicked off yet or no sessions collected */
                    <div style={{
                      background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 16,
                      padding: '16px 20px', marginBottom: 20,
                      boxShadow: '0 2px 12px rgba(0,0,0,0.02)',
                      display: 'flex', gap: 16, alignItems: 'flex-start',
                    }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                        background: 'rgba(0,0,0,0.03)',
                        border: '1px solid rgba(0,0,0,0.06)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                      }}>
                        📡
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: 'var(--obsidian)' }}>
                          Waiting for first session
                        </p>
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                          {realSessionCount !== null && realSessionCount > 0
                            ? `${realSessionCount} session${realSessionCount > 1 ? 's' : ''} captured — friction analysis will appear shortly.`
                            : 'Visit your site to send the first beacon. Automated friction reports will appear here.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {status?.connectedApps?.includes('slack') ? (
                    <div style={{ padding: '12px 16px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, marginBottom: 16 }}>
                      <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>✓ Slack connected — alerts are live</span>
                    </div>
                  ) : (
                    <motion.a 
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      href="/connect?highlight=slack" 
                      className="btn btn--ember btn-spring"
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '14px', fontSize: 14, textDecoration: 'none', marginBottom: 16, borderRadius: 12 }}
                    >
                      <Slock size={18} />
                      Connect Slack to get alerts like this
                    </motion.a>
                  )}

                  <motion.button
                    whileHover={{ scale: 1.01, backgroundColor: '#f8fafc' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={completeOnboarding} disabled={loading}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      width: '100%', padding: '14px',
                      background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,0,0,0.1)',
                      borderRadius: 12, fontSize: 14, color: 'var(--obsidian)', fontWeight: 600,
                      cursor: 'pointer', transition: 'border-color 0.2s',
                    }}
                  >
                    {loading ? 'Entering dashboard...' : 'Go to Dashboard →'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────
function StepCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.35)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderRadius: 16,
      border: '1px solid rgba(255, 255, 255, 0.6)',
      padding: '28px 28px',
      boxShadow: '0 8px 32px rgba(15, 23, 42, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
    }}>
      {children}
    </div>
  )
}
