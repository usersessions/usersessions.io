import type { Metadata } from 'next'
import { LegalPageLayout } from '@/components/LegalPageLayout'

export const metadata: Metadata = {
  title: 'Privacy Policy — UserSessions.io',
  description: 'How UserSessions.io collects, stores, and protects your data.',
}

const SECTIONS = [
  {
    title: '1. What we collect',
    body: [
      'Account data: your email address and name.',
      'Integration data: OAuth tokens for FullStory, PostHog, Datadog, Jira, Salesforce, and Slack.',
      'Telemetry data: friction path metrics and AI heuristic evaluations. We do not store raw session recording streams.',
      'Payment data: processed by Paystack. We store your plan and billing references. We never see or store your full card number.',
    ],
  },
  {
    title: '2. Service providers',
    body: [
      'We use Supabase (database, authentication), Vercel (hosting), Paystack (payments), Google AI and Anthropic (running AI heuristic evaluations on session metadata), and Resend (transactional email). Each processes data only to provide its function.',
    ],
  },
  {
    title: '3. Cookies',
    body: [
      'We use cookies only to keep you signed in. There are no advertising or cross-site tracking cookies.',
    ],
  },
  {
    title: '4. Retention and deletion',
    body: [
      'We keep your data while your account is active. We process session feeds in memory and discard them immediately after generating the AI friction report. Contact support to delete your account; deletion removes your profile and integration tokens.',
    ],
  },
  {
    title: '5. Security',
    body: [
      'Data is encrypted in transit and at rest. Access is scoped per tenant at the database level (row-level security). Administrative actions are logged to an append-only audit log. We operate a zero-trust internal network.',
    ],
  },
  {
    title: '6. Your rights',
    body: [
      'You can access, correct, export, or delete your personal data at any time by contacting info@usersessions.io. We comply with GDPR, CCPA, and standard enterprise compliance requirements.',
    ],
  },
  {
    title: '7. Changes',
    body: [
      'If we materially change this policy, we will notify you by email or in the dashboard before the change takes effect.',
    ],
  },
  {
    title: '8. Contact',
    body: ['Privacy operations: info@usersessions.io.'],
  },
]

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      effective="Effective August 7, 2026"
      description="We built UserSessions.io with privacy by design. Here is exactly what we collect, why, and how we protect it."
      sections={SECTIONS}
    />
  )
}
