'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from "motion/react"
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { PiLockKeyBold, PiCheckBold, PiMinusBold } from 'react-icons/pi'
import { SEV_CLASS, CATEGORY_LABELS, STATUS_ICONS } from '@/lib/ui-constants'
import { PiCoffeeBold } from 'react-icons/pi'

import { DashboardPageHeader } from './DashboardPageHeader'
import { BulkActionBar } from './queue/BulkActionBar'
import { ActivityPulse } from './queue/ActivityPulse'
import { StatCards } from './queue/StatCards'
import { QueueRow } from './queue/QueueRow'
import { QueueSkeleton } from './queue/QueueSkeleton'

const SPRING = { type: 'spring', bounce: 0, duration: 0.35 } as const
const FADE_IN = { type: 'spring', bounce: 0, duration: 0.45 } as const

interface Finding {
  id: string
  category: string
  severity: string
  confidence: number
  summary: string
  account_value: number | null
  status: string
  created_at: string
  us_sessions: {
    source: string
    source_session_id: string
    replay_url: string | null
    error_count: number
    rage_click_count: number
  } | null
  us_actions: Array<{
    id: string
    composio_toolkit: string
    composio_action: string
    status: string
    result: string | null
  }>
}



function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = (now.getTime() - d.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function Checkbox({ checked, indeterminate, onChange }: {
  checked: boolean
  indeterminate?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      onClick={(e) => { e.stopPropagation(); onChange(!checked) }}
      style={{
        width: 16, height: 16, borderRadius: 4,
        border: `1.5px solid ${checked || indeterminate ? 'var(--orange)' : 'var(--glass-border-heavy)'}`,
        background: checked ? 'var(--orange)' : indeterminate ? 'rgba(252,163,17,0.2)' : 'transparent',
        flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center',
        justifyContent: 'center', transition: 'all 140ms ease', padding: 0,
      }}
    >
      {checked && <PiCheckBold size={9} stroke="#000" />}
      {indeterminate && !checked && <PiMinusBold size={8} color="var(--orange)" />}
    </button>
  )
}



const FETCH_QUERY = `id, category, severity, confidence, summary, account_value, status, created_at,
  us_sessions ( source, source_session_id, replay_url, error_count, rage_click_count ),
  us_actions ( id, composio_toolkit, composio_action, status, result )`

export function QueueClient({ isAtLeastPro = false, isAtLeastStarter = false }: { isAtLeastPro?: boolean, isAtLeastStarter?: boolean }) {
  const shouldReduceMotion = useReducedMotion()
  const [findings, setFindings] = useState<Finding[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIndex, setSelectedIndex] = useState<number>(0)
  const [panelOpen, setPanelOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [realtimeActive, setRealtimeActive] = useState(false)
  const activityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** Flash the ambient pulse for 2s when a realtime event fires. */
  const flashActivity = useCallback(() => {
    setRealtimeActive(true)
    if (activityTimerRef.current) clearTimeout(activityTimerRef.current)
    activityTimerRef.current = setTimeout(() => setRealtimeActive(false), 2000)
  }, [])

  const sortFindings = (data: Finding[]): Finding[] =>
    [...data].sort((a, b) => {
      const aP = a.us_actions.some(act => act.status === 'approve_required') ? 1 : 0
      const bP = b.us_actions.some(act => act.status === 'approve_required') ? 1 : 0
      if (bP !== aP) return bP - aP
      const aV = a.account_value ?? 0
      const bV = b.account_value ?? 0
      return bV - aV
    })

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('us_findings')
      .select(FETCH_QUERY)
      .in('status', ['pending'])
      .order('account_value', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setFindings(sortFindings(data as unknown as Finding[]))
    setLoading(false)
  }, [])

  // ── Supabase Realtime subscription (replaces 15s polling) ──────────────────
  useEffect(() => {
    load()
    const supabase = createClient()

    // Subscribe to us_findings changes
    const findingsChannel = supabase
      .channel('us_findings_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'us_findings' }, async (payload) => {
        flashActivity()
        // Fetch full record including relations for the new finding
        const { data: newFinding } = await supabase
          .from('us_findings')
          .select(FETCH_QUERY)
          .eq('id', payload.new.id)
          .maybeSingle()
        if (newFinding && newFinding.status === 'pending') {
          setFindings(prev => sortFindings([newFinding as unknown as Finding, ...prev]))
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'us_findings' }, (payload) => {
        flashActivity()
        const updated = payload.new
        if (updated.status !== 'pending') {
          // Finding resolved — remove from queue
          setFindings(prev => prev.filter(f => f.id !== updated.id))
        } else {
          // Status updated but still pending — refresh the row
          setFindings(prev => sortFindings(prev.map(f =>
            f.id === updated.id ? { ...f, ...updated } : f
          )))
        }
      })
      .subscribe()

    // Subscribe to us_actions changes so in-flight status updates live-update
    const actionsChannel = supabase
      .channel('us_actions_realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'us_actions' }, (payload) => {
        flashActivity()
        const updatedAction = payload.new
        setFindings(prev => prev.map(f => ({
          ...f,
          us_actions: f.us_actions.map(a =>
            a.id === updatedAction.id
              ? { ...a, status: updatedAction.status, result: updatedAction.result }
              : a
          ),
        })))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(findingsChannel)
      supabase.removeChannel(actionsChannel)
    }
  }, [load, flashActivity])

  const handleAction = useCallback(async (findingIndex: number, type: 'approve' | 'dismiss') => {
    if (findingIndex < 0 || findingIndex >= findings.length) return
    const finding = findings[findingIndex]
    // Optimistic remove
    setFindings(prev => prev.filter((_, i) => i !== findingIndex))
    setSelectedIds(prev => { const n = new Set(prev); n.delete(finding.id); return n })
    const pendingAction = finding.us_actions.find(a => a.status === 'approve_required')
    try {
      if (pendingAction) {
        const body = type === 'dismiss' ? { reason: 'dismissed from queue' } : undefined
        const res = await fetch(`/api/actions/${pendingAction.id}/${type}`, {
          method: 'POST',
          headers: type === 'dismiss' ? { 'content-type': 'application/json' } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        })
        if (!res.ok) throw new Error('Action failed')
      } else {
        const supabase = createClient()
        await supabase.from('us_findings').update({ status: type === 'approve' ? 'executed' : 'dismissed' }).eq('id', finding.id)
      }
      setNotification({ type: 'success', msg: `Finding ${type === 'approve' ? 'approved' : 'dismissed'} ✔` })
    } catch {
      setNotification({ type: 'error', msg: `Failed to ${type} finding` })
      load()
    }
    setTimeout(() => setNotification(null), 3000)
    if (findingIndex >= findings.length - 1) setSelectedIndex(Math.max(0, findings.length - 2))
  }, [findings, load])

  const handleBulkAction = useCallback(async (type: 'approve' | 'dismiss') => {
    if (selectedIds.size === 0 || bulkLoading) return
    setBulkLoading(true)
    const targets = findings.filter(f => selectedIds.has(f.id))
    // Optimistic bulk remove
    setFindings(prev => prev.filter(f => !selectedIds.has(f.id)))
    setSelectedIds(new Set())
    setPanelOpen(false)
    let successCount = 0; let failCount = 0
    await Promise.all(targets.map(async (finding) => {
      try {
        const pendingAction = finding.us_actions.find(a => a.status === 'approve_required')
        if (pendingAction) {
          const body = type === 'dismiss' ? { reason: 'bulk dismissed' } : undefined
          const res = await fetch(`/api/actions/${pendingAction.id}/${type}`, {
            method: 'POST', headers: type === 'dismiss' ? { 'content-type': 'application/json' } : undefined,
            body: body ? JSON.stringify(body) : undefined,
          })
          if (!res.ok) throw new Error()
        } else {
          const supabase = createClient()
          await supabase.from('us_findings').update({ status: type === 'approve' ? 'executed' : 'dismissed' }).eq('id', finding.id)
        }
        successCount++
      } catch { failCount++ }
    }))
    if (failCount > 0) { setNotification({ type: 'error', msg: `${failCount} action(s) failed` }); load() }
    else setNotification({ type: 'success', msg: `${successCount} finding${successCount > 1 ? 's' : ''} ${type === 'approve' ? 'approved' : 'dismissed'} ✔` })
    setTimeout(() => setNotification(null), 4000)
    setBulkLoading(false)
  }, [findings, selectedIds, bulkLoading, load])

  const allSelected = findings.length > 0 && selectedIds.size === findings.length
  const someSelected = selectedIds.size > 0 && !allSelected
  const toggleSelectAll = () => { if (allSelected) setSelectedIds(new Set()); else setSelectedIds(new Set(findings.map(f => f.id))) }
  const toggleSelectOne = (id: string) => { setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n }) }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return
      if (e.key === 'j') { setSelectedIndex(prev => Math.min(prev + 1, findings.length - 1)); e.preventDefault() }
      else if (e.key === 'k') { setSelectedIndex(prev => Math.max(prev - 1, 0)); e.preventDefault() }
      else if (e.key === 'Enter' || e.key === 'e') { setPanelOpen(prev => !prev); e.preventDefault() }
      else if (e.key === 'a') { if (selectedIds.size > 0) handleBulkAction('approve'); else if (findings.length > 0) handleAction(selectedIndex, 'approve'); e.preventDefault() }
      else if (e.key === 'd') { if (selectedIds.size > 0) handleBulkAction('dismiss'); else if (findings.length > 0) handleAction(selectedIndex, 'dismiss'); e.preventDefault() }
      else if (e.key === 'x') { if (findings[selectedIndex]) toggleSelectOne(findings[selectedIndex].id); e.preventDefault() }
      else if (e.key === 'Escape') { if (selectedIds.size > 0) setSelectedIds(new Set()); else setPanelOpen(false); e.preventDefault() }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [findings, selectedIndex, selectedIds, handleBulkAction, handleAction])

  const selectedFinding = findings[selectedIndex]

  return (
    <>
      {/* Keyframe for ambient pulse — injected once */}
      <style>{`
        @keyframes us-pulse {
          0% { box-shadow: 0 0 0 0 rgba(52,211,153,0.5); }
          70% { box-shadow: 0 0 0 8px rgba(52,211,153,0); }
          100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); }
        }
      `}</style>

      <div style={{ display: 'flex', gap: 32, flex: 1, minHeight: 0 }}>
        <AnimatePresence>
          {notification && (
            <motion.div initial={{ opacity: 0, y: -20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={SPRING}
              style={{ position: 'fixed', top: 24, right: 24, padding: '12px 20px', borderRadius: 8, background: notification.type === 'success' ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)', backdropFilter: 'blur(12px)', color: notification.type === 'success' ? 'rgba(52,211,153,0.9)' : '#f87171', border: `1px solid ${notification.type === 'success' ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`, fontWeight: 600, fontSize: '13px', zIndex: 1000, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
              {notification.msg}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedIds.size > 0 && (
            <BulkActionBar count={selectedIds.size} onApprove={() => handleBulkAction('approve')} onDismiss={() => handleBulkAction('dismiss')} onClear={() => setSelectedIds(new Set())} loading={bulkLoading} />
          )}
        </AnimatePresence>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <motion.div initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={SPRING} style={{ marginBottom: 24 }}>
            <DashboardPageHeader 
              icon={<ActivityPulse active={realtimeActive} />} 
              title="Decision Queue" 
              action={
                findings.length > 0 ? (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                    {findings.length} pending
                  </span>
                ) : null
              }
            />
          </motion.div>

          {/* Revenue at Risk stat bar */}
          {!loading && findings.length > 0 && (() => {
            const totalRisk = findings.reduce((sum, f) => sum + (f.account_value ?? 0), 0)
            const p0Count = findings.filter(f => f.severity === 'P0').length
            const p1Count = findings.filter(f => f.severity === 'P1').length
            const needsApproval = findings.filter(f => f.us_actions.some(a => a.status === 'approve_required')).length
            return (
              <StatCards 
                isAtLeastPro={isAtLeastPro} 
                totalRisk={totalRisk} 
                p0Count={p0Count} 
                p1Count={p1Count} 
                needsApproval={needsApproval} 
              />
            )
          })()}

          {loading ? (
            <QueueSkeleton />
          ) : findings.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              transition={{ ...SPRING, delay: 0.1 }}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 100%)',
                border: '1px solid var(--glass-border)', borderRadius: 16,
                margin: 24, padding: 48, textAlign: 'center',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)'
              }}
            >
              <div style={{
                width: 64, height: 64, borderRadius: '50%', background: 'var(--glass-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
                boxShadow: '0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.2)',
                border: '1px solid var(--glass-border-heavy)'
              }}>
                <PiCoffeeBold size={32} color="var(--text-muted)" />
              </div>
              <h3 style={{ fontSize: '22px', fontFamily: 'system-ui, sans-serif', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: 8 }}>
                Queue clear
              </h3>
              <p style={{ fontSize: '15px', color: 'var(--text-muted)', maxWidth: 300, lineHeight: 1.5 }}>
                You're all caught up. When the system proposes a fix, it will show up here.
              </p>
            </motion.div>
          ) : (
            <div className="ds-table-wrap" style={{ flex: 1, overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="ds-queue-grid" style={{ padding: '12px 24px', background: 'var(--glass-bg)', borderBottom: '1px solid var(--glass-border-heavy)', position: 'sticky', top: 0, zIndex: 10, alignItems: 'center' }}>
                  <Checkbox checked={allSelected} indeterminate={someSelected} onChange={toggleSelectAll} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Severity</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Finding</span>
                  <span className="ds-queue-grid-hide-on-mobile" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Required Action</span>
                  <span className="ds-queue-grid-hide-on-mobile" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Time</span>
                </div>

                <AnimatePresence>
                  {findings.map((f, i) => {
                    const isSelected = i === selectedIndex
                    const isChecked = selectedIds.has(f.id)
                    return (
                      <QueueRow
                        key={f.id}
                        finding={f}
                        index={i}
                        isSelected={isSelected}
                        isChecked={isChecked}
                        onSelect={() => { setSelectedIndex(i); setPanelOpen(true) }}
                        onToggleCheck={() => toggleSelectOne(f.id)}
                        delay={shouldReduceMotion ? 0 : 0.02 * i}
                        formatTime={formatTime}
                        checkboxElement={<Checkbox checked={isChecked} onChange={() => toggleSelectOne(f.id)} />}
                      />
                    )
                  })}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>

        <AnimatePresence>
          {panelOpen && selectedFinding && (
            <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 380, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={SPRING}
              style={{ borderLeft: '1px solid var(--glass-border-heavy)', background: 'var(--glass-bg)', overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '32px 0' }}>
              <div style={{ width: 380, padding: '0 32px', display: 'flex', flexDirection: 'column', gap: 32 }}>
                <div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <span className={SEV_CLASS[selectedFinding.severity] ?? SEV_CLASS['P3']}>{selectedFinding.severity}</span>
                    <span style={{ padding: '5px 10px', borderRadius: 8, background: 'var(--glass-bg-hover)', fontSize: '11px', fontWeight: 700, fontFamily: "'Space Mono', var(--font-mono)", color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      {CATEGORY_LABELS[selectedFinding.category] ?? selectedFinding.category}
                    </span>
                    {!selectedFinding.us_sessions && (
                      <span style={{ 
                        padding: '5px 10px', borderRadius: 8, background: 'rgba(99,102,241,0.1)', 
                        fontSize: '11px', fontWeight: 700, fontFamily: "'Space Mono', var(--font-mono)", 
                        color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.03em' 
                      }}>
                        Initial Site Audit
                      </span>
                    )}
                  </div>
                  <h3 style={{ fontFamily: "'Clash Display', sans-serif", fontSize: '22px', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.3, color: 'var(--text-primary)', marginBottom: 12 }}>{selectedFinding.summary}</h3>
                  {selectedFinding.account_value != null && (
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: 'var(--orange)' }}>${(selectedFinding.account_value / 1000).toFixed(0)}K ARR at risk</p>
                  )}
                </div>

                {/* Live action status panel */}
                {selectedFinding.us_actions.some(a => a.status === 'executing') && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
                    style={{ padding: '14px 18px', borderRadius: 10, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', display: 'flex', alignItems: 'center', gap: 10 }}
                  >
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                      style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(251,191,36,0.3)', borderTopColor: 'rgba(251,191,36,0.9)', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'rgba(251,191,36,0.8)' }}>Action executing…</span>
                  </motion.div>
                )}

                <div style={{ background: 'var(--glass-bg-hover)', border: '1px solid var(--glass-border)', borderRadius: 16, padding: 24 }}>
                  <p className="ds-section-label" style={{ marginBottom: 16 }}>Required Decision</p>
                  {selectedFinding.us_actions.filter(a => a.status === 'approve_required').length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {selectedFinding.us_actions.filter(a => a.status === 'approve_required').map(act => (
                        <div key={act.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{act.composio_toolkit}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>{act.composio_action.replace(/_/g, ' ')}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Review finding and acknowledge.</p>}
                  <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                    <button onClick={() => handleAction(selectedIndex, 'approve')} className="ds-btn-approve" style={{ flex: 1, padding: '14px', fontSize: '14px', display: 'flex', justifyContent: 'center', gap: 8 }}>Approve <span style={{ opacity: 0.5 }}>(a)</span></button>
                    <button onClick={() => handleAction(selectedIndex, 'dismiss')} className="ds-btn-dismiss" style={{ flex: 1, padding: '14px', fontSize: '14px', display: 'flex', justifyContent: 'center', gap: 8 }}>Dismiss <span style={{ opacity: 0.5 }}>(d)</span></button>
                  </div>
                </div>

                {selectedFinding.us_sessions && (
                  <div style={{ padding: '0 8px' }}>
                    <p className="ds-section-label" style={{ marginBottom: 16 }}>Session Context</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32 }}>
                      <div>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>Source</p>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedFinding.us_sessions.source}</p>
                      </div>
                      <div>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>Errors / Rage clicks</p>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedFinding.us_sessions.error_count} / {selectedFinding.us_sessions.rage_click_count}</p>
                      </div>
                    </div>
                    {selectedFinding.us_sessions.replay_url && (
                      isAtLeastStarter ? (
                        <a href={selectedFinding.us_sessions.replay_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 24, fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--orange)', textDecoration: 'none', borderBottom: '2px solid rgba(252,163,17,0.3)', paddingBottom: 2, transition: 'border-color 0.2s' }} onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--orange)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(252,163,17,0.3)'}>
                          Watch Session Replay ↗
                        </a>
                      ) : (
                        <Link href="/billing" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 24, fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--orange)', textDecoration: 'none', borderBottom: '2px solid rgba(252,163,17,0.3)', paddingBottom: 2 }}>
                          <PiLockKeyBold /> Unlock Session Replays
                        </Link>
                      )
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
