'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from "motion/react"
import {
  PiXBold,
  PiPaperPlaneTiltBold,
  PiSparkleBold,
  PiVideoConferenceBold,
  PiCursorClickBold,
} from 'react-icons/pi'
import Link from 'next/link'

interface Message {
  role: 'user' | 'assistant'
  content: string
  sessions?: { id: string; created_at: string; rage_click_count: number }[]
}

const SUGGESTED_QUESTIONS = [
  'Why are users rage-clicking the checkout button?',
  'Which page has the most friction last week?',
  'Show me sessions with the most errors',
  'What caused our bounce rate to spike?',
]

interface AIChatDrawerProps {
  isOpen: boolean
  onClose: () => void
  clientId: string | null
}

export function AIChatDrawer({ isOpen, onClose, clientId }: AIChatDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  async function sendMessage(text: string) {
    if (!text.trim() || isLoading) return
    const userMsg: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, clientId }),
      })

      if (!res.ok) throw new Error('Chat request failed')
      const data = await res.json()
      const assistantMsg: Message = {
        role: 'assistant',
        content: data.answer || 'Sorry, I couldn\'t generate a response. Please try again.',
        sessions: data.sessions,
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Something went wrong. Please check your connection and try again.',
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, zIndex: 70,
              background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)',
            }}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 350, damping: 35 }}
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0,
              width: 420, zIndex: 80, display: 'flex', flexDirection: 'column',
              background: 'var(--bg-app, #fafafa)',
              borderLeft: '1px solid var(--border, rgba(0,0,0,0.08))',
              boxShadow: '-24px 0 80px rgba(0,0,0,0.18)',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border, rgba(0,0,0,0.08))',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'linear-gradient(135deg, #f97316, #fb923c)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(249,115,22,0.3)',
                }}>
                  <PiSparkleBold size={18} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                    Ask Your Data
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
                    Powered by Gemini
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'var(--surface, rgba(0,0,0,0.05))',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                <PiXBold size={16} />
              </button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 0' }}>
              {messages.length === 0 && !isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
                >
                  <div style={{
                    padding: '16px 18px', borderRadius: 14,
                    background: 'linear-gradient(135deg, rgba(249,115,22,0.08), rgba(251,146,60,0.04))',
                    border: '1px solid rgba(249,115,22,0.12)',
                    marginBottom: 8,
                  }}>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                      Hi! I have access to your session replays, rage clicks, findings, and page analytics.
                      Ask me anything about your users&apos; behavior.
                    </p>
                  </div>

                  <p style={{ margin: '0 0 6px 0', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Suggested questions
                  </p>
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      style={{
                        textAlign: 'left', background: 'var(--bg-card, #fff)',
                        border: '1px solid var(--border, rgba(0,0,0,0.08))',
                        borderRadius: 10, padding: '10px 14px',
                        fontSize: 13, color: 'var(--text-secondary)',
                        cursor: 'pointer', transition: 'all 0.15s',
                        width: '100%',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(249,115,22,0.4)'
                        e.currentTarget.style.background = 'rgba(249,115,22,0.04)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border, rgba(0,0,0,0.08))'
                        e.currentTarget.style.background = 'var(--bg-card, #fff)'
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </motion.div>
              )}

              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    marginBottom: 16,
                    display: 'flex',
                    flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                    alignItems: 'flex-start',
                    gap: 10,
                  }}
                >
                  {msg.role === 'assistant' && (
                    <div style={{
                      width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                      background: 'linear-gradient(135deg, #f97316, #fb923c)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginTop: 2,
                    }}>
                      <PiSparkleBold size={13} color="#fff" />
                    </div>
                  )}
                  <div style={{ maxWidth: '80%' }}>
                    <div style={{
                      padding: '10px 14px', borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
                      background: msg.role === 'user'
                        ? 'linear-gradient(135deg, #f97316, #ea580c)'
                        : 'var(--bg-card, #fff)',
                      border: msg.role === 'assistant' ? '1px solid var(--border, rgba(0,0,0,0.08))' : 'none',
                      color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                      fontSize: 13.5, lineHeight: 1.65,
                      boxShadow: msg.role === 'user' ? '0 4px 14px rgba(249,115,22,0.3)' : '0 2px 8px rgba(0,0,0,0.05)',
                    }}>
                      {msg.content}
                    </div>

                    {/* Related sessions */}
                    {msg.sessions && msg.sessions.length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Related sessions
                        </p>
                        {msg.sessions.map((s) => (
                          <Link key={s.id} href={`/sessions/${s.id}`} style={{ textDecoration: 'none' }}>
                            <div style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '8px 12px', borderRadius: 8,
                              background: 'var(--bg-card, #fff)',
                              border: '1px solid var(--border, rgba(0,0,0,0.08))',
                              cursor: 'pointer', transition: 'border-color 0.15s',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(249,115,22,0.4)')}
                            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border, rgba(0,0,0,0.08))')}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <PiVideoConferenceBold size={13} style={{ color: 'var(--text-muted)' }} />
                                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                                  Session {s.id.slice(0, 8)}…
                                </span>
                              </div>
                              {s.rage_click_count > 0 && (
                                <div style={{
                                  display: 'flex', alignItems: 'center', gap: 4,
                                  fontSize: 11, fontWeight: 700, color: '#ef4444',
                                }}>
                                  <PiCursorClickBold size={11} />
                                  {s.rage_click_count}
                                </div>
                              )}
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: 'linear-gradient(135deg, #f97316, #fb923c)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <PiSparkleBold size={13} color="#fff" />
                  </div>
                  <div style={{
                    padding: '10px 16px', borderRadius: '4px 14px 14px 14px',
                    background: 'var(--bg-card, #fff)',
                    border: '1px solid var(--border, rgba(0,0,0,0.08))',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        animate={{ y: [0, -4, 0] }}
                        transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
                        style={{
                          display: 'inline-block', width: 6, height: 6,
                          borderRadius: '50%', background: 'var(--text-muted)',
                        }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{
              padding: '16px 20px',
              borderTop: '1px solid var(--border, rgba(0,0,0,0.08))',
              background: 'var(--bg-app, #fafafa)',
            }}>
              <div style={{
                display: 'flex', alignItems: 'flex-end', gap: 10,
                background: 'var(--bg-card, #fff)',
                border: '1px solid var(--border, rgba(0,0,0,0.1))',
                borderRadius: 14, padding: '10px 14px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your users…"
                  rows={1}
                  style={{
                    flex: 1, border: 'none', outline: 'none', resize: 'none',
                    background: 'transparent', fontSize: 13.5,
                    color: 'var(--text-primary)', fontFamily: 'inherit',
                    lineHeight: 1.5, maxHeight: 120, overflowY: 'auto',
                  }}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isLoading}
                  style={{
                    width: 34, height: 34, borderRadius: 9, border: 'none',
                    background: input.trim() && !isLoading
                      ? 'linear-gradient(135deg, #f97316, #ea580c)'
                      : 'var(--surface, rgba(0,0,0,0.06))',
                    color: input.trim() && !isLoading ? '#fff' : 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s', flexShrink: 0,
                    boxShadow: input.trim() && !isLoading ? '0 4px 12px rgba(249,115,22,0.3)' : 'none',
                  }}
                >
                  <PiPaperPlaneTiltBold size={16} />
                </button>
              </div>
              <p style={{ margin: '8px 0 0 0', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                Shift+Enter for new line · Enter to send
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
