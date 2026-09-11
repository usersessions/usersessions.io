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

type Tab = 'claude' | 'cursor' | 'other'

const TABS: { id: Tab; label: string }[] = [
  { id: 'claude', label: 'Claude Code' },
  { id: 'cursor', label: 'Cursor / Windsurf' },
  { id: 'other',  label: 'Any MCP agent' },
]

const COMMANDS: Record<Tab, { display: string; copy: string }> = {
  claude: {
    display: 'claude mcp add usersessions sse https://mcp.usersessions.io/sse \\\n  --header "Authorization: Bearer <your-api-key>"',
    copy:    'claude mcp add usersessions sse https://mcp.usersessions.io/sse --header "Authorization: Bearer <your-api-key>"',
  },
  cursor: {
    display: `// .cursor/mcp.json\n{\n  "mcpServers": {\n    "usersessions": {\n      "url": "https://mcp.usersessions.io/sse",\n      "headers": { "Authorization": "Bearer <your-api-key>" }\n    }\n  }\n}`,
    copy: JSON.stringify({
      mcpServers: {
        usersessions: {
          url: 'https://mcp.usersessions.io/sse',
          headers: { Authorization: 'Bearer <your-api-key>' },
        },
      },
    }, null, 2),
  },
  other: {
    display: 'SSE endpoint: https://mcp.usersessions.io/sse\nAuth header:  Authorization: Bearer <your-api-key>',
    copy: 'https://mcp.usersessions.io/sse',
  },
}

export function OpenSourceSection() {
  const [activeTab, setActiveTab] = useState<Tab>('claude')
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(COMMANDS[activeTab].copy)
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

            {/* ── Tabbed copy box ──────────────────────────────── */}
            <div className="mcp-box">
              {/* Tab bar */}
              <div className="mcp-tabs">
                {TABS.map(t => (
                  <button
                    key={t.id}
                    className={`mcp-tab${activeTab === t.id ? ' mcp-tab--active' : ''}`}
                    onClick={() => { setActiveTab(t.id); setCopied(false) }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Code body + copy button */}
              <div className="mcp-body">
                <pre className="mcp-code">{COMMANDS[activeTab].display}</pre>
                <button
                  className="copy-btn mcp-copy-btn"
                  aria-label="Copy"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <p className="mcp-hint">
              Get your API key from <strong>Settings → MCP Server Access</strong> after signing in.
            </p>
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

            <a href="https://github.com/usersessions/usersessions.io" target="_blank" rel="noopener noreferrer" className="oss-btn">
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
