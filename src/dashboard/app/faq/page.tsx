import { MarketingNav } from '@/components/MarketingNav'
import { MarketingFooter } from '@/components/MarketingFooter'
import { Plug, Database, Cpu, Shield, LineChart, CreditCard, XSquare, FileJson } from 'lucide-react'
import '../home/homepage.css'

export const metadata = {
  title: 'FAQ — UserSessions.io',
  description: 'Everything you need to know about how UserSessions.io works: AI analysis, integrations, security, and pricing.',
}

const FAQS: { q: string; a: string; icon: React.ReactNode }[] = [
  {
    icon: <Plug className="w-6 h-6 text-[var(--ember)]" />,
    q: 'What session recording tools do you support?',
    a: 'We integrate natively with FullStory, PostHog, and Datadog RUM. No new SDK required — we connect directly via their APIs.',
  },
  {
    icon: <Database className="w-6 h-6 text-[var(--ember)]" />,
    q: 'Do I need to migrate my data?',
    a: 'No. We read directly from your existing session provider via their API. We only pull sessions that match the AI friction heuristics we define together.',
  },
  {
    icon: <Cpu className="w-6 h-6 text-[var(--ember)]" />,
    q: 'How does the AI decide when to act?',
    a: "It doesn't guess. We map your specific failure states — like cart abandonment, rage clicks on checkout, or console errors — to deterministic actions in Slack, Jira, or Salesforce. You define the rules, the AI executes them.",
  },
  {
    icon: <Shield className="w-6 h-6 text-[var(--ember)]" />,
    q: 'Is my session data secure?',
    a: 'Yes. We never store raw session video. We process the metadata and DOM state in memory to extract the failure context, trigger the action, and discard the raw feed. Everything is encrypted at rest and in transit.',
  },
  {
    icon: <LineChart className="w-6 h-6 text-[var(--ember)]" />,
    q: 'How are you different from standard error tracking?',
    a: 'Error trackers tell you a button broke. We watch the session, determine the revenue impact, open a Jira ticket with the reproduction steps, and alert the on-call engineer in Slack.',
  },
  {
    icon: <CreditCard className="w-6 h-6 text-[var(--ember)]" />,
    q: 'How does billing work?',
    a: 'Only successfully executed actions are billed. A dismissed finding, an edited-and-rejected action, or an API failure never appears on your invoice.',
  },
  {
    icon: <XSquare className="w-6 h-6 text-[var(--ember)]" />,
    q: 'How do I cancel?',
    a: 'Go to Settings → Plan & billing → Cancel subscription. Auto-renew turns off immediately, and your plan stays active until the end of the current billing period.',
  },
  {
    icon: <FileJson className="w-6 h-6 text-[var(--ember)]" />,
    q: 'Can I export or delete my data?',
    a: 'Yes. Settings → Danger zone gives you a one-click JSON export of your profile and history, and an option for permanent account deletion.',
  },
]

export default function FaqPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  return (
    <div className="hp">
      <div className="premium-bg" />
      <MarketingNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      <main style={{ position: 'relative', zIndex: 10, paddingTop: 140, paddingBottom: 120 }}>
        {/* Hero */}
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
            Support
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
            Frequently asked questions
          </h1>
          <p style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '1.1rem',
            color: 'var(--ink-muted)',
            lineHeight: 1.6,
            fontWeight: 500,
            maxWidth: 520,
            margin: '0 auto',
          }}>
            Everything you need to know about UserSessions.io. Can&apos;t find what you&apos;re looking for? Email us at{' '}
            <a href="mailto:info@usersessions.io" style={{ color: 'var(--ember)', textDecoration: 'none', fontWeight: 600 }}>
              info@usersessions.io
            </a>
          </p>
        </div>

        {/* FAQ cards */}
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {FAQS.map((f) => (
            <div
              key={f.q}
              className="faq-card"
              style={{
                background: 'rgba(255,255,255,0.72)',
                backdropFilter: 'blur(20px) saturate(160%)',
                WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                border: '1px solid rgba(0,0,0,0.05)',
                borderBottom: '1px solid rgba(0,0,0,0.09)',
                borderRadius: 20,
                padding: '32px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.9)',
                transition: 'transform 0.25s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ flexShrink: 0, marginTop: 2 }}>
                  {f.icon}
                </div>
                <div>
                  <h2 style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '1.05rem',
                    fontWeight: 800,
                    color: 'var(--ink)',
                    marginBottom: 10,
                    letterSpacing: '-0.01em',
                  }}>
                    {f.q}
                  </h2>
                  <p style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '0.97rem',
                    color: 'var(--ink-muted)',
                    lineHeight: 1.75,
                    fontWeight: 500,
                    margin: 0,
                  }}>
                    {f.a}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
      <MarketingFooter />
    </div>
  )
}
