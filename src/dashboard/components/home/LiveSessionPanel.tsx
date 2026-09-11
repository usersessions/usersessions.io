'use client'

import React, { useEffect, useRef, useState } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────
interface Session {
  id: string
  name: string
  page: string
  flag: string
  browser: string
  os: string
  startedAt: number   // epoch ms
}

interface Action {
  id: string
  signal: string
  dest: string
  label: string
  color: string
  age: number   // seconds ago
}

// ── Static pools ───────────────────────────────────────────────────────────
const FIRST = ['Quiet', 'Mellow', 'Swift', 'Silent', 'Vivid', 'Lucky', 'Misty', 'Wandering', 'Brave', 'Calm', 'Distant', 'Eager', 'Fierce', 'Grand', 'Hasty', 'Idle', 'Jolly', 'Kind', 'Lively', 'Noble']
const SECOND = ['Otter', 'Crane', 'Heron', 'Osprey', 'Marten', 'Badger', 'Dormouse', 'Ibis', 'Seal', 'Finch', 'Falcon', 'Lynx', 'Puffin', 'Kestrel', 'Stoat', 'Vole', 'Newt', 'Gecko', 'Egret', 'Robin']
const PAGES  = ['/pricing', '/dashboard', '/', '/integrations', '/docs/install', '/changelog', '/blog/ai-analytics', '/features', '/onboarding', '/faq']
const FLAGS  = ['🇩🇪', '🇵🇱', '🇮🇹', '🇹🇷', '🇦🇺', '🇸🇪', '🇮🇳', '🇪🇸', '🇧🇷', '🇺🇸', '🇬🇧', '🇫🇷', '🇨🇦', '🇯🇵', '🇰🇷', '🇿🇦', '🇳🇱', '🇵🇹', '🇲🇽', '🇸🇬']
const BROWSERS = ['Chrome', 'Safari', 'Firefox', 'Edge']
const OS_LIST  = ['macOS', 'Windows', 'iOS', 'Android', 'Linux']

const ACTIONS_POOL: Omit<Action, 'id' | 'age'>[] = [
  { signal: 'Rage-click on checkout', dest: 'Jira', label: 'Issue PROJ-2847 filed', color: '#6366f1' },
  { signal: 'Funnel drop spike (+38%)', dest: 'Slack', label: 'Alert → #product-ops', color: '#f59e0b' },
  { signal: 'Churn risk — $140K account', dest: 'Salesforce', label: 'CS task created', color: '#ef4444' },
  { signal: 'JS error on export flow', dest: 'Linear', label: 'Bug LNR-994 filed', color: '#8b5cf6' },
  { signal: 'Weekly digest ready', dest: 'Notion', label: 'Doc written → Workspace', color: '#10b981' },
  { signal: 'Rage-click on nav menu', dest: 'GitHub', label: 'Issue #2291 opened', color: '#0ea5e9' },
  { signal: 'Drop on /pricing (3 sessions)', dest: 'Slack', label: 'Alert → #alerts', color: '#f59e0b' },
  { signal: 'Repeated 404 on docs', dest: 'Linear', label: 'Bug LNR-995 filed', color: '#8b5cf6' },
  { signal: 'Negative survey response', dest: 'HubSpot', label: 'High-priority task created', color: '#ef4444' },
  { signal: 'Checkout broken — enterprise', dest: 'Jira', label: 'Issue PROJ-2848 filed', color: '#6366f1' },
]

// ── Helpers ────────────────────────────────────────────────────────────────
let _counter = 0
function uid() { return `${Date.now()}-${_counter++}` }

function randPick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

function makeName() { return `${randPick(FIRST)} ${randPick(SECOND)}` }

function makeSession(): Session {
  return {
    id: uid(),
    name: makeName(),
    page: randPick(PAGES),
    flag: randPick(FLAGS),
    browser: randPick(BROWSERS),
    os: randPick(OS_LIST),
    startedAt: Date.now() - Math.floor(Math.random() * 90) * 1000,
  }
}

function makeAction(): Action {
  const pool = randPick(ACTIONS_POOL)
  return { ...pool, id: uid(), age: Math.floor(Math.random() * 12) }
}

function elapsed(ms: number) {
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

// ── Browser icon ──────────────────────────────────────────────────────────
function BrowserIcon({ browser }: { browser: string }) {
  const icons: Record<string, React.ReactElement> = {
    Chrome: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
        <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0-18 0" /><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0-6 0" /><path d="M12 9h8.4" /><path d="M14.6 13.5L10.4 20.8" /><path d="M9.4 13.5L5.2 6.3" />
      </svg>
    ),
    Safari: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
        <path d="M8 16l2-6 6-2-2 6-6 2" /><circle cx="12" cy="12" r="9" />
      </svg>
    ),
    Firefox: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
        <path d="M4 12a9 9 0 1 0 16.1-5.6c-1.6-1-3-1-4.8-1H14" />
      </svg>
    ),
    Edge: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
        <path d="M20.978 11.372a9 9 0 1 0-1.593 5.773" /><path d="M20.978 11.372c.21 3-5.034 2.413-6.913 1.486c1.392-1.6.402-4.038-2.274-3.851c-1.745.122-2.927 1.157-2.784 3.202c.28 3.99 4.444 6.205 10.36 4.79" />
      </svg>
    ),
  }
  return <span style={{ color: 'var(--muted)', opacity: 0.7 }}>{icons[browser] ?? icons.Chrome}</span>
}

