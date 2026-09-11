import React from 'react'
import PolicyRules from '@/components/settings/PolicyRules'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getFeatureAccess } from '@/hooks/useFeatureAccess'
import { PiLockKeyBold } from 'react-icons/pi'
import Link from 'next/link'

export const metadata = {
  title: 'Policies | UserSessions',
}

export default async function PoliciesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle()
  const access = getFeatureAccess(profile?.plan)

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', width: '100%', paddingBottom: 120 }}>
      <header style={{ marginBottom: 32 }}>
        <p className="ds-section-label" style={{ marginBottom: 10 }}>Rules</p>
        <h1 className="ds-page-title">Policies</h1>
        <p className="ds-page-sub">Set thresholds for what gets flagged, what gets patched, and what requires your sign-off.</p>
      </header>
      {!access.canCustomWorkflows ? (
        <div className="ds-empty" style={{ border: '1px dashed var(--glass-border-heavy)', gap: 20, marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <PiLockKeyBold size={24} color="#ef4444" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <p className="ds-empty-title" style={{ marginBottom: 6 }}>Custom workflows are on Business</p>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6, maxWidth: 400 }}>
              Custom remediation workflows and policies are available on the Business plan and above. Upgrade to automatically trigger cross-platform actions.
            </p>
            <Link href="/billing" className="ds-btn-approve" style={{ display: 'inline-block', marginTop: 20, padding: '10px 20px', fontSize: 13, textDecoration: 'none' }}>
              Upgrade to Business
            </Link>
          </div>
        </div>
      ) : (
        <PolicyRules />
      )}
    </div>
  )
}
