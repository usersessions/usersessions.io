import { motion } from "motion/react"

const SPRING = { type: 'spring', bounce: 0, duration: 0.35 } as const

export function BulkActionBar({ count, onApprove, onDismiss, onClear, loading }: {
  count: number; onApprove: () => void; onDismiss: () => void; onClear: () => void; loading: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
      transition={SPRING}
      style={{
        position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
        background: 'var(--bg-primary)', border: '1px solid var(--glass-border-heavy)', borderRadius: 14,
        boxShadow: '0 16px 48px rgba(20,32,43,0.12)', backdropFilter: 'blur(16px)', zIndex: 200, whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', minWidth: 60 }}>
        {count} selected
      </span>
      <div style={{ width: 1, height: 20, background: 'var(--glass-border-heavy)' }} />
      <button onClick={onDismiss} disabled={loading} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--glass-border-heavy)', background: 'var(--glass-bg-hover)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.5 : 1 }}>
        Dismiss all
      </button>
      <button onClick={onApprove} disabled={loading} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--orange-subtle)', background: 'var(--orange-subtle)', color: 'var(--orange)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.5 : 1 }}>
        Approve all →
      </button>
      <button onClick={onClear} style={{ padding: '4px 6px', borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: '16px', cursor: 'pointer', lineHeight: 1 }} aria-label="Clear selection">×</button>
    </motion.div>
  )
}
