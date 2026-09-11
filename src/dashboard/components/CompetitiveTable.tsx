'use client'

import React from 'react'

const features = [
  {
    name: 'Open source / self-hostable',
    us: { value: 'Yes', isAvailable: true },
    hotjar: { value: 'No', isAvailable: false },
    contentsquare: { value: 'No', isAvailable: false },
    posthog: { value: 'Yes', isAvailable: true },
    openreplay: { value: 'Yes', isAvailable: true },
  },
  {
    name: 'MCP server (AI agent access)',
    us: { value: 'Yes — read + write', isAvailable: true },
    hotjar: { value: 'No', isAvailable: false },
    contentsquare: { value: 'Yes — query only, no write/action', isAvailable: true },
    posthog: { value: 'Yes — official MCP server', isAvailable: true },
    openreplay: { value: 'Yes — official MCP server', isAvailable: true },
  },
  {
    name: 'Executes actions automatically',
    us: { value: 'Yes', isAvailable: true },
    hotjar: { value: 'No', isAvailable: false },
    contentsquare: { value: 'No — insight/query only', isAvailable: false },
    posthog: { value: 'Limited — rules-based webhooks, not AI-driven', isAvailable: false },
    openreplay: { value: 'No — basic one-way integrations only', isAvailable: false },
  },
  {
    name: 'AI-powered friction classification',
    us: { value: 'Yes', isAvailable: true },
    hotjar: { value: 'Limited — AI survey analysis only', isAvailable: false },
    contentsquare: { value: 'Yes', isAvailable: true },
    posthog: { value: 'Yes — AI session summaries', isAvailable: true },
    openreplay: { value: 'No', isAvailable: false },
  },
  {
    name: 'Heatmaps (click/scroll/move)',
    us: { value: 'Yes', isAvailable: true },
    hotjar: { value: 'Yes', isAvailable: true },
    contentsquare: { value: 'Yes', isAvailable: true },
    posthog: { value: 'Limited', isAvailable: false },
    openreplay: { value: 'Limited', isAvailable: false },
  },
  {
    name: 'Session replay',
    us: { value: 'Yes', isAvailable: true },
    hotjar: { value: 'Yes', isAvailable: true },
    contentsquare: { value: 'Yes', isAvailable: true },
    posthog: { value: 'Yes', isAvailable: true },
    openreplay: { value: 'Yes', isAvailable: true },
  },
  {
    name: 'Cookieless by default',
    us: { value: 'Yes', isAvailable: true },
    hotjar: { value: 'No — sets cookies by default', isAvailable: false },
    contentsquare: { value: 'Configurable — via sessionStorage', isAvailable: true },
    posthog: { value: 'Configurable', isAvailable: true },
    openreplay: { value: 'Configurable', isAvailable: true },
  },
  {
    name: 'Composio-powered execution',
    us: { value: 'Yes (500+ app actions)', isAvailable: true },
    hotjar: { value: 'No', isAvailable: false },
    contentsquare: { value: 'No', isAvailable: false },
    posthog: { value: 'No', isAvailable: false },
    openreplay: { value: 'No', isAvailable: false },
  },
  {
    name: 'Starting price',
    us: { value: '$29/mo', isAvailable: true },
    hotjar: { value: 'Free up to 200K sessions/mo', isAvailable: false },
    contentsquare: { value: 'Custom / enterprise-sales', isAvailable: false },
    posthog: { value: 'Free tier + usage-based', isAvailable: false },
    openreplay: { value: 'Free (self-hosted)', isAvailable: false },
  },
]

function StatusIndicator({ isAvailable }: { isAvailable: boolean }) {
  return (
    <div style={{
      width: 12, height: 12, borderRadius: '50%',
      backgroundColor: isAvailable ? 'var(--ember)' : 'transparent',
      border: `2px solid ${isAvailable ? 'var(--ember)' : 'var(--ink-muted)'}`,
      marginRight: 10, flexShrink: 0,
      marginTop: 2
    }} />
  )
}

export function CompetitiveTable() {
  return (
    <div className="glass-panel" style={{ maxWidth: 1100, margin: '0 auto', width: '100%', overflowX: 'auto', paddingBottom: 20, padding: 32 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 900 }}>
        <thead>
          <tr>
            <th style={{ padding: '24px 16px', borderBottom: '1px solid var(--line)', width: '22%' }}></th>
            <th style={{ padding: '24px 16px', borderBottom: '2px solid var(--ember)', fontSize: 18, color: 'var(--ink)', width: '18%' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ background: 'var(--ember)', color: '#fff', borderRadius: 4, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', marginRight: 8, fontSize: 14 }}>U</div>
                UserSessions.io
              </div>
            </th>
            <th style={{ padding: '24px 16px', borderBottom: '1px solid var(--line)', fontSize: 16, color: 'var(--ink-muted)', width: '15%' }}>Hotjar</th>
            <th style={{ padding: '24px 16px', borderBottom: '1px solid var(--line)', fontSize: 16, color: 'var(--ink-muted)', width: '15%' }}>Contentsquare</th>
            <th style={{ padding: '24px 16px', borderBottom: '1px solid var(--line)', fontSize: 16, color: 'var(--ink-muted)', width: '15%' }}>PostHog</th>
            <th style={{ padding: '24px 16px', borderBottom: '1px solid var(--line)', fontSize: 16, color: 'var(--ink-muted)', width: '15%' }}>OpenReplay</th>
          </tr>
        </thead>
        <tbody>
          {features.map((f, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--line)', backgroundColor: i % 2 === 0 ? 'var(--bg-raised)' : 'transparent' }}>
              <td style={{ padding: '20px 16px', fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{f.name}</td>
              <td style={{ padding: '20px 16px', fontSize: 13, color: 'var(--ink)', borderLeft: '1px solid rgba(255,90,31,0.1)', borderRight: '1px solid rgba(255,90,31,0.1)', backgroundColor: 'var(--ember-glow)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <StatusIndicator isAvailable={f.us.isAvailable} />
                  <span>{f.us.value}</span>
                </div>
              </td>
              <td style={{ padding: '20px 16px', fontSize: 13, color: 'var(--ink-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <StatusIndicator isAvailable={f.hotjar.isAvailable} />
                  <span>{f.hotjar.value}</span>
                </div>
              </td>
              <td style={{ padding: '20px 16px', fontSize: 13, color: 'var(--ink-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <StatusIndicator isAvailable={f.contentsquare.isAvailable} />
                  <span>{f.contentsquare.value}</span>
                </div>
              </td>
              <td style={{ padding: '20px 16px', fontSize: 13, color: 'var(--ink-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <StatusIndicator isAvailable={f.posthog.isAvailable} />
                  <span>{f.posthog.value}</span>
                </div>
              </td>
              <td style={{ padding: '20px 16px', fontSize: 13, color: 'var(--ink-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <StatusIndicator isAvailable={f.openreplay.isAvailable} />
                  <span>{f.openreplay.value}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
