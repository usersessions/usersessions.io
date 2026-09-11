'use client'

import { useState } from 'react'
import { PiArrowUpBold } from 'react-icons/pi'
import type { PlanId } from '@/lib/tiers'

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

interface UpgradeButtonProps {
  planId: PlanId
}

export function UpgradeButton({ planId }: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleUpgrade = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: planId }),
      })
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error ?? 'Checkout request failed')
      }

      if (data.checkoutMode === 'contact_sales') {
        window.location.href = data.contactUrl
        return
      }

      await loadPaystackScript()
      if (!window.PaystackPop) throw new Error('Paystack SDK did not load')

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
          window.location.href = '/settings?billing=success'
        },
        onCancel: () => {
          setLoading(false)
        },
      })
      handler.openIframe()
    } catch (err: any) {
      alert(err.message ?? 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleUpgrade}
      disabled={loading}
      className="ds-btn-approve"
      style={{
        textDecoration: 'none', padding: '9px 18px', fontSize: '13px',
        display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
        background: 'var(--green)', borderColor: 'var(--green)', color: '#fff',
        cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
      }}
    >
      <PiArrowUpBold size={13} />
      {loading ? 'Loading...' : 'Upgrade'}
    </button>
  )
}
