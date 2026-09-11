import type { Metadata } from 'next'
import Script from 'next/script'

export const metadata: Metadata = {
  title: 'UserSessions.io — Every Session, Watched. Every Action, Governed.',
  description:
    'UserSessions.io watches every session your team already records, classifies what actually matters, and acts — filing the ticket, flagging the account, alerting the right channel — before it becomes a churn conversation.',
  openGraph: {
    title: 'UserSessions.io — Every Session, Watched. Every Action, Governed.',
    description:
      'Connect the session tool you already run. We watch every session, flag what matters, and act automatically across Slack, Jira, and Salesforce before it becomes a renewal conversation.',
    type: 'website',
  },
}

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script
        src="https://usersessions.io/capture.js"
        data-client-key="04d84a34-a435-44bb-83be-00ae3004f742"
        strategy="afterInteractive"
      />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Mono:wght@300;400;500&family=Syne:wght@400;600;700;800&display=swap"
        rel="stylesheet"
      />
      {children}
    </>
  )
}
