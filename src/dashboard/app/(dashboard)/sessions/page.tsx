import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PiFlameBold, PiCodeBold, PiGlobeBold, PiTrendUpBold, PiCursorClickBold } from 'react-icons/pi'
import Link from 'next/link'
import { DashboardPageHeader } from '@/components/DashboardPageHeader'

import { HeatmapClientView } from './HeatmapClientView'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Heatmaps | UserSessions',
}

export default async function HeatmapsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: client } = await supabase
    .from('us_clients')
    .select('id, client_domain, capture_public_key, script_installed_at')
    .eq('profile_id', user.id)
    .maybeSingle()

  const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).single()
  const { isAtLeastStarter } = await import('@/hooks/useFeatureAccess').then(m => m.getFeatureAccess(profile?.plan))


  // Fetch initial heatmap aggregates
  const { data: aggregates } = client?.id ? await supabase
    .from('us_heatmap_aggregates')
    .select('*')
    .eq('client_id', client.id)
    .order('created_at', { ascending: false })
    .limit(20)
  : { data: [] }

  // Fetch heatmap sessions grouped by URL (for replay player)
  // us_sessions has no created_at column; ingested_at is the arrival timestamp.
  const { data: sessions } = client?.id ? await supabase
    .from('us_sessions')
    .select(`
      id, source, source_session_id, rage_click_count, error_count, ingested_at, started_at,
      us_findings ( id )
    `)
    .eq('client_id', client.id)
    .order('ingested_at', { ascending: false })
    .limit(50)
  : { data: [] }

  const formattedSessions = (sessions || []).map((s: any) => ({
    id: s.id,
    source: s.source,
    source_session_id: s.source_session_id,
    rage_click_count: s.rage_click_count,
    error_count: s.error_count,
    created_at: s.started_at ?? s.ingested_at,
    has_findings: Array.isArray(s.us_findings) && s.us_findings.length > 0,
  }))

  const hasData = (aggregates?.length ?? 0) > 0 || (sessions?.length ?? 0) > 0
  const snippetSrc = `<script async src="https://usersessions.io/capture.js" data-client-key="${client?.capture_public_key ?? 'YOUR_CLIENT_KEY'}"></script>`

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', width: '100%', paddingBottom: 120 }}>
      <DashboardPageHeader icon={<PiFlameBold size={20} />} title="Sessions & Heatmaps" />

      {!isAtLeastStarter ? (
        <div className="ds-empty" style={{ border: '1px dashed var(--glass-border-heavy)', gap: 20 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'rgba(252,163,17,0.08)', border: '1px solid rgba(252,163,17,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <PiFlameBold size={24} color="var(--orange)" strokeWidth={1.5} />
          </div>
          <div>
            <p className="ds-empty-title" style={{ marginBottom: 6 }}>Upgrade to Starter</p>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
              Heatmaps and session replay require the Starter plan or higher.
            </p>
          </div>
          <Link href="/billing" style={{
            marginTop: 4, padding: '10px 20px', borderRadius: 10,
            background: 'var(--orange)', color: '#fff',
            fontSize: '13px', fontWeight: 700, textDecoration: 'none',
          }}>
            View Plans →
          </Link>
        </div>
      ) : !hasData ? (
        client?.script_installed_at ? (
          <div className="ds-empty" style={{ border: '1px dashed var(--glass-border-heavy)', gap: 16 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: 'rgba(252,163,17,0.08)', border: '1px solid rgba(252,163,17,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <PiFlameBold size={24} color="var(--orange)" strokeWidth={1.5} />
            </div>
            <div>
              <p className="ds-empty-title" style={{ marginBottom: 6 }}>Your first session is recording</p>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
                Your script is installed! We're actively listening for your first pageview.<br/>
                Once a user visits your site, their heatmap data will appear here.
              </p>
            </div>
          </div>
        ) : (
          <div className="ds-empty" style={{ border: '1px dashed var(--glass-border-heavy)', gap: 20 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: 'rgba(252,163,17,0.08)', border: '1px solid rgba(252,163,17,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <PiFlameBold size={24} color="var(--orange)" strokeWidth={1.5} />
            </div>
            <div>
              <p className="ds-empty-title" style={{ marginBottom: 6 }}>No heatmap data yet</p>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
                Embed the <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>First-Party Capture Script</strong> on your site to start capturing heatmaps.
              </p>
            </div>
            <div style={{
              marginTop: 8, padding: '14px 18px',
              background: 'var(--bg-canvas)', border: '1px solid var(--border)',
              borderRadius: 10, textAlign: 'left',
              fontFamily: 'var(--font-mono)', fontSize: '12px',
              color: 'var(--text-secondary)', lineHeight: 1.8,
              display: 'flex', alignItems: 'flex-start', gap: 10,
              width: '100%', maxWidth: 640, boxSizing: 'border-box',
            }}>
              <PiCodeBold size={14} style={{ marginTop: 2, flexShrink: 0, color: 'var(--text-muted)' }} />
              <span style={{ wordBreak: 'break-all' }}>{snippetSrc}</span>
            </div>
            <Link href="/onboarding" style={{
              marginTop: 4, padding: '10px 20px', borderRadius: 10,
              background: 'var(--orange)', color: '#fff',
              fontSize: '13px', fontWeight: 700, textDecoration: 'none',
            }}>
              Go to Onboarding →
            </Link>
          </div>
        )
      ) : (
        <HeatmapClientView 
          initialAggregates={aggregates || []} 
          initialSessions={formattedSessions} 
          clientId={client!.id}
        />
      )}
    </div>
  )
}