// ── OS icon ───────────────────────────────────────────────────────────────
function OsIcon({ os }: { os: string }) {
  const style: React.CSSProperties = { width: 12, height: 12, color: 'var(--muted)', opacity: 0.7 }
  if (os === 'macOS' || os === 'iOS') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={style}>
        <path d="M9 7a3 3 0 0 1 6 0M8.286 7.008c-3.216 0-4.286 3.23-4.286 5.92 0 3.229 2.143 8.072 4.286 8.072 1.165-.05 1.799-.538 3.214-.538 1.406 0 1.607.538 3.214.538s4.286-3.229 4.286-5.381" />
      </svg>
    )
  }
  if (os === 'Windows') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={style}>
        <path d="M17.8 20l-12-1.5c-1-.1-1.8-.9-1.8-1.9V7.4c0-1 .8-1.8 1.8-1.9L17.8 4c1.2-.1 2.2.8 2.2 1.9v12.1c0 1.2-1.1 2.1-2.2 1.9z" /><path d="M12 5v14M4 12h16" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M4 10v6M20 10v6M7 9h10v8a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V9a5 5 0 0 1 10 0M8 3l1 2M16 3l-1 2M9 18v3M15 18v3" />
    </svg>
  )
}

// ── Live counter ──────────────────────────────────────────────────────────
function LiveCounter() {
  const [count, setCount] = useState(347)
  useEffect(() => {
    const t = setInterval(() => {
      setCount(c => {
        const delta = Math.random() < 0.6 ? 1 : -1
        return Math.max(280, Math.min(420, c + delta))
      })
    }, 3200)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="lsp-counter">
      <span className="lsp-counter-dot" />
      <span className="lsp-counter-num">{count}</span>
      <span className="lsp-counter-label">live sessions right now</span>
    </div>
  )
}

// ── Session row ───────────────────────────────────────────────────────────
function SessionRow({ session }: { session: Session }) {
  const [sec, setSec] = useState(Math.floor((Date.now() - session.startedAt) / 1000))
  useEffect(() => {
    const t = setInterval(() => setSec(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [])
  const dur = sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${sec % 60}s`
  return (
    <div className="lsp-session-row lsp-enter">
      <span className="lsp-session-dot" />
      <span className="lsp-session-name">{session.name}</span>
      <span className="lsp-session-page">{session.page}</span>
      <span className="lsp-session-dur">{dur}</span>
      <span className="lsp-session-icons">
        <span>{session.flag}</span>
        <BrowserIcon browser={session.browser} />
        <OsIcon os={session.os} />
      </span>
    </div>
  )
}

// ── Action row ────────────────────────────────────────────────────────────
function ActionRow({ action }: { action: Action }) {
  const [age, setAge] = useState(action.age)
  useEffect(() => {
    const t = setInterval(() => setAge(a => a + 1), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="lsp-action-row lsp-enter">
      <span className="lsp-action-badge" style={{ color: action.color, borderColor: action.color }}>
        {action.dest}
      </span>
      <div className="lsp-action-body">
        <div className="lsp-action-label">{action.label}</div>
        <div className="lsp-action-signal">{action.signal}</div>
      </div>
      <span className="lsp-action-age">{age}s ago</span>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export function LiveSessionPanel() {
  const MAX_SESSIONS = 7
  const MAX_ACTIONS  = 5

  const [sessions, setSessions] = useState<Session[]>(() =>
    Array.from({ length: MAX_SESSIONS }, makeSession)
  )
  const [actions, setActions] = useState<Action[]>(() =>
    Array.from({ length: MAX_ACTIONS }, makeAction)
  )
  const [tab, setTab] = useState<'sessions' | 'actions'>('sessions')
  const sessionRef = useRef(sessions)
  sessionRef.current = sessions

  // Add a new session every 2.5s
  useEffect(() => {
    const t = setInterval(() => {
      setSessions(prev => {
        const next = [makeSession(), ...prev]
        return next.slice(0, MAX_SESSIONS)
      })
    }, 2500)
    return () => clearInterval(t)
  }, [])

  // Add a new action every 4s
  useEffect(() => {
    const t = setInterval(() => {
      setActions(prev => {
        const next = [makeAction(), ...prev]
        return next.slice(0, MAX_ACTIONS)
      })
    }, 4000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="lsp-root">
      {/* Header */}
      <div className="lsp-header">
        <div className="lsp-header-left">
          <span className="lsp-header-dot" />
          <span className="lsp-header-title">usersessions.io</span>
        </div>
        <LiveCounter />
      </div>

      {/* Tabs */}
      <div className="lsp-tabs">
        <button
          className={`lsp-tab ${tab === 'sessions' ? 'lsp-tab--active' : ''}`}
          onClick={() => setTab('sessions')}
        >
          Live Sessions
        </button>
        <button
          className={`lsp-tab ${tab === 'actions' ? 'lsp-tab--active' : ''}`}
          onClick={() => setTab('actions')}
        >
          AI Actions
          <span className="lsp-tab-badge" />
        </button>
      </div>

      {/* Column headers */}
      {tab === 'sessions' && (
        <div className="lsp-col-headers">
          <span />
          <span>Visitor</span>
          <span>Page</span>
          <span>Time</span>
          <span>Device</span>
        </div>
      )}

      {/* Feed */}
      <div className="lsp-feed">
        {tab === 'sessions'
          ? sessions.map(s => <SessionRow key={s.id} session={s} />)
          : actions.map(a => <ActionRow key={a.id} action={a} />)
        }
      </div>

      {/* Footer */}
      <div className="lsp-footer">
        <span className="lsp-footer-badge">🔴 LIVE</span>
        <span className="lsp-footer-text">Watching every session. Acting on what matters.</span>
      </div>
    </div>
  )
}
