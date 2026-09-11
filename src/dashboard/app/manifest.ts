import type { MetadataRoute } from 'next'

/** Served at /manifest.webmanifest — makes the dashboard installable as a PWA. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'UserSessions.io',
    short_name: 'UserSessions',
    description:
      'AI that watches your users, finds what\'s breaking their experience, and fixes it automatically.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f5efe2',
    theme_color: '#f5efe2',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  }
}
