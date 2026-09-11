'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from "motion/react"
import {
  PiRadioBold,
  PiCursorClickBold,
  PiVideoConferenceBold,
  PiGlobeBold,
  PiDeviceMobileBold,
  PiDesktopBold,
  PiEyeBold,
} from 'react-icons/pi'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface LiveVisitor {
  id: string
  created_at: string
  source: string | null
  rage_click_count: number
  source_session_id: string | null
}

interface RealtimeVisitorPanelProps {
  clientId: string | null
}

// Simple random name + avatar from a session ID hash
function anonName(id: string): string {
  const ADJECTIVES = ['Swift', 'Quiet', 'Bold', 'Calm', 'Bright', 'Keen', 'Sharp', 'Cool']
  const ANIMALS = ['Panda', 'Fox', 'Owl', 'Wolf', 'Bear', 'Hawk', 'Lynx', 'Deer']
  const hash = id.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) & 0xffff, 0)
  return `${ADJECTIVES[hash % ADJECTIVES.length]} ${ANIMALS[(hash >> 5) % ANIMALS.length]}`
}

function anonColor(id: string): string {
  const COLORS = ['#f97316', '#3b82f6', '#8b5cf6', '#22c55e', '#ec4899', '#06b6d4']
  const hash = id.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) & 0xffff, 0)
  return COLORS[hash % COLORS.length]
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 10) return 'just now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

export function RealtimeVisitorPanel({ clientId }: RealtimeVisitorPanelProps) {
  const [visitors, setVisitors] = useState<LiveVisitor[]>([])
  const [loading, setLoading] = useState(true)
  const [onlineCount, setOnlineCount] = useState(0)

  const fetchVisitors = useCallback(async () => {
    if (!clientId) { setLoading(false); return }
    const supabase = createClient()
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    const { data, count } = await supabase
      .from('us_sessions')
      .select('id, created_at, source, rage_click_count, source_session_id', { count: 'exact' })
      .eq('client_id', clientId)
      .gte('created_at', fiveMinsAgo)
      .order('created_at', { ascending: false })
      .limit(20)

    if (data) setVisitors(data)
    if (count !== null) setOnlineCount(count)
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    fetchVisitors()
    const interval = setInterval(fetchVisitors, 15000)

    // Realtime subscription
    if (!clientId) return
    const supabase = createClient()
    const channel = supabase
      .channel('realtime:visitors')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'us_sessions', filter: `client_id=eq.${clientId}` },
        (payload) => {
          setVisitors(prev => [payload.new as LiveVisitor, ...prev].slice(0, 20))
          setOnlineCount(prev => prev + 1)
        }
      )
      .subscribe()

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [clientId, fetchVisitors])

  if (!clientId) return null

  return (
    <div style={{
      borderRadius: 20, overflow: 'hidden',
      background: 'var(--bg-card, #fff)',
      border: '1px solid var(--border, rgba(0,0,0,0.08))',
      boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
    }}>
      {/* Header */}
      <div style={{
        padding: '18px 22px',
        borderBottom: '1px solid var(--border, rgba(0,0,0,0.06))',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <motion.div
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              style={{
                width: 8, height: 8, borderRadius: '50%',
                background: onlineCount > 0 ? '#22c55e' : '#94a3b8',
              }}
            />
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>Live Now</span>
          </div>
          {onlineCount > 0 && (
            <div style={{
              fontSize: 11, fontWeight: 800, color: '#22c55e',
              background: 'rgba(34,197,94,0.1)',
              padding: '2px 8px', borderRadius: 99, letterSpacing: '0.02em',
            }}>
              {onlineCount} active
            </div>
          )}
        </div>
        <PiRadioBold size={16} style={{ color: 'var(--text-muted)' }} />
      </div>

      {/* Visitor list */}
      <div style={{ maxHeight: 320, overflowY: 'auto' }}>
        {loading && (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                height: 52, borderRadius: 10,
                background: 'linear-gradient(90deg, var(--surface,rgba(0,0,0,0.04)) 25%, var(--border,rgba(0,0,0,0.06)) 50%, var(--surface,rgba(0,0,0,0.04)) 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
              }} />
            ))}
          </div>
        )}

        {!loading && visitors.length === 0 && (
          <div style={{ padding: '32px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--surface, rgba(0,0,0,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PiEyeBold size={22} style={{ color: 'var(--text-muted)' }} />
            </div>
            <p style={{ margin: '0 0 4px 0', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              No one active right now
            </p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              Visitors from the past 5 minutes appear here in real time.
            </p>
          </div>
        )}

        <AnimatePresence>
          {visitors.map((visitor) => (
            <motion.div
              key={visitor.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 22px',
                borderBottom: '1px solid var(--border, rgba(0,0,0,0.04))',
                gap: 12,
              }}
            >
              {/* Avatar + name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                  background: anonColor(visitor.id),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 800, color: '#fff',
                  letterSpacing: '-0.01em',
                }}>
                  {anonName(visitor.id).charAt(0)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                    {anonName(visitor.id)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
                    {timeAgo(visitor.created_at)}
                  </div>
                </div>
              </div>

              {/* Right side */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {visitor.rage_click_count > 0 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 11, fontWeight: 700, color: '#ef4444',
                    background: 'rgba(239,68,68,0.08)',
                    padding: '3px 7px', borderRadius: 6,
                  }}>
                    <PiCursorClickBold size={10} />
                    {visitor.rage_click_count}
                  </div>
                )}

                <Link href={`/sessions/${visitor.id}`} style={{ textDecoration: 'none' }}>
                  <motion.div
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                      background: 'var(--surface, rgba(0,0,0,0.04))',
                      padding: '5px 9px', borderRadius: 7,
                      cursor: 'pointer', transition: 'all 0.15s',
                      border: '1px solid transparent',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(249,115,22,0.3)'
                      e.currentTarget.style.color = '#f97316'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'transparent'
                      e.currentTarget.style.color = 'var(--text-muted)'
                    }}
                  >
                    <PiVideoConferenceBold size={11} />
                    Watch
                  </motion.div>
                </Link>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
