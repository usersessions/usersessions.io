import { motion } from "motion/react"

export function QueueSkeleton() {
  return (
    <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: i * 0.05 }}
          className="ds-queue-row ds-queue-grid"
          style={{ background: 'var(--bg-primary)', opacity: 0.7, pointerEvents: 'none' }}
        >
          <div style={{ width: 16, height: 16, borderRadius: 4, background: 'var(--glass-border-heavy)' }} />
          <div style={{ width: 48, height: 20, borderRadius: 10, background: 'var(--glass-border-heavy)' }} />
          <div>
            <div style={{ width: '80%', height: 16, borderRadius: 4, background: 'var(--glass-border-heavy)', marginBottom: 8 }} />
            <div style={{ width: '40%', height: 12, borderRadius: 4, background: 'var(--glass-border-heavy)' }} />
          </div>
          <div className="ds-queue-grid-hide-on-mobile" style={{ width: 80, height: 14, borderRadius: 4, background: 'var(--glass-border-heavy)' }} />
          <div className="ds-queue-grid-hide-on-mobile" style={{ width: 40, height: 12, borderRadius: 4, background: 'var(--glass-border-heavy)', justifySelf: 'flex-end' }} />
        </motion.div>
      ))}
    </div>
  )
}
