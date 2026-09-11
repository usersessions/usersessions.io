import React from 'react'

interface DashboardPageHeaderProps {
  icon: React.ReactNode
  title: string
  /** Primary action or badge shown on the right — also accepted as `action` for back-compat */
  action?: React.ReactNode
  rightContent?: React.ReactNode
}

export function DashboardPageHeader({ icon, title, action, rightContent }: DashboardPageHeaderProps) {
  const right = action ?? rightContent
  return (
    <header style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 40, height: 40, borderRadius: 12,
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border-heavy)',
            color: 'var(--text-secondary)'
          }}>
            {icon}
          </div>
          <h1 className="ds-page-title" style={{ margin: 0 }}>{title}</h1>
        </div>
        {right && <div>{right}</div>}
      </div>
    </header>
  )
}
