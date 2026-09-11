'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from "motion/react"
import { CompetitiveTable } from '@/components/CompetitiveTable'
import '../home/homepage.css'

const EASE_OUT = [0.16, 1, 0.3, 1] as [number, number, number, number]

export default function ComparePage() {
  return (
    <div className="hp-page" style={{ background: 'var(--bg-primary)' }}>

      {/* ── Navigation ── */}
      <motion.nav
        className="hp-nav"
        data-scrolled="true"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE_OUT }}
      >
        <Link href="/" className="hp-nav-logo">
          <div className="hp-nav-logo-mark" />
          <span className="hp-nav-logo-text">usersessions</span>
        </Link>

        <div className="hp-nav-links">
          <Link href="/#features" className="hp-nav-link">Platform</Link>
          <Link href="/pricing" className="hp-nav-link">Pricing</Link>
          <Link href="/compare" className="hp-nav-link" style={{ color: 'var(--ink)' }}>Compare</Link>
          <Link href="/login" className="hp-nav-link hp-nav-link--muted">Sign In</Link>
        </div>

        <div className="hp-nav-actions">
          <Link href="/login" className="btn btn--primary btn-spring" style={{ fontSize: 14 }}>
            Start Free
          </Link>
        </div>
      </motion.nav>

      {/* ── Hero ── */}
      <section style={{
        paddingTop: 140,
        paddingBottom: 80,
        paddingLeft: 32,
        paddingRight: 32,
        textAlign: 'center',
        maxWidth: 800,
        margin: '0 auto',
      }}>
        <motion.p
          className="hp-section-label"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE_OUT }}
        >
          Due Diligence
        </motion.p>
        <motion.h1
          className="hp-headline"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05, ease: EASE_OUT }}
          style={{ fontSize: 'clamp(36px, 5vw, 60px)', marginBottom: 24, color: 'var(--ink)' }}
        >
          How we stack up.
        </motion.h1>
        <motion.p
          className="hp-sub"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: EASE_OUT }}
          style={{ maxWidth: 600, margin: '0 auto', color: 'var(--ink-soft)' }}
        >
          A feature-by-feature breakdown of usersessions vs. the tools you're already paying for — or thinking about.
        </motion.p>
      </section>

      {/* ── Table ── */}
      <motion.section
        style={{ padding: '0 24px 120px', maxWidth: 1200, margin: '0 auto' }}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.18, ease: EASE_OUT }}
      >
        <CompetitiveTable />
      </motion.section>

      {/* ── CTA footer ── */}
      <section style={{
        borderTop: '1px solid var(--line)',
        padding: '80px 32px',
        textAlign: 'center',
        background: 'var(--bg-raised)',
      }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: EASE_OUT }}
        >
          <h2 style={{
            fontFamily: 'Syne, sans-serif',
            fontWeight: 800,
            fontSize: 'clamp(28px, 3vw, 40px)',
            letterSpacing: '-0.04em',
            marginBottom: 16,
            color: 'var(--ink)',
          }}>
            Ready to skip the replays?
          </h2>
          <p style={{ fontSize: 17, color: 'var(--ink-soft)', marginBottom: 36, maxWidth: 460, margin: '0 auto 36px' }}>
            Get the fix drafted before you've finished your morning coffee.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/login" className="btn btn--ember btn-spring">
              Start free — no credit card
            </Link>
            <Link href="/" className="btn btn--outline btn-spring">
              ← Back to home
            </Link>
          </div>
        </motion.div>
      </section>

    </div>
  )
}
