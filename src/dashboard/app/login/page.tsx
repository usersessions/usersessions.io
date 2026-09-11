import type { Metadata } from 'next'
import { AuthPage } from '@/components/AuthPage'
import { MarketingNav } from '@/components/MarketingNav'
import './login.css'

export const metadata: Metadata = { title: 'Sign in — UserSessions.io' }

// Auth screens are session-dependent; never statically prerender them.
export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return (
    <div className="hp">
      <div className="premium-bg" />
      <MarketingNav />
      <AuthPage initialMode="signin" />
    </div>
  )
}
