import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PiArrowLeftBold, PiCursorClickBold, PiCornersOutBold, PiWarningBold, PiRobotBold } from 'react-icons/pi'
import { getReplaySignedUrl } from '@/lib/r2'
import { ReplayPlayer } from './ReplayPlayer'

export const metadata = {
  title: 'Session Viewer | UserSessions',
}

export default async function HeatmapViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: session } = await supabase
    .from('us_sessions')
    .select(`
      id, source, source_session_id, rage_click_count, scroll_depth_pct, started_at, ingested_at, replay_url,
      us_findings ( id, category, severity, summary, status )
    `)
    .eq('id', id)
    .maybeSingle()

  if (!session) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <PiWarningBold size={32} style={{ margin: '0 auto 16px', color: 'var(--text-muted)' }} />
        <h2>Session not found</h2>
        <Link href="/sessions" style={{ color: 'var(--blue)' }}>Back to Heatmaps & Sessions</Link>
      </div>
    )
  }

  // Determine R2 URL if we had a real rrweb player
  let signedUrl = null
  if (session.replay_url) {
    const key = session.replay_url.startsWith('r2://') 
      ? session.replay_url.replace('r2://', '') 
      : `${session.id}.json`
    try {
      signedUrl = await getReplaySignedUrl(key)
    } catch(e) {
      // In dev, bucket might not exist
    }
  }

  const findings = session.us_findings || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 40px)', margin: '-20px -20px 0', background: '#000' }}>
      {/* Top Bar */}
      <header style={{ 
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
        padding: '12px 24px', background: '#111', borderBottom: '1px solid #333' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/sessions" style={{ color: '#888', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>
            <PiArrowLeftBold size={16} /> Back
          </Link>
          <div style={{ width: 1, height: 24, background: '#333' }} />
          <div>
            <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
              {session.source ?? session.source_session_id ?? 'Session'}
            </div>
            <div style={{ color: '#888', fontSize: 12 }}>
              {new Date(session.started_at ?? session.ingested_at).toLocaleString()}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {session.rage_click_count > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444', fontSize: 13, fontWeight: 600, background: 'rgba(239,68,68,0.1)', padding: '4px 10px', borderRadius: 6 }}>
              <PiCursorClickBold size={14} /> {session.rage_click_count} rage clicks
            </div>
          )}
          <button style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
            <PiCornersOutBold size={16} /> Fullscreen
          </button>
        </div>
      </header>

      {/* Main Layout: Player (left) + AI Findings (right) */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        
        {/* Main Viewer Area */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {/* Mockup Browser Window for rrweb player */}
          <div style={{ 
            width: '85%', height: '85%', background: '#fff', borderRadius: 8, overflow: 'hidden',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ background: '#f1f5f9', padding: '8px 16px', display: 'flex', gap: 8, borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#10b981' }} />
            </div>
            <div style={{ flex: 1, background: '#f8fafc', position: 'relative', minHeight: 0 }}>
              <ReplayPlayer src={signedUrl} />
            </div>
          </div>
        </div>

        {/* AI Findings Sidebar */}
        {findings.length > 0 && (
          <div style={{ width: 320, background: '#1a1a1a', borderLeft: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', gap: 10 }}>
              <PiRobotBold size={18} color="var(--blue)" />
              <h3 style={{ margin: 0, color: '#fff', fontSize: 14, fontWeight: 600 }}>AI Findings</h3>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {findings.map((finding) => (
                <div key={finding.id} style={{ 
                  background: '#222', borderRadius: 8, padding: 16, border: '1px solid #333',
                  display: 'flex', flexDirection: 'column', gap: 8
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ 
                      fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
                      color: finding.severity === 'P0' || finding.severity === 'P1' ? '#ef4444' : '#f59e0b'
                    }}>
                      {finding.severity} • {finding.category}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: '#e2e8f0', lineHeight: 1.5 }}>{finding.summary}</p>
                  
                  {finding.status !== 'dismissed' && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                      <Link href="/findings" style={{
                        flex: 1, textAlign: 'center', padding: '6px 0', background: 'var(--blue)', color: '#fff',
                        fontSize: 12, fontWeight: 600, borderRadius: 6, textDecoration: 'none'
                      }}>View Details</Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
