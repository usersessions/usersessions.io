'use client'

/**
 * SiteSwitcher — shows the user's connected site in the header
 * with a dropdown to switch between sites or navigate to settings.
 *
 * Currently supports single-site; architecture is ready for multi-site.
 */

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from "motion/react"
import Link from 'next/link'
import { PiGlobeBold, PiCaretDownBold, PiPlusBold, PiArrowUpRightBold, PiGearBold } from 'react-icons/pi'

export interface SiteOption {
  id: string
  domain: string
  isActive: boolean
  scriptInstalled?: boolean
}

interface SiteSwitcherProps {
  sites: SiteOption[]
  onSwitch?: (id: string) => void
}

function cleanDomain(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

const POPOVER_SPRING = { type: 'spring', bounce: 0, duration: 0.22 } as const

export function SiteSwitcher({ sites, onSwitch }: SiteSwitcherProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const activeSite = sites.find(s => s.isActive) ?? sites[0] ?? null
  const displayDomain = activeSite ? cleanDomain(activeSite.domain) : null

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={displayDomain ? `Current site: ${displayDomain}` : 'No site connected'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '4px 10px 4px 8px',
          borderRadius: 8,
          border: '1px solid rgba(0,0,0,0.10)',
          background: open ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.04)',
          cursor: 'pointer',
          transition: 'all 100ms ease',
          outline: 'none',
          maxWidth: 240,
        }}
        onMouseEnter={e => { if (!open) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.06)' }}
        onMouseLeave={e => { if (!open) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.04)' }}
        onFocus={e => { e.currentTarget.style.outline = '2px solid rgba(0,0,0,0.15)'; e.currentTarget.style.outlineOffset = '2px' }}
        onBlur={e => { e.currentTarget.style.outline = 'none' }}
      >
        <div style={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          background: activeSite?.scriptInstalled ? '#10B981' : activeSite ? '#F59E0B' : 'rgba(0,0,0,0.2)',
          boxShadow: activeSite?.scriptInstalled ? '0 0 5px rgba(16,185,129,0.5)' : 'none',
        }} />
        <PiGlobeBold size={13} color="rgba(0,0,0,0.45)" style={{ flexShrink: 0 }} />
        {displayDomain ? (
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: 600,
            color: 'rgba(0,0,0,0.65)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 150,
            letterSpacing: '-0.01em',
          }}>
            {displayDomain}
          </span>
        ) : (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'rgba(0,0,0,0.3)' }}>
            No site
          </span>
        )}
        <PiCaretDownBold
          size={12}
          color="rgba(0,0,0,0.35)"
          style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 180ms ease' }}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            aria-label="Site switcher"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={POPOVER_SPRING}
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              minWidth: 260,
              background: 'rgba(255,255,255,0.97)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(0,0,0,0.09)',
              borderRadius: 12,
              boxShadow: '0 12px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
              overflow: 'hidden',
              zIndex: 200,
            }}
          >
            <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'rgba(0,0,0,0.3)',
              }}>
                Connected Sites
              </span>
            </div>

            <div style={{ padding: '6px 0' }}>
              {sites.length === 0 ? (
                <div style={{ padding: '14px 14px', textAlign: 'center' }}>
                  <span style={{ fontSize: 13, color: 'rgba(0,0,0,0.4)' }}>No sites connected</span>
                </div>
              ) : (
                sites.map(site => {
                  const domain = cleanDomain(site.domain)
                  return (
                    <button
                      key={site.id}
                      role="option"
                      aria-selected={site.isActive}
                      onClick={() => { onSwitch?.(site.id); setOpen(false) }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '9px 14px',
                        background: site.isActive ? 'rgba(0,0,0,0.04)' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 80ms ease',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.05)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = site.isActive ? 'rgba(0,0,0,0.04)' : 'transparent' }}
                    >
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: site.scriptInstalled ? '#10B981' : '#F59E0B',
                        boxShadow: site.scriptInstalled ? '0 0 6px rgba(16,185,129,0.45)' : 'none',
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: 'rgba(0,0,0,0.8)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {domain}
                        </div>
                        <div style={{ fontSize: '10px', color: 'rgba(0,0,0,0.35)', marginTop: 1 }}>
                          {site.scriptInstalled ? 'Script active' : 'Script not detected'}
                        </div>
                      </div>
                      {site.isActive && (
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          fontFamily: 'var(--font-mono)',
                          color: 'rgba(0,0,0,0.3)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          flexShrink: 0,
                        }}>
                          active
                        </span>
                      )}
                      {site.domain && (
                        <a
                          href={site.domain.startsWith('http') ? site.domain : `https://${site.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          title={`Open ${domain}`}
                          style={{
                            display: 'flex', alignItems: 'center', padding: 4,
                            borderRadius: 4, color: 'rgba(0,0,0,0.3)',
                            textDecoration: 'none', flexShrink: 0,
                            transition: 'color 100ms ease',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(0,0,0,0.7)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(0,0,0,0.3)' }}
                        >
                          <PiArrowUpRightBold size={11} />
                        </a>
                      )}
                    </button>
                  )
                })
              )}
            </div>

            <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', padding: '6px 0' }}>
              <Link
                href="/settings#site"
                onClick={() => setOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '9px 14px', textDecoration: 'none',
                  color: 'rgba(0,0,0,0.5)', fontSize: 12, fontWeight: 500,
                  transition: 'background 80ms ease',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(0,0,0,0.04)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
              >
                <PiGearBold size={13} />
                Manage site
              </Link>
              <Link
                href="/settings#site"
                onClick={() => setOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '9px 14px', textDecoration: 'none',
                  color: 'rgba(0,0,0,0.5)', fontSize: 12, fontWeight: 500,
                  transition: 'background 80ms ease',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(0,0,0,0.04)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
              >
                <PiPlusBold size={13} />
                Add another site
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
