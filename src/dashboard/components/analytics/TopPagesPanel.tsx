'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PiGlobeSimpleBold, PiLinkBold } from 'react-icons/pi'

interface TopPagesPanelProps {
  clientId: string | null
}

export function TopPagesPanel({ clientId }: TopPagesPanelProps) {
  const [pages, setPages] = useState<{ url: string; count: number; path: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clientId) return
    const fetchTopPages = async () => {
      setLoading(true)
      const supabase = createClient()
      const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString() // last 30 days

      // Fetch sessions for this client
      const { data: sessions, error: sessionsErr } = await supabase
        .from('us_sessions')
        .select('id, page_url')
        .eq('client_id', clientId)
        .gte('ingested_at', cutoff)

      if (sessionsErr || !sessions || sessions.length === 0) {
        setLoading(false)
        return
      }

      const counts: Record<string, number> = {}

      // Some might have page_url (if migrations ran), otherwise we fetch from events
      const sessionsWithUrl = sessions.filter(s => s.page_url)
      const sessionsWithoutUrl = sessions.filter(s => !s.page_url).map(s => s.id)

      sessionsWithUrl.forEach(s => {
        if (s.page_url) {
          counts[s.page_url] = (counts[s.page_url] || 0) + 1
        }
      })

      if (sessionsWithoutUrl.length > 0) {
        // Fetch events in batches if necessary, but for now just one query
        const { data: events } = await supabase
          .from('us_events')
          .select('payload')
          .eq('type', 'page_view')
          .in('session_id', sessionsWithoutUrl.slice(0, 1000)) // limit to prevent URL too long

        if (events) {
          events.forEach(e => {
            const url = e.payload?.url
            if (url) {
              counts[url] = (counts[url] || 0) + 1
            }
          })
        }
      }

      // Format and sort
      const sortedPages = Object.keys(counts)
        .map(url => {
          let path = url
          try {
            const urlObj = new URL(url)
            path = urlObj.pathname === '/' ? urlObj.hostname : urlObj.pathname
          } catch (e) {
            // ignore invalid urls
          }
          return { url, path, count: counts[url] }
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      setPages(sortedPages)
      setLoading(false)
    }

    fetchTopPages()
  }, [clientId])

  if (!clientId) return null

  return (
    <div style={{ padding: '20px 24px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <PiGlobeSimpleBold size={14} color="var(--text-secondary)" />
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Top Visited Pages (30 Days)
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
        {pages.length === 0 && !loading && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
            No traffic data available yet.
          </div>
        )}
        
        {pages.map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, background: 'var(--bg-primary, rgba(0,0,0,0.02))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)', flexShrink: 0
              }}>
                <PiLinkBold size={14} color="var(--text-secondary)" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.path}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.url}
                </span>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {p.count}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>views</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
