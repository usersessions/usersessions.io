'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence, useReducedMotion } from "motion/react"
import { PiPlugBold, PiLinkBold, PiCheckCircleBold, PiSpinnerBold, PiMagnifyingGlassBold, PiArrowClockwiseBold, PiCaretDownBold, PiCaretUpBold, PiRadioBold, PiLockKeyBold } from 'react-icons/pi'
import { createClient } from '@/lib/supabase/client'
import type { SessionSource } from '@/types/usersessions'

const SPRING = { type: 'spring', bounce: 0, duration: 0.38 } as const

// ─── Legacy session sources (migration-only, not a going-forward feature) ───
const LEGACY_SOURCES: { id: SessionSource; label: string; note: string }[] = [
  { id: 'datadog_rum',  label: 'Datadog RUM',  note: 'API key + Application key' },
  { id: 'posthog',      label: 'PostHog',       note: 'Personal API key + Project ID' },
  { id: 'fullstory',    label: 'FullStory',     note: 'API key + Org ID' },
  { id: 'logrocket',   label: 'LogRocket',     note: 'API key' },
  { id: 'hotjar',      label: 'Hotjar',        note: 'API key' },
]

function formatToolkit(name: string) {
  if (!name) return 'System'
  const map: Record<string, string> = {
    SLACK: 'Slack', JIRA: 'Jira', LINEAR: 'Linear',
    SALESFORCE: 'Salesforce', HUBSPOT: 'HubSpot', GITHUB: 'GitHub',
    NOTION: 'Notion', CALENDAR: 'Calendar',
  }
  return map[name.toUpperCase()] ?? (name.charAt(0).toUpperCase() + name.slice(1).toLowerCase())
}

type CatalogApp = {
  id: string
  name: string
  description: string
  logo: string | null
  categories: string[]
  connected: boolean
}

