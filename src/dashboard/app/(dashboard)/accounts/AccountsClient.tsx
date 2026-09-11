'use client'

import { useMemo, useState } from 'react'
import { motion, useReducedMotion } from "motion/react"
import { PiMagnifyingGlassBold } from 'react-icons/pi'

const SPRING = { type: 'spring', bounce: 0, duration: 0.35 } as const

interface RawFinding {
  id: string
  severity: string
  status: string
  account_value: number | null
  created_at: string
  summary: string
  us_sessions: { source: string; source_session_id: string } | null
  us_actions: Array<{ id: string; composio_toolkit: string; status: string; executed_at: string | null }>
}

interface AccountSummary {
  name: string
  arr: number
  openFindings: number
  totalFindings: number
  lastAction: string | null
  arrAtRisk: number
  severities: Record<string, number>
}

const SEV_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 }

export default function AccountsClient({ findings }: { findings: RawFinding[] }) {
  const shouldReduceMotion = useReducedMotion()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'arr' | 'arrAtRisk' | 'openFindings'>('arrAtRisk')

  // Group findings by a human-readable account label derived from session data
  const accounts = useMemo(() => {
    const map = new Map<string, AccountSummary>()

    findings.forEach(f => {
      // Derive a label — use source_session_id prefix or fall back to ARR bucket
      const rawName = f.us_sessions?.source_session_id
        ? `Account #${f.us_sessions.source_session_id.slice(0, 8).toUpperCase()}`
        : f.account_value
          ? `${Math.round(f.account_value / 1000)}K Segment`
          : 'Unknown Account'

      if (!map.has(rawName)) {
        map.set(rawName, {
          name: rawName,
          arr: f.account_value ?? 0,
          openFindings: 0,
          totalFindings: 0,
          lastAction: null,
          arrAtRisk: 0,
          severities: {},
        })
      }

      const acct = map.get(rawName)!
      acct.totalFindings++
      if (f.status === 'pending') {
        acct.openFindings++
        acct.arrAtRisk += f.account_value ?? 0
      }
      acct.severities[f.severity] = (acct.severities[f.severity] ?? 0) + 1

      // Track latest executed action
      f.us_actions.forEach(action => {
        if (action.executed_at && (!acct.lastAction || action.executed_at > acct.lastAction)) {
          acct.lastAction = action.executed_at
        }
      })
    })

    return Array.from(map.values())
  }, [findings])

  const filtered = useMemo(() => {
    return accounts
      .filter(a => search === '' || a.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === 'arr') return b.arr - a.arr
        if (sortBy === 'arrAtRisk') return b.arrAtRisk - a.arrAtRisk
        return b.openFindings - a.openFindings
      })
  }, [accounts, search, sortBy])

  const totalARR = accounts.reduce((s, a) => s + a.arr, 0)
  const totalAtRisk = accounts.reduce((s, a) => s + a.arrAtRisk, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, maxWidth: 1040, margin: '0 auto', width: '100%' }}>

      {/* Header */}
      <motion.div
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING}
      >
        <p className="ds-section-label" style={{ marginBottom: 10 }}>Portfolio</p>
        <h1 className="ds-page-title">Accounts</h1>
        <p className="ds-page-sub">Revenue exposure by account — sorted by ARR at risk.</p>
      </motion.div>

      {/* Summary Stats */}
      <motion.div
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING, delay: 0.05 }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}
      >
        {[
          { label: 'Total ARR Tracked', value: `$${(totalARR / 1000).toFixed(0)}K`, sub: `${accounts.length} accounts` },
          { label: 'ARR at Risk', value: `$${(totalAtRisk / 1000).toFixed(0)}K`, sub: 'from open findings', accent: totalAtRisk > 0 },
          { label: 'Open Findings', value: accounts.reduce((s, a) => s + a.openFindings, 0).toString(), sub: 'pending decisions' },
        ].map((stat) => (
          <div key={stat.label} className="ds-stat-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>{stat.label}</p>
            <p style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.04em', color: stat.accent ? '#dc2626' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{stat.value}</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>{stat.sub}</p>
          </div>
        ))}
      </motion.div>

      {/* Controls */}
      <motion.div
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING, delay: 0.1 }}
        style={{ display: 'flex', gap: 12, alignItems: 'center' }}
      >
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search accounts…"
            className="ds-input"
            style={{ paddingLeft: 36, fontSize: '13px', width: '100%' }}
          />
          <PiMagnifyingGlassBold size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        </div>
        <div className="ds-filter-bar">
          {[
            { key: 'arrAtRisk', label: 'ARR at Risk' },
            { key: 'arr', label: 'Total ARR' },
            { key: 'openFindings', label: 'Open Findings' },
          ].map(opt => (
            <button
              key={opt.key}
              className={`ds-filter-chip ${sortBy === opt.key ? 'active' : ''}`}
              onClick={() => setSortBy(opt.key as typeof sortBy)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Account Table */}
      {filtered.length === 0 ? (
        <div className="ds-empty">
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500 }}>
            {search ? `No accounts matching "${search}"` : 'No accounts with ARR data yet.'}
          </p>
        </div>
      ) : (
        <motion.div
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.15 }}
          className="ds-table-wrap"
        >
          <table className="ds-table">
            <thead>
              <tr>
                {['Account', 'ARR', 'ARR at Risk', 'Open', 'Last Action', 'Severity Mix'].map(h => (
                  <th key={h} style={h === 'ARR at Risk' ? { color: 'rgba(248,113,113,0.7)' } : {}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((acct, i) => (
                <motion.tr
                  key={acct.name}
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...SPRING, delay: 0.18 + i * 0.025 }}
                >
                  <td>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>{acct.name}</span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                      ${(acct.arr / 1000).toFixed(0)}K
                    </span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: acct.arrAtRisk > 0 ? '#dc2626' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {acct.arrAtRisk > 0 ? `$${(acct.arrAtRisk / 1000).toFixed(0)}K` : '—'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: acct.openFindings > 0 ? 'var(--orange)' : 'var(--text-muted)', fontWeight: acct.openFindings > 0 ? 700 : 400 }}>
                      {acct.openFindings}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
                      {acct.lastAction
                        ? new Date(acct.lastAction).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : '—'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {Object.entries(acct.severities)
                        .sort(([a], [b]) => (SEV_ORDER[a] ?? 9) - (SEV_ORDER[b] ?? 9))
                        .map(([sev, count]) => (
                          <span key={sev} className={`ds-badge ds-badge--${sev.toLowerCase()}`} style={{ fontSize: '9px', padding: '2px 5px' }}>
                            {sev}×{count}
                          </span>
                        ))}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}
    </div>
  )
}
