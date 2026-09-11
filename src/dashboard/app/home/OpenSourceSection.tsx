'use client'

import React, { useState } from 'react'
import { ClaudeCode, Cursor, Codex, OpenAI, Kimi, Github } from '@lobehub/icons'

// ── Real @lobehub/icons brand components ─────────────────────
// Available: ClaudeCode, Cursor, Codex, OpenAI, Kimi, Github
// All icons are official brand SVGs — no custom shapes

// Available variants: .Color (full brand color), base (mono/black)
// Cursor, Codex, OpenAI are mono-only brands — black on tinted bg
// ClaudeCode and Kimi have official color variants
const AI_TOOLS = [
  {
    render: () => <ClaudeCode.Color size={20} />,
    label: 'Claude Code',
    bg: 'rgba(217,119,87,0.08)',
  },
  {
    render: () => <Cursor size={20} />,
    label: 'Cursor',
    bg: 'rgba(0,0,0,0.05)',
  },
  {
    render: () => <Codex size={20} />,
    label: 'Codex',
    bg: 'rgba(0,0,0,0.05)',
  },
  {
    render: () => <OpenAI size={20} />,
    label: 'OpenAI',
    bg: 'rgba(0,0,0,0.05)',
  },
  {
    render: () => <Kimi.Color size={20} />,
    label: 'Kimi Code',
    bg: 'rgba(124,58,237,0.08)',
  },
]

export function OpenSourceSection() {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText('npx @usersessions/cli connect')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="oss-section" id="oss">
      {/* Adds color behind the cards so the glass blur has something to refract */}
      <div className="oss-ambient-glow" aria-hidden="true" />
      <div className="wrap">
        <div className="oss-grid">

          {/* Column 1: AI Integration */}
          <div className="oss-card glass-panel">
            <div className="oss-card-icon-row">
              {AI_TOOLS.map(({ render, label, bg }) => (
                <div
                  key={label}
                  className="ai-icon-badge"
                  title={label}
                  style={{ background: bg }}
                >
                  {render()}
                </div>
              ))}
            </div>

            <h3>Connect your AI directly</h3>
            <p className="oss-desc">
              Use the MCP server to connect UserSessions directly to Claude Code, Cursor, Codex, or any MCP-compatible agent. Your agent can read findings and execute fixes automatically.
            </p>

            <div className="copy-box" onClick={handleCopy} role="button" tabIndex={0}>
              <div className="copy-code">
                <span className="npx">npx</span> @usersessions/cli connect
              </div>
              <button className="copy-btn" aria-label="Copy command">
                {copied ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Column 2: Open Source */}
          <div className="oss-card glass-panel">
            <div className="oss-card-icon-row">
              <div className="ai-icon-badge github-badge" title="GitHub">
                <Github size={20} />
              </div>
            </div>

            <h3>Open Source</h3>
            <p className="oss-desc">
              UserSessions.io is open source: run it on your own infrastructure with your own keys, or let us run it for you in the cloud. Same software, same dashboard, your call on where the data lives.
            </p>

            <a href="https://github.com/usersessions/usersessions" target="_blank" rel="noopener noreferrer" className="oss-btn">
              View on GitHub
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="M12 5l7 7-7 7" />
              </svg>
            </a>
          </div>

        </div>
      </div>
    </section>
  )
}
