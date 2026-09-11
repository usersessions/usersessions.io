import { motion } from "motion/react"
import { SEV_CLASS, CATEGORY_LABELS } from '@/lib/ui-constants'

const SPRING = { type: 'spring', bounce: 0.15, duration: 0.5 } as const
const FADE_IN = { type: 'spring', bounce: 0, duration: 0.45 } as const

export function QueueRow({
  finding,
  index,
  isSelected,
  isChecked,
  onSelect,
  onToggleCheck,
  delay,
  formatTime,
  checkboxElement
}: {
  finding: any
  index: number
  isSelected: boolean
  isChecked: boolean
  onSelect: () => void
  onToggleCheck: () => void
  delay: number
  formatTime: (date: string) => string
  checkboxElement: React.ReactNode
}) {
  const pendingAction = finding.us_actions.find((a: any) => a.status === 'approve_required')
  const executingAction = finding.us_actions.find((a: any) => a.status === 'executing')

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, height: 0, margin: 0, scale: 0.95, overflow: 'hidden' }}
      transition={{ ...SPRING, opacity: FADE_IN, delay }}
      whileTap={{ scale: 0.99, transition: { duration: 0.1 } }}
      onClick={onSelect}
      className="ds-queue-row ds-queue-grid"
      style={{
        cursor: 'pointer', alignItems: 'center',
        background: isChecked ? 'var(--cream)' : isSelected ? 'var(--glass-bg-hover)' : 'var(--bg-primary)',
        borderLeft: isChecked ? '4px solid var(--orange)' : isSelected ? '4px solid var(--text-primary)' : '4px solid transparent'
      }}
    >
      <div onClick={(e) => { e.stopPropagation(); onToggleCheck() }}>
        {checkboxElement}
      </div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span className={SEV_CLASS[finding.severity] ?? SEV_CLASS['P3']}>{finding.severity}</span>
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '15px', fontWeight: isSelected ? 700 : 600, color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
          {finding.summary}
        </p>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>{CATEGORY_LABELS[finding.category] ?? finding.category}</span>
          {!finding.us_sessions && (
            <span style={{ 
              background: 'rgba(99,102,241,0.1)', color: '#6366f1', 
              padding: '2px 6px', borderRadius: 4, fontSize: '9px', fontWeight: 700 
            }}>
              Initial site audit
            </span>
          )}
          {finding.account_value != null && <span style={{ color: 'var(--orange)' }}>${(finding.account_value / 1000).toFixed(0)}K ARR</span>}
        </p>
      </div>
      <span className="ds-queue-grid-hide-on-mobile" style={{
        fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600,
        color: executingAction ? '#f59e0b' : pendingAction ? 'var(--orange)' : 'var(--text-muted)',
        letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        transition: 'color 200ms ease',
      }}>
        {executingAction
          ? `⟳ ${executingAction.composio_toolkit.toLowerCase()} · executing`
          : pendingAction
            ? `${pendingAction.composio_toolkit.toLowerCase()} · ${pendingAction.composio_action.replace(/_/g, ' ').toLowerCase()}`
            : 'Review'}
      </span>
      <span className="ds-queue-grid-hide-on-mobile" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.04em', textAlign: 'right' }}>{formatTime(finding.created_at)}</span>
    </motion.div>
  )
}
