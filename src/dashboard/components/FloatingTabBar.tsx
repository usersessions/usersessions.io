'use client'

/**
 * FloatingTabBar — Tesla "Reduce Clicks" edition.
 * Before: 13 icons. After: 5 primary + Ask AI + ··· overflow.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence, useSpring, useMotionValue, useTransform } from "motion/react"
import {
  PiHouseBold, PiFireBold, PiCrosshairBold, PiCheckSquareOffsetBold,
  PiFunnelBold, PiSparkleBold, PiDotsThreeBold, PiPaperPlaneTiltBold,
  PiXBold, PiArrowLeftBold, PiShieldWarningBold, PiPlugBold, PiGearBold,
  PiBellBold, PiPulseBold, PiVideoConferenceBold, PiCursorClickBold,
  PiUsersBold, PiCreditCardBold,
} from 'react-icons/pi'

const SPRING = { type: 'spring', stiffness: 550, damping: 40 } as const
type Surface = 'none' | 'chat' | 'menu'

interface Tab { label: string; href: string; icon: React.ElementType; badge?: number }
interface OverflowItem { label: string; href: string; icon: React.ElementType; badge?: number }
interface ChatMessage {
  id: number; role: 'user' | 'ai'; text: string
  sessions?: { id: string; created_at: string; rage_click_count: number }[]
}

const MOCK_REPLIES = [
  'Your top friction point is the checkout form — 34% of sessions rage-click the "Place Order" button.',
  'Most visitors drop off on /pricing after 18 seconds. Consider simplifying the plan comparison.',
  'Sessions with errors spike on Tuesdays 14:00–16:00 UTC. Check your deployment schedule.',
]
const SUGGESTED = [
  'Why are users rage-clicking the checkout button?',
  'Which page has the most friction this week?',
  'What caused our bounce rate to spike?',
]

const labelVariants = {
  enter: (dir: number) => ({ x: `${dir * 110}%` }),
  center: { x: '0%' },
  exit: (dir: number) => ({ x: dir * -130 }),
}
const rowVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 16 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -16, transition: { duration: 0.1 } }),
}

function DockItem({ mouseX, children, onMouseEnter, onMouseMove, onBlur, onFocus, className }: any) {
  const ref = useRef<HTMLDivElement>(null)
  const distance = useTransform(mouseX, (val: number) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 }
    return val - bounds.x - bounds.width / 2
  })
  const sizeSync = useTransform(distance, [-120, 0, 120], [38, 58, 38])
  const size = useSpring(sizeSync, { mass: 0.1, stiffness: 250, damping: 20 })
  return (
    <motion.div ref={ref} style={{ width: size, height: size }}
      className={`relative flex items-center justify-center rounded-full outline-none transition-colors duration-200 flex-shrink-0 ${className}`}
      onMouseEnter={onMouseEnter} onMouseMove={onMouseMove} onBlur={onBlur} onFocus={onFocus}
    >
      <motion.div style={{ scale: useTransform(size, [38, 58], [1, 1.5]) }} className="flex items-center justify-center">
        {children}
      </motion.div>
    </motion.div>
  )
}

export interface FloatingTabBarProps {
  isAdmin?: boolean
  pendingCount?: number
  findingsCount?: number
  notificationsCount?: number
  hasCrmConnected?: boolean
  clientId?: string | null
}

export function FloatingTabBar({
  isAdmin = false, pendingCount = 0, findingsCount = 0,
  notificationsCount = 0, hasCrmConnected = false, clientId = null,
}: FloatingTabBarProps) {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // THE 5 — only items needed on every single session
  const PRIMARY_TABS: Tab[] = [
    { label: 'Today',    href: '/',          icon: PiHouseBold },
    { label: 'Sessions', href: '/sessions',  icon: PiFireBold },
    { label: 'Findings', href: '/findings',  icon: PiCrosshairBold,         badge: findingsCount },
    { label: 'Actions',  href: '/approvals', icon: PiCheckSquareOffsetBold, badge: pendingCount },
  ]

  // OVERFLOW — power-user items, 1 tap away
  const OVERFLOW_ITEMS: OverflowItem[] = [
    { label: 'Live Patches',  href: '/live-patches',  icon: PiPulseBold },
    { label: 'Connect',       href: '/connect',       icon: PiPlugBold },
    { label: 'Team',          href: '/team',          icon: PiUsersBold },
    { label: 'Billing',       href: '/billing',       icon: PiCreditCardBold },
    { label: 'Notifications', href: '/notifications', icon: PiBellBold, badge: notificationsCount },
    { label: 'Settings',      href: '/settings',      icon: PiGearBold },
    ...(isAdmin ? [{ label: 'Admin', href: '/admin', icon: PiShieldWarningBold } as OverflowItem] : []),
  ]

  const CHAT_INDEX = PRIMARY_TABS.length
  const MORE_INDEX = PRIMARY_TABS.length + 1
  const ALL_TOOLTIP_LABELS = [...PRIMARY_TABS.map(t => t.label), 'Ask AI', 'More']

  const [hovered, setHovered] = useState<number | null>(null)
  const [tip, setTip] = useState(0)
  const [anchorX, setAnchorX] = useState(0)
  const [dir, setDir] = useState(1)
  const itemRefs = useRef<(HTMLElement | null)[]>([])
  const mouseX = useMotionValue(Infinity)

  const [surface, setSurface] = useState<Surface>('none')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const replyTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const scrollRef = useRef<HTMLDivElement>(null)

  const [box, setBox] = useState<{ width: number; height: number } | null>(null)
  const widthSpring  = useSpring(0, { stiffness: 550, damping: 40 })
  const heightSpring = useSpring(0, { stiffness: 550, damping: 40 })
  const hadBox = useRef(false)

  useEffect(() => {
    if (!box) return
    if (!hadBox.current) { hadBox.current = true; widthSpring.jump(box.width); heightSpring.jump(box.height); return }
    widthSpring.set(box.width); heightSpring.set(box.height)
  }, [box, widthSpring, heightSpring])

  const measureRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    const apply = () => { const r = node.getBoundingClientRect(); setBox({ width: r.width, height: r.height }) }
    apply()
    let frame = 0
    const obs = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(apply) })
    obs.observe(node)
    return () => { cancelAnimationFrame(frame); obs.disconnect() }
  }, [])

  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages, thinking])

  useEffect(() => {
    if (surface === 'none') return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [surface])

  if (!mounted) return (
    <nav aria-hidden style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 50, opacity: 0, pointerEvents: 'none' }} />
  )

  const isActive = (href: string) => {
    if (!pathname) return false
    return href === '/' ? pathname === '/' : pathname.startsWith(href)
  }

  const enter = (index: number) => {
    const node = itemRefs.current[index]
    if (!node) return
    if (hovered !== null && hovered !== index) setDir(index > hovered ? 1 : -1)
    setAnchorX(node.offsetLeft + node.offsetWidth / 2)
    setHovered(index); setTip(index)
  }
  const move = (index: number) => { if (hovered !== index) enter(index) }

  const close = () => {
    setSurface('none'); setThinking(false)
    clearTimeout(replyTimer.current); setMessages([]); setDraft('')
  }

  const send = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || thinking) return
    setDraft('')
    const userId = messages.length, aiId = userId + 1
    setMessages(prev => [...prev, { id: userId, role: 'user', text: trimmed }])
    setThinking(true)
    fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: trimmed, clientId }) })
      .then(r => r.json())
      .then(data => {
        setThinking(false)
        setMessages(prev => [...prev, { id: aiId, role: 'ai', text: data.answer || MOCK_REPLIES[Math.floor(Math.random() * MOCK_REPLIES.length)], sessions: data.sessions }])
      })
      .catch(() => {
        setThinking(false)
        setMessages(prev => [...prev, { id: aiId, role: 'ai', text: MOCK_REPLIES[prev.filter(m => m.role === 'user').length % MOCK_REPLIES.length] }])
      })
  }

  const showTooltip = hovered !== null && surface === 'none'
  const tipLabel = ALL_TOOLTIP_LABELS[tip] ?? ''

  return (
    <nav aria-label="Primary navigation" className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
      <div className="pointer-events-auto relative">

        {/* Tooltip pill */}
        <motion.div
          animate={showTooltip ? { left: anchorX, x: '-50%', opacity: 1, scale: 1, y: 0 } : { left: anchorX, x: '-50%', opacity: 0, scale: 0.9, y: 4 }}
          aria-hidden={!showTooltip} className="pointer-events-none absolute bottom-full mb-2"
          initial={false} role="tooltip" transition={showTooltip ? SPRING : { duration: 0.12 }}
        >
          <motion.div className="overflow-hidden rounded-[12px] bg-white/90 shadow-[0_1px_1px_rgba(0,0,0,0.05),0_8px_24px_rgba(0,0,0,0.1)] ring-1 ring-black/5" layout style={{ borderRadius: 12 }} transition={SPRING}>
            <AnimatePresence custom={dir} initial={false} mode="popLayout">
              <motion.span animate="center" className="block whitespace-nowrap px-3 py-[7px] text-[13px] font-medium text-[var(--text-primary)]" custom={dir} exit="exit" initial="enter" key={tipLabel} transition={SPRING} variants={labelVariants}>
                {tipLabel}
              </motion.span>
            </AnimatePresence>
          </motion.div>
        </motion.div>

        {/* Glass bar */}
        <motion.div
          className="relative box-content flex flex-col justify-end overflow-hidden rounded-3xl border border-black/5 bg-white/60 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.04)]"
          onMouseLeave={() => setHovered(null)}
          style={box ? { width: widthSpring, height: heightSpring } : undefined}
        >
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-3xl opacity-60 mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")` }} />

          <div className="w-fit" ref={measureRef}>
            <AnimatePresence initial={false}>

              {/* Chat transcript */}
              {surface === 'chat' && (messages.length > 0 || thinking) && (
                <motion.div animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} initial={{ opacity: 0 }} key="transcript" transition={{ duration: 0.18 }}>
                  <div className="flex max-h-64 w-[360px] flex-col gap-2 overflow-y-auto p-3 pb-2" ref={scrollRef}>
                    {messages.map(msg => (
                      <motion.div animate={{ opacity: 1, y: 0, scale: 1 }} className={`max-w-[85%] whitespace-pre-wrap text-[13px] leading-5 ${msg.role === 'user' ? 'self-end rounded-2xl rounded-br-md bg-orange-500 px-3 py-1.5 text-white' : 'self-start rounded-2xl rounded-bl-md bg-white/10 px-3 py-1.5 text-white/90'}`} initial={{ opacity: 0, y: 8, scale: 0.96 }} key={msg.id} transition={SPRING}>
                        {msg.text}
                        {msg.sessions && msg.sessions.length > 0 && (
                          <div className="mt-2 flex flex-col gap-1.5">
                            {msg.sessions.map(s => (
                              <Link key={s.id} href={`/sessions/${s.id}`}>
                                <div className="flex items-center justify-between rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-medium hover:bg-white/20 transition-colors">
                                  <div className="flex items-center gap-1.5"><PiVideoConferenceBold size={11} />Session {s.id.slice(0, 8)}…</div>
                                  {s.rage_click_count > 0 && <div className="flex items-center gap-1 text-red-400"><PiCursorClickBold size={11} />{s.rage_click_count}</div>}
                                </div>
                              </Link>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    ))}
                    {thinking && (
                      <motion.span animate={{ opacity: 1, y: 0 }} className="flex items-center gap-1 self-start rounded-2xl rounded-bl-md bg-white/10 px-3 py-2.5" initial={{ opacity: 0, y: 8 }} key="thinking">
                        {[0, 1, 2].map(dot => <motion.span animate={{ opacity: [0.25, 1, 0.25] }} className="size-1.5 rounded-full bg-white/70" key={dot} transition={{ duration: 1, repeat: Infinity, delay: dot * 0.18 }} />)}
                      </motion.span>
                    )}
                  </div>
                  <div className="mx-3 h-px bg-white/[0.08]" />
                </motion.div>
              )}

              {/* Chat suggestions */}
              {surface === 'chat' && messages.length === 0 && !thinking && (
                <motion.div animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} initial={{ opacity: 0 }} key="suggestions" transition={{ duration: 0.18 }}>
                  <div className="flex w-[360px] flex-col gap-1.5 p-3 pb-2">
                    {SUGGESTED.map(q => <button key={q} onClick={() => send(q)} className="w-full rounded-xl bg-white/8 px-3 py-2 text-left text-[12px] text-white/60 transition-colors hover:bg-white/15 hover:text-white/90">{q}</button>)}
                  </div>
                  <div className="mx-3 h-px bg-white/[0.08]" />
                </motion.div>
              )}

              {/* ··· overflow panel */}
              {surface === 'menu' && (
                <motion.div animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} initial={{ opacity: 0 }} key="overflow-panel" transition={{ duration: 0.18 }}>
                  <div className="w-[280px] p-2 pb-1">
                    <p className="px-2 pb-1.5 pt-0.5 text-[10px] font-bold uppercase tracking-wider text-black/30">More</p>
                    <div className="grid grid-cols-2 gap-1">
                      {OVERFLOW_ITEMS.map(item => {
                        const Icon = item.icon
                        const active = isActive(item.href)
                        return (
                          <Link key={item.href} href={item.href} onClick={close} className={`relative flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium outline-none transition-colors ${active ? 'bg-black/8 text-[var(--text-primary)]' : 'text-black/55 hover:bg-black/5 hover:text-black/80'}`}>
                            <Icon size={15} />
                            {item.label}
                            {item.badge != null && item.badge > 0 && <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-orange-500 px-1 text-[9px] font-black text-white">{item.badge > 99 ? '99+' : item.badge}</span>}
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                  <div className="mx-2 h-px bg-black/[0.06]" />
                </motion.div>
              )}

            </AnimatePresence>

            {/* Main icon row */}
            <div className="flex items-center gap-1 p-1.5">
              <AnimatePresence custom={surface === 'none' ? -1 : 1} initial={false} mode="popLayout">

                {surface === 'none' && (
                  <motion.div animate="center" className="flex items-center gap-1" custom={-1} exit="exit" initial="enter" key="tabs" transition={SPRING} variants={rowVariants} onMouseMove={(e) => mouseX.set(e.pageX)} onMouseLeave={() => mouseX.set(Infinity)}>
                    {PRIMARY_TABS.map((tab, index) => {
                      const active = isActive(tab.href)
                      const Icon = tab.icon
                      return (
                        <Link key={tab.href} href={tab.href} ref={node => { itemRefs.current[index] = node }} aria-current={active ? 'page' : undefined} aria-label={tab.label} className="outline-none">
                          <DockItem mouseX={mouseX} onMouseEnter={() => enter(index)} onMouseMove={() => move(index)} onBlur={() => setHovered(null)} onFocus={(e: any) => { if (e.currentTarget.matches(':focus-visible')) enter(index) }} className={`active:scale-95 ${active ? 'bg-black/5 text-[var(--text-primary)]' : 'text-black/40 hover:bg-black/5 hover:text-black/70'}`}>
                            <Icon size={19} />
                            {tab.badge != null && tab.badge > 0 && (
                              <motion.span animate={{ scale: 1 }} className="absolute -right-2 -top-2 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-orange-500 px-0.5 text-[9px] font-black text-white ring-2 ring-white" initial={{ scale: 0 }} transition={SPRING}>
                                {tab.badge > 99 ? '99+' : tab.badge}
                              </motion.span>
                            )}
                          </DockItem>
                        </Link>
                      )
                    })}

                    <span aria-hidden="true" className="mx-1 h-4 w-px bg-black/10" />

                    {/* Ask AI */}
                    <button ref={node => { itemRefs.current[CHAT_INDEX] = node }} aria-label="Ask AI" onClick={() => setSurface('chat')} className="outline-none">
                      <DockItem mouseX={mouseX} onMouseEnter={() => enter(CHAT_INDEX)} onMouseMove={() => move(CHAT_INDEX)} onBlur={() => setHovered(null)} className="active:scale-95 text-black/40 hover:bg-black/5 hover:text-black/70">
                        <PiSparkleBold size={19} />
                      </DockItem>
                    </button>

                    {/* ··· More */}
                    <button ref={node => { itemRefs.current[MORE_INDEX] = node }} aria-label="More" onClick={() => setSurface(s => s === 'menu' ? 'none' : 'menu')} className="outline-none">
                      <DockItem mouseX={mouseX} onMouseEnter={() => enter(MORE_INDEX)} onMouseMove={() => move(MORE_INDEX)} onBlur={() => setHovered(null)} className={`active:scale-95 ${surface === 'none' ? 'bg-black/8 text-[var(--text-primary)]' : 'text-black/40 hover:bg-black/5 hover:text-black/70'}`}>
                        <PiDotsThreeBold size={19} />
                      </DockItem>
                    </button>
                  </motion.div>
                )}

                {surface === 'chat' && (
                  <motion.div animate="center" className="flex items-center gap-2 px-1" custom={1} exit="exit" initial="enter" key="chat" transition={SPRING} variants={rowVariants}>
                    <button aria-label="Back" onClick={close} className="flex items-center rounded-full p-[9px] text-black/40 outline-none transition-colors hover:bg-black/5 hover:text-black/80 focus-visible:ring-2 focus-visible:ring-black/10">
                      <PiArrowLeftBold size={17} />
                    </button>
                    <div className="flex items-center gap-2 rounded-2xl bg-black/5 px-3 py-2">
                      <PiSparkleBold size={14} className="shrink-0 text-orange-400" />
                      <input autoFocus value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(draft) } }} placeholder="Ask about your users…" className="w-[220px] bg-transparent text-[13px] text-[var(--text-primary)] outline-none placeholder:text-black/35" />
                    </div>
                    <button aria-label="Send" disabled={!draft.trim() || thinking} onClick={() => send(draft)} className={`flex items-center rounded-full p-[9px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-black/10 ${draft.trim() && !thinking ? 'bg-orange-500 text-white hover:bg-orange-400 active:scale-95' : 'cursor-not-allowed text-black/20'}`}>
                      <PiPaperPlaneTiltBold size={17} />
                    </button>
                    <button aria-label="Close chat" onClick={close} className="flex items-center rounded-full p-[9px] text-black/40 outline-none transition-colors hover:bg-black/5 hover:text-black/80 focus-visible:ring-2 focus-visible:ring-black/10">
                      <PiXBold size={15} />
                    </button>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
    </nav>
  )
}
