import { motion } from "motion/react"
import Link from 'next/link'
import { PiLockKeyBold } from 'react-icons/pi'

const SPRING = { type: 'spring', bounce: 0, duration: 0.35 } as const

export function StatCards({ 
  isAtLeastPro, 
  totalRisk, 
  p0Count, 
  p1Count, 
  needsApproval 
}: { 
  isAtLeastPro: boolean
  totalRisk: number
  p0Count: number
  p1Count: number
  needsApproval: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}
      style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12, marginBottom: 20,
      }}
    >
      <div style={{ position: 'relative', padding: '14px 18px', borderRadius: 10, background: 'rgba(252,163,17,0.06)', border: '1px solid rgba(252,163,17,0.18)', overflow: 'hidden' }}>
        {!isAtLeastPro ? (
          <>
            <div style={{ filter: 'blur(4px)', opacity: 0.6, userSelect: 'none', pointerEvents: 'none' }}>
              <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--orange)', marginBottom: 6 }}>Revenue at Risk</p>
              <p style={{ margin: 0, fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                $--
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>ARR</span>
              </p>
            </div>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(20,32,43,0.4)', backdropFilter: 'blur(2px)' }}>
              <PiLockKeyBold size={11} color="var(--orange)" style={{ marginBottom: 4 }} />
              <Link href="/billing" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--orange)', textDecoration: 'none', letterSpacing: '0.04em' }}>Upgrade to Pro</Link>
            </div>
          </>
        ) : (
          <>
            <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--orange)', marginBottom: 6 }}>Revenue at Risk</p>
            <p style={{ margin: 0, fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {totalRisk > 0 ? `$${(totalRisk / 1000).toFixed(0)}K` : '—'}
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>ARR</span>
            </p>
          </>
        )}
      </div>
      <div style={{ padding: '14px 18px', borderRadius: 10, background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.14)' }}>
        <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#ef4444', marginBottom: 6 }}>Critical</p>
        <p style={{ margin: 0, fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          {p0Count + p1Count}
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>P0/P1</span>
        </p>
      </div>
      <div style={{ padding: '14px 18px', borderRadius: 10, background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.14)' }}>
        <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--blue)', marginBottom: 6 }}>Awaiting Approval</p>
        <p style={{ margin: 0, fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          {needsApproval}
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>actions</span>
        </p>
      </div>
    </motion.div>
  )
}