export default function ConnectPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const shouldReduceMotion = useReducedMotion()

  // ── Destination tool state ─────────────────────────────────
  const [catalogApps, setCatalogApps] = useState<CatalogApp[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [connectingApp, setConnectingApp] = useState<string | null>(null)

  // ── Legacy session source state (demoted) ──────────────────
  const [legacyExpanded, setLegacyExpanded] = useState(false)
  const [source, setSource] = useState<SessionSource>('datadog_rum')
  const [apiKey, setApiKey] = useState('')
  const [appKey, setAppKey] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [sourceLoading, setSourceLoading] = useState(false)
  const [currentSessionSource, setCurrentSessionSource] = useState<SessionSource | null>(null)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)

  // ── Plan state ─────────────────────────────────────────────
  const [plan, setPlan] = useState<string>('free')

  // ── Toast state ────────────────────────────────────────────
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  // ── Load initial status and catalog ───────────────────────
  useEffect(() => {
    async function loadStatus() {
      try {
        const res = await fetch('/api/integrations/composio/status')
        if (res.ok) {
          const data = await res.json()
          if (data.sessionSource) {
            setCurrentSessionSource(data.sessionSource)
            setSource(data.sessionSource)
            if (data.websiteUrl) setWebsiteUrl(data.websiteUrl)
            if (data.lastSyncAt) setLastSyncAt(data.lastSyncAt)
          }
        }
      } catch {
        // Network error — server may still be starting, fail silently
      }
    }

    async function loadCatalog(q = '') {
      setCatalogLoading(true)
      try {
        const res = await fetch(`/api/integrations/composio/catalog?q=${encodeURIComponent(q)}&limit=24`)
        if (res.ok) {
          const data = await res.json()
          setCatalogApps(data.apps || [])
        }
      } catch {
        // Network error — will show empty catalog gracefully
      } finally {
        setCatalogLoading(false)
      }
    }

    loadStatus()
    loadCatalog()

    // Load plan
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      supabase.from('profiles').select('plan').eq('id', data.user.id).maybeSingle().then(({ data: p }) => {
        if (p?.plan) setPlan(p.plan)
      })
    })

    if (searchParams?.get('composio_success')) {
      showToast(`Successfully connected ${formatToolkit(searchParams.get('composio_success') || '')}`, 'success')
    } else if (searchParams?.get('composio_error')) {
      showToast(`Failed to connect: ${searchParams.get('composio_error')}`, 'error')
    }
  }, [searchParams])

  // ── Debounced catalog search ───────────────────────────────
  useEffect(() => {
    const t = setTimeout(async () => {
      setCatalogLoading(true)
      try {
        const res = await fetch(`/api/integrations/composio/catalog?q=${encodeURIComponent(searchQuery)}&limit=24`)
        if (res.ok) {
          const data = await res.json()
          setCatalogApps(data.apps || [])
        }
      } catch {
        // Network error — keep existing catalog visible
      } finally {
        setCatalogLoading(false)
      }
    }, 350)
    return () => clearTimeout(t)
  }, [searchQuery])

  // ── Connect a Composio destination app ────────────────────
  async function handleConnectComposio(appId: string) {
    setConnectingApp(appId)
    try {
      const res = await fetch('/api/integrations/composio/initiate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ app: appId })
      })
      const data = await res.json()
      if (res.ok && data.redirectUrl) {
        window.location.href = data.redirectUrl
      } else {
        showToast(data.error ?? 'Failed to initiate connection', 'error')
        setConnectingApp(null)
      }
    } catch (err: any) {
      showToast(err.message, 'error')
      setConnectingApp(null)
    }
  }

  // ── Connect a legacy session source ───────────────────────
  async function handleConnectSource(e: React.FormEvent) {
    e.preventDefault()
    setSourceLoading(true)
    try {
      const res = await fetch('/api/sources/connect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ source, api_key: apiKey, app_key: appKey || undefined, website_url: websiteUrl }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error ?? 'Connection failed', 'error')
        return
      }
      showToast(`${formatToolkit(source)} connected successfully`, 'success')
      setCurrentSessionSource(source)
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally {
      setSourceLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 48, maxWidth: 1040, margin: '0 auto', width: '100%' }}>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={SPRING}
            style={{
              position: 'fixed', top: 24, right: 24,
              padding: '12px 20px', borderRadius: 8,
              background: toast.type === 'success' ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
              backdropFilter: 'blur(12px)',
              color: toast.type === 'success' ? '#059669' : '#dc2626',
              border: `1px solid ${toast.type === 'success' ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
              fontWeight: 600, fontSize: '13px', zIndex: 1000,
              boxShadow: '0 8px 32px rgba(20,32,43,0.1)',
            }}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={SPRING} style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--glass-bg-hover)', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <PiPlugBold size={18} color="var(--orange)" />
        </div>
        <h1 className="ds-page-title" style={{ margin: 0 }}>Integrations</h1>
      </motion.div>

      {/* ── Featured: CRM Enrichment (Business+) ──────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING, delay: 0.06 }}
      >
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Featured Integration</span>
        </div>
        <div className="ds-stat-card" style={{ padding: '20px 24px', display: 'flex', alignItems: 'flex-start', gap: 20 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Salesforce CRM Enrichment</span>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 8px', borderRadius: 20, background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)' }}>Business+</span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 540 }}>
              When a session triggers a high-severity finding, automatically update the linked Salesforce contact with friction signals, health scores, and churn risk — no manual sync required.
            </p>
          </div>
          <div style={{ flexShrink: 0 }}>
            {(plan === 'business' || plan === 'enterprise') ? (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => handleConnectComposio('salesforce')}
                disabled={connectingApp === 'salesforce'}
                className="ds-btn-approve"
                style={{ fontSize: 13, padding: '9px 20px', display: 'flex', alignItems: 'center', gap: 6, opacity: connectingApp === 'salesforce' ? 0.6 : 1 }}
              >
                {connectingApp === 'salesforce' ? <><PiSpinnerBold size={13} className="animate-spin" />Connecting…</> : 'Connect Salesforce'}
              </motion.button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.65 }}>
                <PiLockKeyBold size={14} color="var(--text-muted)" />
                <a href="/billing" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textDecoration: 'underline', textUnderlineOffset: 2 }}>Upgrade to Business</a>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Section 1: Action Destinations (Primary) ─────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING, delay: 0.08 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(252,163,17,0.08)', border: '1px solid rgba(252,163,17,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <PiLinkBold size={16} color="var(--orange)" />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Action Destinations</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Connect any of our 500+ apps — Slack, Linear, Jira, GitHub, HubSpot and more.
              </div>
            </div>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', width: 240 }}>
            <PiMagnifyingGlassBold size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              className="ds-input"
              placeholder="Search integrations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 36, width: '100%', boxSizing: 'border-box', height: 38, fontSize: 13 }}
            />
          </div>
        </div>

        {/* App grid */}
        {catalogLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <PiSpinnerBold size={24} className="animate-spin" color="var(--text-muted)" />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {/* Connected Apps Section */}
            {catalogApps.some(app => app.connected) && (
              <div>
                <div style={{ marginBottom: 16, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Connected Destinations</div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 16,
                }}>
                  {catalogApps.filter(app => app.connected).map(app => (
                    <div key={app.id} className="ds-stat-card" style={{
                      padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16,
                      borderRadius: 16, border: '1px solid var(--border)', background: 'var(--surface)',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.06)'
                    }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                        background: 'var(--bg-canvas)', border: '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, fontWeight: 800, color: 'var(--text-secondary)',
                        overflow: 'hidden',
                      }}>
                        {(() => {
                          const localLogos = ['composio', 'datadog', 'fullstory', 'googleanalytics', 'hotjar', 'hubspot', 'jira', 'linear', 'logrocket', 'pagerduty', 'posthog', 'salesforce', 'slack'];
                          const useLocal = localLogos.includes(app.id.toLowerCase());
                          const logoSrc = useLocal ? `/logos/${app.id.toLowerCase()}.svg` : app.logo;
                          return logoSrc 
                            ? <img src={logoSrc} alt={app.name} width={28} height={28} style={{ objectFit: 'contain' }} />
                            : app.name.charAt(0).toUpperCase()
                        })()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {app.name}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {app.description}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, background: 'rgba(52,211,153,0.1)', padding: '4px 10px', borderRadius: 20, border: '1px solid rgba(52,211,153,0.2)' }}>
                        <PiCheckCircleBold size={14} color="var(--green)" />
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Connected</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Available Apps Section */}
            <div>
              {catalogApps.some(app => app.connected) && (
                <div style={{ marginBottom: 16, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Available to Connect</div>
              )}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 16,
              }}>
                {catalogApps.filter(app => !app.connected).map(app => (
                  <motion.div key={app.id} whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.1)' }} className="ds-stat-card" style={{
                    padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16,
                    borderRadius: 16, border: '1px solid var(--border)', background: 'var(--surface)',
                    cursor: 'pointer',
                  }} onClick={() => !connectingApp && handleConnectComposio(app.id)}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                      background: 'var(--bg-canvas)', border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, fontWeight: 800, color: 'var(--text-secondary)',
                      overflow: 'hidden',
                    }}>
                      {(() => {
                        const localLogos = ['composio', 'datadog', 'fullstory', 'googleanalytics', 'hotjar', 'hubspot', 'jira', 'linear', 'logrocket', 'pagerduty', 'posthog', 'salesforce', 'slack'];
                        const useLocal = localLogos.includes(app.id.toLowerCase());
                        const logoSrc = useLocal ? `/logos/${app.id.toLowerCase()}.svg` : app.logo;
                        return logoSrc 
                          ? <img src={logoSrc} alt={app.name} width={28} height={28} style={{ objectFit: 'contain' }} />
                          : app.name.charAt(0).toUpperCase()
                      })()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {app.name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {app.description}
                      </div>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => { e.stopPropagation(); handleConnectComposio(app.id); }}
                      disabled={connectingApp === app.id}
                      className="ds-btn-dismiss"
                      style={{
                        flexShrink: 0, fontSize: 12, padding: '8px 16px', borderRadius: 8,
                        opacity: connectingApp === app.id ? 0.6 : 1,
                        cursor: connectingApp === app.id ? 'wait' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600,
                      }}
                    >
                      {connectingApp === app.id
                        ? <><PiSpinnerBold size={12} className="animate-spin" />…</>
                        : 'Connect'}
                    </motion.button>
                  </motion.div>
                ))}
                {catalogApps.filter(app => !app.connected).length === 0 && !catalogLoading && (
                  <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, background: 'var(--glass-bg)', borderRadius: 16, border: '1px dashed var(--glass-border-heavy)' }}>
                    No available integrations found for &ldquo;{searchQuery}&rdquo;
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Section 2: Legacy Data Sources (De-emphasised) ─────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING, delay: 0.18 }}
      >
        {/* Divider with label */}
        <button
          onClick={() => setLegacyExpanded(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%',
            background: 'none', border: 'none', cursor: 'pointer', padding: '12px 0',
            borderTop: '1px solid var(--border)',
          }}
        >
          <PiPlugBold size={14} color="var(--text-muted)" />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Data Sources
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, flex: 1, textAlign: 'left' }}>
            — connect a 3rd-party source for inbound analytics events
          </span>
          {legacyExpanded ? <PiCaretUpBold size={14} color="var(--text-muted)" /> : <PiCaretDownBold size={14} color="var(--text-muted)" />}
        </button>

        <AnimatePresence>
          {legacyExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={SPRING}
              style={{ overflow: 'hidden' }}
            >
              <div className="ds-stat-card" style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 0 }}>
                {/* Status bar if already connected */}
                {currentSessionSource && (
                  <div style={{
                    padding: '12px 20px', background: 'rgba(52,211,153,0.05)',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <PiCheckCircleBold size={14} color="var(--green)" />
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {formatToolkit(currentSessionSource)} connected
                      </span>
                      {lastSyncAt && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          Last sync: {new Date(lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setCurrentSessionSource(null)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}
                    >
                      Change →
                    </button>
                  </div>
                )}

                {(!currentSessionSource) && (
                  <form onSubmit={handleConnectSource} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Source picker */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {LEGACY_SOURCES.map(src => (
                        <label key={src.id} style={{
                          display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
                          color: source === src.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          padding: '6px 12px', borderRadius: 8,
                          background: source === src.id ? 'var(--bg-canvas)' : 'transparent',
                          border: `1px solid ${source === src.id ? 'var(--border)' : 'transparent'}`,
                          transition: 'all 120ms',
                        }}>
                          <input
                            type="radio" name="source" value={src.id}
                            checked={source === src.id}
                            onChange={(e) => setSource(e.target.value as SessionSource)}
                            style={{ accentColor: 'var(--orange)' }}
                          />
                          <div>
                            <div style={{ fontWeight: source === src.id ? 700 : 400 }}>{src.label}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{src.note}</div>
                          </div>
                        </label>
                      ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label className="ds-label">WEBSITE URL</label>
                        <input
                          type="url"
                          value={websiteUrl}
                          onChange={(e) => setWebsiteUrl(e.target.value)}
                          placeholder="https://example.com"
                          required
                          className="ds-input"
                          style={{ width: '100%', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label className="ds-label">API KEY</label>
                        <input
                          type="password"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder="API Key / Token"
                          required
                          className="ds-input"
                          style={{ width: '100%', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label className="ds-label">
                          {source === 'datadog_rum' ? 'APPLICATION KEY' : 'PROJECT / ORG ID'}
                        </label>
                        <input
                          type="password"
                          value={appKey}
                          onChange={(e) => setAppKey(e.target.value)}
                          placeholder={source === 'datadog_rum' ? 'Application Key' : 'Project / Org ID'}
                          required={source !== 'datadog_rum' && source !== 'logrocket' && source !== 'hotjar'}
                          className="ds-input"
                          style={{ width: '100%', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>

                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      type="submit"
                      disabled={sourceLoading || !apiKey}
                      className="ds-btn-approve"
                      style={{
                        opacity: sourceLoading || !apiKey ? 0.5 : 1,
                        padding: '10px 24px', fontSize: '13px',
                        cursor: sourceLoading || !apiKey ? 'not-allowed' : 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
                      }}
                    >
                      {sourceLoading ? <><PiSpinnerBold size={14} className="animate-spin" />Validating…</> : 'Connect Source'}
                    </motion.button>
                  </form>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
