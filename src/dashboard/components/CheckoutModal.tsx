'use client'

import { useState, useEffect, useCallback } from 'react'
import type { CalculatorTierId } from '@/lib/documents/types'

interface CheckoutModalProps {
  isOpen: boolean
  onClose: () => void
  tier: CalculatorTierId
  sessions: number
  issues: number
  automation: number
  estimatedCost: number
}

type Step = 'capture' | 'paying' | 'success' | 'error'

declare global {
  interface Window {
    PaystackPop?: {
      setup: (config: Record<string, unknown>) => { openIframe: () => void }
    }
  }
}

function loadPaystackScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) return resolve()
    const existing = document.getElementById('paystack-inline-js')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', reject)
      return
    }
    const script = document.createElement('script')
    script.id = 'paystack-inline-js'
    script.src = 'https://js.paystack.co/v1/inline.js'
    script.onload = () => resolve()
    script.onerror = reject
    document.head.appendChild(script)
  })
}

const TIER_COPY: Record<CalculatorTierId, { label: string; priceLabel: string | ((cost: number) => string); subtext: string; btnLabel: string; footerText: string }> = {
  starter: {
    label: 'Starter',
    priceLabel: (cost: number) => `$${cost.toLocaleString()}/mo`,
    subtext: 'Base platform fee + action overage billed monthly via Paystack.',
    btnLabel: 'Continue to payment →',
    footerText: 'Secured by Paystack. Cancel any time.',
  },
  pro: {
    label: 'Pro',
    priceLabel: (cost: number) => `$${cost.toLocaleString()}/mo`,
    subtext: 'Base platform fee + action overage billed monthly via Paystack.',
    btnLabel: 'Continue to payment →',
    footerText: 'Secured by Paystack. Cancel any time.',
  },
  business: {
    label: 'Business',
    priceLabel: (cost: number) => `$${cost.toLocaleString()}/mo`,
    subtext: 'Base platform fee + action overage billed monthly via Paystack.',
    btnLabel: 'Continue to payment →',
    footerText: 'Secured by Paystack. Cancel any time.',
  },
  enterprise_license: {
    label: 'Enterprise License',
    priceLabel: (_cost: number) => '$30,000 / year',
    subtext: 'Annual license. Pay by card now, or request an invoice — whichever you prefer.',
    btnLabel: 'Continue to payment →',
    footerText: 'Card or invoice accepted. No sales call required.',
  },
  enterprise_managed: {
    label: 'Enterprise Managed',
    priceLabel: (_cost: number) => 'Custom pricing',
    subtext: "We'll scope a custom deal around your exact configuration.",
    btnLabel: 'Talk to us about this configuration →',
    footerText: 'No card required. We will prepare a custom quote.',
  },
}

