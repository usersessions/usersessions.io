'use client'

import { useEffect, useState } from 'react'
import { Command } from 'cmdk'
import { Search, LayoutGrid, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from "motion/react"

const NAV_ITEMS = [
  { label: 'Action Queue', path: '/', shortcut: 'Q' },
  { label: 'Accounts', path: '/accounts', shortcut: 'A' },
  { label: 'Agent Execution Log', path: '/audit', shortcut: 'L' },
  { label: 'Team', path: '/team', shortcut: 'T' },
  { label: 'Settings', path: '/settings', shortcut: 'S' },
]

const QUICK_ACTIONS = [
  { label: 'Review Autonomous Patches', path: '/', description: 'Queue filtered to items needing a decision' },
  { label: 'Add Policy Rule', path: '/settings', description: 'Create a new autonomy rule' },
  { label: 'Connect Integration', path: '/connect', description: 'Add a new session source or destination' },
  { label: 'Export Agent Log (CSV)', path: '/audit', description: 'Download CSV of all autonomous actions' },
  { label: 'View Failed Fixes', path: '/audit', description: 'Agent log filtered to failures' },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const [search, setSearch] = useState('')

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        if (e.key === 'k' && (e.metaKey || e.ctrlKey)) { /* allow */ } else { return }
      }
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const runCommand = (command: () => void) => {
    setOpen(false)
    setSearch('')
    command()
  }

  return (
    <AnimatePresence>
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh' }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 580, background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 32px 96px rgba(0,0,0,0.1), 0 4px 24px rgba(0,0,0,0.04)' }}
          >
            <Command loop style={{ width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--glass-border)' }}>
                <Search size={14} style={{ marginRight: 12, color: '#64748b', flexShrink: 0 }} />
                <Command.Input
                  placeholder="Jump to anything — accounts, agent log, policies..."
                  value={search}
                  onValueChange={setSearch}
                  autoFocus
                  className="cmdk-input"
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#0f172a', fontSize: '15px', letterSpacing: '-0.01em' }}
                />
                <kbd style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#64748b', padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(0,0,0,0.02)', flexShrink: 0 }}>ESC</kbd>
              </div>

              <Command.List style={{ maxHeight: 380, overflowY: 'auto', padding: '8px' }} className="cmdk-list">
                <Command.Empty style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                  No results found.
                </Command.Empty>

                <Command.Group heading="Navigate">
                  {NAV_ITEMS.map(item => (
                    <Command.Item
                      key={item.path + item.label}
                      className="cmdk-item"
                      value={item.label}
                      onSelect={() => runCommand(() => router.push(item.path))}
                    >
                      <span className="cmdk-icon">
                        <LayoutGrid size={12} />
                      </span>
                      <span style={{ color: '#1f2937' }}>{item.label}</span>
                      <kbd style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#64748b', padding: '1px 5px', borderRadius: 3, border: '1px solid rgba(0,0,0,0.08)', background: '#f8fafc', flexShrink: 0 }}>{item.shortcut}</kbd>
                    </Command.Item>
                  ))}
                </Command.Group>

                <Command.Group heading="Quick Actions">
                  {QUICK_ACTIONS.map(action => (
                    <Command.Item
                      key={action.label}
                      className="cmdk-item"
                      value={action.label + ' ' + action.description}
                      onSelect={() => runCommand(() => router.push(action.path))}
                    >
                      <span className="cmdk-icon">
                        <Plus size={12} />
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span style={{ fontSize: '13px', color: '#1f2937' }}>{action.label}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#64748b', letterSpacing: '0.02em' }}>{action.description}</span>
                      </div>
                    </Command.Item>
                  ))}
                </Command.Group>
              </Command.List>

              <div style={{ padding: '10px 20px', borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', gap: 16, background: '#f8fafc' }}>
                {[['\\u2191\\u2193', 'navigate'], ['\\u21b5', 'select'], ['esc', 'close']].map(([key, label]) => (
                  <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <kbd style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#64748b', padding: '2px 5px', borderRadius: 3, border: '1px solid rgba(0,0,0,0.1)', background: '#fff' }}>{key}</kbd>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#64748b', letterSpacing: '0.04em' }}>{label}</span>
                  </span>
                ))}
              </div>
            </Command>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
