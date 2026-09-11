import type { MetadataRoute } from 'next'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://usersessions.io'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/rx', '/api', '/settings'],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  }
}
