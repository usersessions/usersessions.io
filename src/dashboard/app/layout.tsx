import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { PwaRegister } from '@/components/PwaRegister'
import './globals.css'
import { Geist, DM_Sans } from "next/font/google";
import { cn } from "@/lib/utils";
import { CursorProvider, Cursor } from "@/components/unlumen-ui/cursor";

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm', axes: ['opsz'] });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://usersessions.io'
const TITLE = 'UserSessions.io'
const DESCRIPTION =
  'AI that watches your users, finds what\'s breaking their experience, and fixes it automatically.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/icon.svg',
    shortcut: '/icon.svg',
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: 'UserSessions.io',
    type: 'website',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'UserSessions.io — The Autonomous Remediation Layer',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og.png'],
  },
}

export const viewport: Viewport = {
  themeColor: '#101014',
}




export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable, dmSans.variable)}>
      <head>
        <Script
          src="https://usersessions.io/capture.js"
          data-client-key="04d84a34-a435-44bb-83be-00ae3004f742"
          strategy="afterInteractive"
        />
      </head>
      <body>
        <CursorProvider global>
          {/* Grain texture — applied globally across all routes */}
          <div className="global-grain" aria-hidden="true" />
          <PwaRegister />
          {children}
          <Cursor />
        </CursorProvider>
      </body>
    </html>
  )
}
