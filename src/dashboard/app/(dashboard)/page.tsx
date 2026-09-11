import { createClient } from '@/lib/supabase/server'
import { QueueClient } from '@/components/QueueClient'
import { redirect } from 'next/navigation'
import { getFeatureAccess } from '@/hooks/useFeatureAccess'
import { SiteAnalyticsPanel } from '@/components/analytics/SiteAnalyticsPanel'
import { TopPagesPanel } from '@/components/analytics/TopPagesPanel'

export const dynamic = 'force-dynamic'

export default async function DashboardQueuePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let isAtLeastPro = false
  let isAtLeastStarter = false
  let clientId: string | null = null

  if (user) {
    const [
      { data: client },
      { data: profile }
    ] = await Promise.all([
      supabase.from('us_clients').select('id, onboarding_completed_at').eq('profile_id', user.id).maybeSingle(),
      supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle()
    ])

    if (!client || !client.onboarding_completed_at) {
      redirect('/onboarding')
    }
    clientId = client.id

    if (profile?.plan) {
      const access = getFeatureAccess(profile.plan)
      isAtLeastPro = access.isAtLeastPro
      isAtLeastStarter = access.isAtLeastStarter
    }
  }

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', width: '100%', paddingBottom: 120, display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Analytics with period filter — fetches its own data client-side */}
      <SiteAnalyticsPanel
        clientId={clientId}
        isAtLeastStarter={isAtLeastStarter}
        stats={{ sessions: 0, rageClicks: 0 }}
        chartData={[]}
      />

      {/* Top Pages */}
      <TopPagesPanel clientId={clientId} />

      {/* AI Actions queue */}
      <QueueClient isAtLeastPro={isAtLeastPro} isAtLeastStarter={isAtLeastStarter} />
    </div>
  )
}
