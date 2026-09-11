import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PiPulseBold, PiLockKeyBold, PiLightningBold } from 'react-icons/pi'
import { getFeatureAccess } from '@/hooks/useFeatureAccess'
import Link from 'next/link'
import { DashboardPageHeader } from '@/components/DashboardPageHeader'
import { PatchList } from './PatchList'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Live Patches | UserSessions',
}

export default async function LivePatchesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).single()
  const access = getFeatureAccess(profile?.plan)

  const { data: client } = await supabase
    .from('us_clients')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()

  const { data: patches } = client?.id ? await supabase
    .from('us_ui_patches')
    .select('id, patch_type, target_selector, status, canary_percentage, created_at, canary_started_at, promoted_to_live_at, rolled_back_at, patch_payload')
    .eq('client_id', client.id)
    .not('status', 'in', '("disabled")')
    .order('created_at', { ascending: false })
    .limit(50)
  : { data: [] }

  const activeCount = (patches ?? []).filter((p: any) => ['shadow', 'canary', 'live'].includes(p.status)).length

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', width: '100%', paddingBottom: 120 }}>
      <DashboardPageHeader
        icon={<PiPulseBold size={20} />}
        title="Live Patches"
        rightContent={
          access.livePatching !== 'none' ? (
            <span style={{
              background: access.livePatching === 'canary' ? 'rgba(252,163,17,0.1)' : 'rgba(16,185,129,0.1)',
              color: access.livePatching === 'canary' ? 'var(--orange)' : 'var(--green)',
              padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
              textTransform: 'uppercase' as const, letterSpacing: '0.04em',
              border: `1px solid ${access.livePatching === 'canary' ? 'rgba(252,163,17,0.2)' : 'rgba(16,185,129,0.2)'}`
            }}>
              {access.livePatching} Access
            </span>
          ) : undefined
        }
      />

      {access.livePatching === 'none' ? (
        <div className="ds-empty" style={{ border: '1px dashed var(--glass-border-heavy)', gap: 20 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <PiLockKeyBold size={24} color="#ef4444" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <p className="ds-empty-title" style={{ marginBottom: 6 }}>Live Patching is on Business</p>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6, maxWidth: 400 }}>
              Patches run in shadow mode first — zero risk. Business and above.
            </p>
            <Link href="/billing" className="ds-btn-approve" style={{ display: 'inline-block', marginTop: 20, padding: '10px 20px', fontSize: 13, textDecoration: 'none' }}>
              Upgrade to Business
            </Link>
          </div>
        </div>
      ) : (patches ?? []).length === 0 ? (
        <div className="ds-empty" style={{ border: '1px dashed var(--glass-border-heavy)', gap: 20 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <PiPulseBold size={24} color="var(--blue)" />
          </div>
          <div>
            <p className="ds-empty-title" style={{ marginBottom: 6 }}>No patches running</p>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
              Approved fixes land here in shadow mode first. Nothing ships without your say.
            </p>
          </div>
        </div>
      ) : (
        <PatchList patches={patches ?? []} clientId={client?.id ?? ''} />
      )}
    </div>
  )
}
