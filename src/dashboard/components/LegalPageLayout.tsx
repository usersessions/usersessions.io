import React from 'react'
import { MarketingNav } from './MarketingNav'
import { MarketingFooter } from './MarketingFooter'
import '../app/home/homepage.css'

interface LegalSection {
  title: string
  body: string[]
}

interface Props {
  title: string
  effective: string
  description: string
  sections: LegalSection[]
}

export function LegalPageLayout({ title, effective, description, sections }: Props) {
  return (
    <div className="hp">
      <div className="premium-bg" />
      <MarketingNav />
      <main style={{
        position: 'relative',
        zIndex: 10,
        paddingTop: 140,
        paddingBottom: 120,
      }}>
        {/* Page hero */}
        <div style={{ textAlign: 'center', marginBottom: 80, padding: '0 24px' }}>
          <p style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--ember)',
            marginBottom: 16,
          }}>
            {effective}
          </p>
          <h1 style={{
            fontFamily: 'var(--display)',
            fontSize: 'clamp(32px, 5vw, 56px)',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
            color: 'var(--ink)',
            marginBottom: 16,
          }}>
            {title}
          </h1>
          <p style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '1.1rem',
            color: 'var(--ink-muted)',
            lineHeight: 1.6,
            fontWeight: 500,
            maxWidth: 560,
            margin: '0 auto',
          }}>
            {description}
          </p>
        </div>

        {/* Content card */}
        <div style={{
          maxWidth: 760,
          margin: '0 auto',
          padding: '0 24px',
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.72)',
            backdropFilter: 'blur(20px) saturate(160%)',
            WebkitBackdropFilter: 'blur(20px) saturate(160%)',
            border: '1px solid rgba(0,0,0,0.05)',
            borderBottom: '1px solid rgba(0,0,0,0.09)',
            borderRadius: 24,
            padding: 'clamp(32px, 5vw, 64px)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.9)',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 56 }}>
              {sections.map((s) => (
                <section key={s.title}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 20,
                    marginBottom: 20,
                  }}>
                    <div style={{
                      width: 4,
                      height: 32,
                      borderRadius: 4,
                      background: 'linear-gradient(to bottom, var(--ember), #ff8c40)',
                      flexShrink: 0,
                      marginTop: 4,
                    }} />
                    <h2 style={{
                      fontFamily: 'var(--display)',
                      fontSize: '1.35rem',
                      fontStyle: 'normal',
                      color: 'var(--ink)',
                      fontWeight: 700,
                      letterSpacing: '-0.015em',
                      lineHeight: 1.25,
                    }}>
                      {s.title}
                    </h2>
                  </div>
                  {s.body.map((p, i) => (
                    <p key={i} style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '1rem',
                      color: 'var(--ink-muted)',
                      lineHeight: 1.75,
                      marginBottom: 14,
                      fontWeight: 500,
                      paddingLeft: 24,
                    }}>
                      {p}
                    </p>
                  ))}
                </section>
              ))}
            </div>
          </div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  )
}
