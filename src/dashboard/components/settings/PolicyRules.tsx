'use client'

/**
 * /settings/policies — Policy Engine (Build Spec §10)
 * Simple rule builder for autonomy (auto-execute vs. approve_required)
 * Dark Premium rewrite.
 */

import { useState, useEffect } from 'react'
import { motion, useReducedMotion } from "motion/react"


const SPRING = { type: 'spring', bounce: 0, duration: 0.38 } as const

interface PolicyRule {
  id: string
  category: string
  severity: string
  arr_threshold: number | null
  autonomy: 'auto' | 'approve_required'
}

export default function PolicyRulesPage() {
  const shouldReduceMotion = useReducedMotion()
  
  const [rules, setRules] = useState<PolicyRule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/policy')
        const data = await res.json()
        if (data.rules) {
          const mapped = data.rules.map((r: any) => ({
            id: r.id,
            category: r.condition?.category ?? 'any',
            severity: r.condition?.severity ?? 'any',
            arr_threshold: r.condition?.arr_threshold ?? null,
            autonomy: r.autonomy_level
          }))
          setRules(mapped)
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const payload = rules.map(r => ({
        condition: {
          category: r.category,
          severity: r.severity,
          arr_threshold: r.arr_threshold
        },
        action_template: {},
        autonomy_level: r.autonomy
      }))
      const res = await fetch('/api/policy', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rules: payload })
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to save policies')
      }
      
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const TEMPLATES = [
    { label: 'Auto-execute low-risk', category: 'friction', severity: 'P3', arr_threshold: 50000, autonomy: 'auto' as const },
    { label: 'Approve all billing', category: 'billing', severity: 'any', arr_threshold: null, autonomy: 'approve_required' as const },
    { label: 'Auto P2/P3 under $50K', category: 'any', severity: 'P2', arr_threshold: 50000, autonomy: 'auto' as const },
  ]

  const addRule = (template?: typeof TEMPLATES[0]) => {
    setRules([...rules, {
      id: Math.random().toString(),
      category: template?.category ?? 'any',
      severity: template?.severity ?? 'any',
      arr_threshold: template?.arr_threshold ?? null,
      autonomy: template?.autonomy ?? 'approve_required',
    }])
  }

  const updateRule = (id: string, updates: Partial<PolicyRule>) => {
    setRules(rules.map(r => r.id === id ? { ...r, ...updates } : r))
  }

  const removeRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
      <motion.div 
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}
      >
        <h2 className="ds-section-label">Policy Rules</h2>
        
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Template quick-add buttons */}
          {TEMPLATES.map(tpl => (
            <button
              key={tpl.label}
              onClick={() => addRule(tpl)}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: '1px solid var(--glass-border-heavy)',
                background: 'var(--bg-canvas)',
                color: 'var(--text-secondary)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                letterSpacing: '-0.01em',
                transition: 'all 140ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--border)'; e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-canvas)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
            >
              + {tpl.label}
            </button>
          ))}
          {error && (<motion.span initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} style={{ color: '#f87171', fontSize: '13px' }}
            >
              ❌ {error}
            </motion.span>
          )}
          {saved && !error && (
            <motion.span 
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              style={{ color: 'rgba(52,211,153,0.9)', fontSize: '13px' }}
            >
              ✅ Saved
            </motion.span>
          )}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleSave}
            disabled={saving || loading}
            className="ds-btn-approve"
            style={{
              padding: '10px 20px',
              fontSize: '13px',
              cursor: saving ? 'wait' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save Policies'}
          </motion.button>
        </div>
      </motion.div>

      {loading ? (
        <div className="ds-empty">
          <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }}>
            <p className="ds-empty-title">Loading policies...</p>
          </motion.div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {rules.map((rule, i) => (
            <motion.div
              key={rule.id}
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING, delay: 0.1 + i * 0.05 }}
              className="ds-stat-card"
              style={{
                display: 'flex',
                gap: 16,
                alignItems: 'center',
                flexWrap: 'wrap',
                padding: '24px 32px'
              }}
            >
              
              <select 
                value={rule.category}
                onChange={(e) => updateRule(rule.id, { category: e.target.value })}
                style={{ 
                  width: 'auto', 
                  padding: '10px 32px 10px 16px', 
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--glass-border-heavy)',
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontWeight: 600,
                  outline: 'none',
                  appearance: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="any">Any Category</option>
                <option value="bug">Bug</option>
                <option value="friction">Friction</option>
                <option value="billing">Billing</option>
                <option value="security">Security</option>
              </select>


              <select 
                value={rule.severity}
                onChange={(e) => updateRule(rule.id, { severity: e.target.value })}
                style={{ 
                  width: 'auto', 
                  padding: '10px 32px 10px 16px', 
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--glass-border-heavy)',
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontWeight: 600,
                  outline: 'none',
                  appearance: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="any">Any Severity</option>
                <option value="P0">P0 (Revenue blocking)</option>
                <option value="P1">P1 (High priority)</option>
                <option value="P2">P2 (Friction)</option>
                <option value="P3">P3 (Minor)</option>
              </select>


              <select 
                value={rule.arr_threshold === null ? 'any' : rule.arr_threshold.toString()}
                onChange={(e) => updateRule(rule.id, { arr_threshold: e.target.value === 'any' ? null : parseInt(e.target.value) })}
                style={{ 
                  width: 'auto', 
                  padding: '10px 32px 10px 16px', 
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--glass-border-heavy)',
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontWeight: 600,
                  outline: 'none',
                  appearance: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="any">Any ARR</option>
                <option value="10000">≥ $10k ARR</option>
                <option value="50000">≥ $50k ARR</option>
                <option value="100000">≥ $100k ARR</option>
              </select>

              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-muted)', margin: '0 8px' }}>→</div>

              <select 
                value={rule.autonomy}
                onChange={(e) => updateRule(rule.id, { autonomy: e.target.value as 'auto' | 'approve_required' })}
                style={{
                  width: 'auto', 
                  padding: '10px 32px 10px 16px',
                  borderRadius: 8,
                  border: `1px solid ${rule.autonomy === 'auto' ? 'rgba(52,211,153,0.3)' : 'rgba(252,163,17,0.3)'}`,
                  background: rule.autonomy === 'auto' ? 'rgba(52,211,153,0.05)' : 'rgba(252,163,17,0.05)',
                  color: rule.autonomy === 'auto' ? 'rgba(52,211,153,0.9)' : 'var(--orange)',
                  fontSize: '13px',
                  fontWeight: 700,
                  outline: 'none',
                  appearance: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="auto">🤖 Auto-execute</option>
                <option value="approve_required">👤 Require Approval</option>
              </select>
              
              <button
                onClick={() => removeRule(rule.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: 'var(--text-muted)', borderRadius: 8, marginLeft: 'auto', transition: 'all 150ms ease' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(248,113,113,0.1)'
                  e.currentTarget.style.color = '#f87171'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'none'
                  e.currentTarget.style.color = 'var(--text-muted)'
                }}
              >
                ✕
              </button>
            </motion.div>
          ))}

          <motion.button
            whileTap={{ scale: 0.99 }}
            onClick={() => addRule()}
            style={{
              border: '1px dashed var(--border)', 
              borderRadius: 12, padding: 24, textAlign: 'center', cursor: 'pointer',
              color: 'var(--text-secondary)', fontWeight: 600, fontSize: '14px',
              background: 'var(--glass-bg)', transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--glass-bg-hover)'; e.currentTarget.style.borderColor = 'var(--text-muted)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--glass-bg)'; e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            + Add Policy Rule
          </motion.button>
        </div>
      )}
      
      <div className="ds-stat-card" style={{ marginTop: 24, padding: 32, background: 'var(--bg-canvas)' }}>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
          UserSessions evaluates rules from top to bottom. The first rule that matches a finding dictates the autonomy level. 
          If no rule matches, the system defaults to <strong style={{ color: 'var(--text-primary)' }}>Require Approval</strong> for all actions. 
          Note: High-risk actions like altering billing state will always require approval regardless of these rules.
        </p>
      </div>
    </div>
  )
}