export function CheckoutModal({
  isOpen,
  onClose,
  tier,
  sessions,
  issues,
  automation,
  estimatedCost,
}: CheckoutModalProps) {
  const [step, setStep] = useState<Step>('capture')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [wantsInvoice, setWantsInvoice] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const copy = TIER_COPY[tier]
  const isSelfServeCard = tier === 'starter' || tier === 'pro' || tier === 'business' || (tier === 'enterprise_license' && !wantsInvoice)
  const isSalesAssisted = tier === 'enterprise_managed'

  useEffect(() => {
    if (isOpen) { setStep('capture'); setErrorMsg(''); setLoading(false) }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  const handleContinue = useCallback(async () => {
    if (!email.includes('@') || !company.trim()) {
      setErrorMsg('Please enter a valid work email and company name.')
      return
    }
    setErrorMsg('')
    setLoading(true)

    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, email, companyName: company, sessions, issues, automation }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Checkout request failed')

      // Sales-assisted or invoice-requested: redirect to contact/booking
      if (data.checkoutMode === 'contact_sales' || (tier === 'enterprise_license' && wantsInvoice)) {
        window.open(data.contactUrl ?? '/contact?subject=Enterprise+License+invoice', '_blank', 'noopener,noreferrer')
        onClose()
        return
      }

      // Self-serve: open Paystack Pop inline
      await loadPaystackScript()
      if (!window.PaystackPop) throw new Error('Paystack SDK did not load')
      setStep('paying')

      const handler = window.PaystackPop.setup({
        key: data.paystackPublicKey,
        email: data.email,
        amount: data.amount,
        plan: data.paystackPlanCode,
        ref: data.reference,
        metadata: data.metadata ?? {},
        onSuccess: async (transaction: { reference: string }) => {
          try {
            await fetch('/api/billing/checkout/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reference: transaction.reference }),
            })
          } catch { /* webhook is source of truth */ }
          setStep('success')
        },
        onCancel: () => { setStep('capture') },
      })
      handler.openIframe()
    } catch (err: any) {
      setErrorMsg(err.message ?? 'Something went wrong. Please try again.')
      setStep('capture')
    } finally {
      setLoading(false)
    }
  }, [email, company, tier, sessions, issues, automation, wantsInvoice, onClose])

  if (!isOpen) return null

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 9000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
    background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
  }
  const card: React.CSSProperties = {
    width: '100%', maxWidth: 480,
    background: 'rgba(18, 18, 18, 0.96)', border: '1px solid var(--glass-border)',
    borderRadius: 20, padding: '40px 36px', position: 'relative',
    boxShadow: '0 32px 96px rgba(0,0,0,0.6)', backdropFilter: 'blur(16px)',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(245,243,238,0.5)', marginBottom: 8,
    fontFamily: "'DM Mono', monospace",
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 16px', background: 'var(--bg-canvas)',
    border: '1px solid var(--glass-border-heavy)', borderRadius: 10, color: '#f5f3ee',
    fontSize: 15, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
  }
  const btnStyle: React.CSSProperties = {
    width: '100%', padding: '14px 24px', background: 'var(--orange, #e55a00)', color: '#fff',
    border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
    cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
    letterSpacing: '-0.01em', transition: 'opacity 0.15s', fontFamily: 'inherit',
  }

  return (
    <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={card}>
        <button
          style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: 'rgba(245,243,238,0.4)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4, borderRadius: 6 }}
          onClick={onClose} aria-label="Close"
        >✕</button>

        {/* Capture step */}
        {step === 'capture' && (
          <>
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--orange, #e55a00)', marginBottom: 8 }}>
                {copy.label}
              </div>
              <h2 style={{ fontSize: 26, fontWeight: 700, color: '#f5f3ee', margin: 0, letterSpacing: '-0.02em', fontFamily: "'Instrument Serif', serif", fontStyle: 'italic' }}>
                {typeof copy.priceLabel === 'function' ? copy.priceLabel(estimatedCost) : copy.priceLabel}
              </h2>
              <p style={{ fontSize: 14, color: 'rgba(245,243,238,0.5)', marginTop: 6, marginBottom: 0 }}>
                {copy.subtext}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 24 }}>
              <div>
                <label style={labelStyle}>Work email</label>
                <input style={inputStyle} type="email" placeholder="you@company.com" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleContinue() }} autoFocus />
              </div>
              <div>
                <label style={labelStyle}>Company name</label>
                <input style={inputStyle} type="text" placeholder="Acme Inc." value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleContinue() }} />
              </div>

              {/* Invoice toggle for Enterprise License */}
              {tier === 'enterprise_license' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: 'rgba(245,243,238,0.6)' }}>
                  <input type="checkbox" checked={wantsInvoice} onChange={e => setWantsInvoice(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: 'var(--orange)' }} />
                  Prefer to pay by invoice instead
                </label>
              )}
            </div>

            {errorMsg && <p style={{ fontSize: 13, color: '#f87171', marginBottom: 16, marginTop: -8 }}>{errorMsg}</p>}

            <button style={btnStyle} onClick={handleContinue} disabled={loading}>
              {loading ? 'Loading…' : copy.btnLabel}
            </button>
            <p style={{ fontSize: 12, color: 'rgba(245,243,238,0.3)', textAlign: 'center', marginTop: 16, marginBottom: 0 }}>
              {copy.footerText}
            </p>
          </>
        )}

        {/* Paying step */}
        {step === 'paying' && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>💳</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f5f3ee', marginBottom: 8 }}>Complete payment</h2>
            <p style={{ fontSize: 14, color: 'rgba(245,243,238,0.5)' }}>The Paystack popup is open. Complete your payment there.</p>
          </div>
        )}

        {/* Success step */}
        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontSize: 26, fontWeight: 700, color: '#f5f3ee', marginBottom: 8, fontFamily: "'Instrument Serif', serif", fontStyle: 'italic' }}>
              {tier === 'starter' ? "You're on Starter" : tier === 'pro' ? "You're on Pro" : tier === 'business' ? "You're on Business" : "You're all set"}
            </h2>
            <p style={{ fontSize: 14, color: 'rgba(245,243,238,0.6)', marginBottom: 28, lineHeight: 1.6 }}>
              Your account is being provisioned — you&apos;ll receive a confirmation email shortly. Check your dashboard for access.
            </p>
            <button style={{ ...btnStyle, background: 'var(--glass-border)', border: '1px solid var(--glass-border-heavy)' }}
              onClick={() => { window.location.href = '/settings?billing=success' }}>
              Go to dashboard →
            </button>
          </div>
        )}

        {/* Error step */}
        {step === 'error' && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f5f3ee', marginBottom: 8 }}>Something went wrong</h2>
            <p style={{ fontSize: 14, color: 'rgba(245,243,238,0.5)', marginBottom: 24 }}>{errorMsg}</p>
            <button style={btnStyle} onClick={() => setStep('capture')}>Try again</button>
          </div>
        )}
      </div>
    </div>
  )
}
