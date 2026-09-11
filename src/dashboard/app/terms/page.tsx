import type { Metadata } from 'next'
import { LegalPageLayout } from '@/components/LegalPageLayout'

export const metadata: Metadata = {
  title: 'Terms of Service — UserSessions.io',
  description: 'Terms governing your use of the UserSessions.io AI Session Analysis Dashboard.',
}

const SECTIONS = [
  {
    title: '1. The service',
    body: [
      'UserSessions.io is an AI Session Analysis Dashboard. It connects to your existing session recording tools (e.g., FullStory, PostHog, Datadog), evaluates user sessions against AI heuristic models, and generates actionable friction reports and tickets. We process metadata and do not store raw session streams.',
    ],
  },
  {
    title: '2. Your account',
    body: [
      'You must provide a valid email address to create an account. You are responsible for activity that happens under your account. Keep access to your email secure — sign-in links are sent there.',
    ],
  },
  {
    title: '3. Subscriptions and billing',
    body: [
      'Paid plans are recurring subscriptions billed through Paystack. Prices are shown on the pricing page before you subscribe. Your subscription renews automatically until cancelled. Enterprise contracts are subject to their respective MSAs.',
      'If a renewal payment fails, we will notify you and may pause your integration sync after a grace period.',
    ],
  },
  {
    title: '4. Refunds',
    body: [
      'If something went wrong with a charge, contact info@usersessions.io within 14 days of that charge. We do not offer refunds for partial billing periods after cancellation.',
    ],
  },
  {
    title: '5. Acceptable use',
    body: [
      'You may only connect session recording tools for properties you own or are authorized to represent. You must not attempt to abuse, overload, or reverse-engineer the service or the underlying AI heuristics.',
    ],
  },
  {
    title: '6. Your content and intellectual property',
    body: [
      'You retain all rights to the session data you provide. You also own the full commercial rights to the AI friction reports generated through the service. You grant us a limited licence to process the inputs via third-party AI providers (e.g., Google AI / Anthropic) to operate the service. We do not use your session data to train our foundational models.',
    ],
  },
  {
    title: '7. Disclaimers',
    body: [
      'We do not control the third-party LLM providers that evaluate the sessions. We cannot guarantee the absolute accuracy of every friction report or revenue leakage estimate. The service is provided on an as-is basis.',
    ],
  },
  {
    title: '8. Liability',
    body: [
      'To the maximum extent permitted by law, our total liability arising out of the service is limited to the amount you paid us in the twelve months before the claim arose.',
    ],
  },
  {
    title: '9. Termination',
    body: [
      'You can stop using the service and delete your account at any time by contacting info@usersessions.io. We may suspend or terminate accounts that violate these terms, with notice where practical.',
    ],
  },
  {
    title: '10. Changes',
    body: [
      'We may update these terms as the product evolves. If a change is material, we will notify you by email or in the dashboard before it takes effect. Continuing to use the service after a change means you accept the updated terms.',
    ],
  },
  {
    title: '11. Contact',
    body: ['Legal inquiries: info@usersessions.io.'],
  },
]

export default function TermsPage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      effective="Effective August 7, 2026"
      description="These terms govern your access to and use of the UserSessions.io AI Session Analysis Dashboard."
      sections={SECTIONS}
    />
  )
}
