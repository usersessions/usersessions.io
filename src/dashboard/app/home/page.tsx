'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { InteractiveDemo } from './InteractiveDemo'
import { PremiumEffects } from './PremiumEffects'
import { CustomCursor } from './CustomCursor'
import { HeroParallax } from './HeroParallax'
import { OpenSourceSection } from './OpenSourceSection'
import { FaqAccordion } from '../../components/FaqAccordion'
import { PricingClientWrapper } from '../pricing/PricingClientWrapper'
import { CALCULATOR_TIERS } from '@/lib/documents/types'
import { MarketingNav } from '../../components/MarketingNav'
import './homepage.css'

export default function HomePage() {
  const [demoOpen, setDemoOpen] = useState(false)

  // Lock/unlock body scroll when fullscreen demo is open
  useEffect(() => {
    if (demoOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [demoOpen])

  function openDemo(e: React.MouseEvent) {
    e.preventDefault()
    setDemoOpen(true)
  }

  function closeDemo() {
    setDemoOpen(false)
  }

  return (
    <div className={`hp${demoOpen ? ' demo-is-open' : ''}`}>
      <div className="premium-bg" />
      <CustomCursor />
      <PremiumEffects />

      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <MarketingNav />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <header className="hero" id="demo">
        <HeroParallax
          demo={
            <div className="demo-container">
              <InteractiveDemo />
            </div>
          }
        >
          <p className="hero-sub">
            Understand exactly how customers interact with your platform. Usersessions.io maps the customer journey, identifies pain points, and uses AI to fix them automatically.
          </p>
          <div className="hero-cta-row">
            <a className="btn btn--ember" href="#demo" onClick={openDemo}>
              Try the interactive demo ↓
            </a>
          </div>
        </HeroParallax>
      </header>

      {/* ── Fullscreen Demo Overlay ──────────────────────────────────── */}
      {demoOpen && (
        <div className="demo-overlay" role="dialog" aria-modal="true" aria-label="Interactive demo">
          <div className="demo-overlay-header">
            <div className="demo-overlay-logo">
              <span className="nav-mark">usersessions<span>.io</span></span>
              <span className="demo-overlay-badge">Interactive demo</span>
            </div>
            <button
              className="demo-overlay-close"
              onClick={closeDemo}
              aria-label="Close demo"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M2 2l14 14M16 2L2 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span>Exit demo</span>
            </button>
          </div>
          <div className="demo-overlay-body">
            <InteractiveDemo />
          </div>
        </div>
      )}

      {/* ── Plan ─────────────────────────────────────────────────────── */}
      <section className="plan" id="plan">
        <div className="wrap">
          <div className="section-head plan-head reveal-hidden">
            <p className="kicker">How it works</p>
            <h2>Four steps. In this order, every time.</h2>
          </div>
          <div className="plan-steps--row">
            {([
              { num: '01', title: 'Connect', body: 'Add one script to your site. Nothing else to install.' },
              { num: '02', title: 'Watch', body: 'It looks for real friction: errors, rage clicks, dead clicks, failed requests.' },
              { num: '03', title: 'Understand', body: 'You get a plain-English explanation of what happened and why it matters.' },
              { num: '04', title: 'Fix', body: 'Approve the fix once, or set a rule so it acts on its own next time.' },
            ] as const).map((step, i, arr) => (
              <React.Fragment key={step.num}>
                <div className="glass-panel plan-step plan-step--row reveal-hidden">
                  <div className="plan-num">{step.num}</div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
                {i < arr.length - 1 && (
                  <div className="plan-connector" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M4 10h12M12 5l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      <OpenSourceSection />

      {/* ── Pricing ──────────────────────────────────────────────────── */}
      <section className="pricing-section" id="pricing">
        <div className="wrap">
          <div className="section-head pricing-head reveal-hidden">
            <p className="kicker">Pricing</p>
            <h2>Simple, transparent pricing.</h2>
            <p className="section-sub">Free to start. Pay only for what gets fixed.</p>
          </div>
          <PricingClientWrapper
            tiers={[
              CALCULATOR_TIERS.starter,
              CALCULATOR_TIERS.pro,
              CALCULATOR_TIERS.business,
              CALCULATOR_TIERS.enterprise_license,
            ]}
          />
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section className="faq-section" id="faq">
        <div className="wrap">
          <div className="section-head faq-head reveal-hidden">
            <p className="kicker">Have questions?</p>
            <h2>Frequently Asked Questions</h2>
          </div>
          <FaqAccordion />
        </div>
      </section>

      {/* ── Integrations ─────────────────────────────────────────────── */}
      <section className="integrations-section" id="integrations">
        <div className="wrap">
          <div className="section-head integrations-head reveal-hidden">
            <p className="kicker">Integrations</p>
            <h2>Execute fixes and analyze sessions across your stack.</h2>
            <p className="section-sub">UserSessions integrates with your existing execution tools and analytics platforms.</p>
          </div>
        </div>
        <div className="marquee-container">
          <div className="marquee-track">
            {/* We duplicate the array to create the infinite scroll illusion */}
            {[...Array(2)].map((_, loopIdx) => (
              <React.Fragment key={loopIdx}>
                {[
                  'composio.svg', 'datadog.svg', 'fullstory.svg', 'googleanalytics.svg', 
                  'hotjar.svg', 'hubspot.svg', 'jira.svg', 'linear.svg', 
                  'logrocket.svg', 'pagerduty.svg', 'posthog.svg', 
                  'salesforce.svg', 'slack.svg'
                ].map((logo, idx) => (
                  <div key={`${loopIdx}-${idx}`} className="marquee-pill">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={`/logos/${logo}`} 
                      alt={logo.replace('.svg', '')} 
                      style={{ height: '24px', width: 'auto', objectFit: 'contain' }} 
                    />
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Band ─────────────────────────────────────────────────── */}
      <section className="cta-band" id="cta">
        <div className="cta-glow" />
        <div className="wrap">
          <h2>Try it on your own site.</h2>
          <p>Free to start. Open source if you&apos;d rather run it yourself.</p>
          <div className="btn-row">
            <Link className="btn btn--ember" href="/login">Start free trial</Link>
            <a
              className="btn btn--ghost"
              href="https://github.com/usersessions/usersessions"
              target="_blank"
              rel="noopener noreferrer"
            >
              See the code
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="site-footer">
        <div className="wrap">
          <div className="nav-mark">usersessions<span>.io</span></div>
          <ul className="footer-links">
            <li><a href="#demo">Live demo</a></li>
            <li><a href="#plan">How it works</a></li>
            <li><a href="#pricing">Pricing</a></li>
            <li><Link href="/compare">Full comparison</Link></li>
            <li><Link href="/privacy">Privacy</Link></li>
          </ul>
          <p className="footer-note">
            Assisted automation. A person is always in the loop for anything that matters.
          </p>
        </div>
      </footer>
    </div>
  )
}
