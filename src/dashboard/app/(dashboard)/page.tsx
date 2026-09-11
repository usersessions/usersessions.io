import { createClient } from '@/lib/supabase/server'
import { QueueClient } from '@/components/QueueClient'
import { redirect } from 'next/navigation'
import { getFeatureAccess } from '@/hooks/useFeatureAccess'
import { SiteAnalyticsPanel } from '@/components/analytics/SiteAnalyticsPanel'
import { RealtimeVisitorPanel } from '@/components/RealtimeVisitorPanel'
import { LiveMap } from '@/components/LiveMap'

export const dynamic = 'force-dynamic'

export default async function DashboardQueuePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  let isAtLeastPro = false
  let isAtLeastStarter = false
  let stats = { sessions: 0, rageClicks: 0 }
  let clientId: string | null = null
  let chartData: { date: string; sessions: number; friction: number }[] = []

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

    if (clientId) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
      
      // us_sessions has no created_at column; ingested_at is the arrival timestamp.
      const [monthlyRes, chartRes] = await Promise.all([
        supabase.from('us_sessions').select('rage_click_count').eq('client_id', clientId).gte('ingested_at', startOfMonth),
        supabase.from('us_sessions').select('ingested_at, rage_click_count, error_count').eq('client_id', clientId).gte('ingested_at', thirtyDaysAgo)
      ])
      
      if (monthlyRes.data) {
        stats.sessions = monthlyRes.data.length
        stats.rageClicks = monthlyRes.data.reduce((sum, s) => sum + (s.rage_click_count || 0), 0)
      }

      if (chartRes.data) {
        const daily: Record<string, { sessions: number, friction: number }> = {}
        for (let i = 29; i >= 0; i--) {
          const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
          daily[d.toISOString().split('T')[0]] = { sessions: 0, friction: 0 }
        }
        for (const s of chartRes.data) {
          const day = String(s.ingested_at).split('T')[0]
          if (daily[day]) {
            daily[day].sessions += 1
            if ((s.rage_click_count && s.rage_click_count > 0) || (s.error_count && s.error_count > 0)) {
              daily[day].friction += 1
            }
          }
        }
        chartData = Object.keys(daily).sort().map(date => ({
          date,
          sessions: daily[date].sessions,
          friction: daily[date].friction,
        }))
      }
    }
  }

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', width: '100%', paddingBottom: 120, display: 'flex', flexDirection: 'column', gap: 32 }}>
      <SiteAnalyticsPanel clientId={clientId} isAtLeastStarter={isAtLeastStarter} stats={stats} chartData={chartData} />

      {/* Globe + Live Visitors — side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
        <LiveMap clientId={clientId} />
        <RealtimeVisitorPanel clientId={clientId} />
      </div>

      {/* AI Actions queue */}
      <QueueClient isAtLeastPro={isAtLeastPro} isAtLeastStarter={isAtLeastStarter} />
    </div>
  )
}
