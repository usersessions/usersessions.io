import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Public: marketing, auth flow, shareable reports, pricing. /api routes self-authenticate
// (Supabase session, Bearer, cron secret, capture key, or webhook signature).
const PUBLIC_PREFIXES = ['/home', '/login', '/signup', '/rx', '/auth', '/reports', '/pricing', '/api', '/terms', '/privacy', '/support', '/articles', '/faq']

// Cookie-less beacon routes called from customers' sites. No Supabase lookup needed;
// they authenticate with the capture_public_key and are rate-limited here.
const BEACON_PREFIXES = ['/api/ingest/', '/api/patches/active', '/api/patches/invalidate']

// Public form endpoints that are cheap to abuse (email sending, DB writes).
const STRICT_PREFIXES = ['/api/contact', '/api/demo-request', '/api/feedback']

/** Security headers on every response, including redirects. CSP is deferred until
 *  nonce handling for Next.js inline chunks is validated in a local build. */
function withSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  return res
}

// Shared-store limiters (Upstash). Only instantiated when configured; the in-route
// `lib/rate-limit.ts` fallback still applies per isolate when these are null.
const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? Redis.fromEnv()
  : null

const strictLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '10 m'), analytics: true, prefix: 'rl:strict' })
  : null

// capture.js flushes heatmaps every 15s and fetches patches on every route change;
// 240/min per IP leaves ample headroom for a real visitor and stops a flood.
const beaconLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(240, '1 m'), analytics: true, prefix: 'rl:beacon' })
  : null

function clientIp(request: NextRequest): string {
  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || request.headers.get('x-real-ip')
    || '127.0.0.1'
}

function tooMany(limit: number, remaining: number, reset: number): NextResponse {
  return withSecurityHeaders(new NextResponse(
    JSON.stringify({ error: 'Too many requests. Please try again later.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': String(remaining),
        'X-RateLimit-Reset': String(reset),
      },
    },
  ))
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // ── Rate limiting runs BEFORE any auth/DB work ───────────────────────────
  const isBeacon = BEACON_PREFIXES.some((p) => path.startsWith(p))
  const isStrict = STRICT_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))

  if (isBeacon && beaconLimiter) {
    const { success, limit, reset, remaining } = await beaconLimiter.limit(`beacon:${clientIp(request)}`)
    if (!success) return tooMany(limit, remaining, reset)
  }
  if (isStrict && strictLimiter && request.method !== 'GET') {
    const { success, limit, reset, remaining } = await strictLimiter.limit(`strict:${clientIp(request)}`)
    if (!success) return tooMany(limit, remaining, reset)
  }

  // Beacon routes carry no session cookie; skip the Supabase round-trip entirely.
  if (isBeacon) return withSecurityHeaders(NextResponse.next({ request }))

  const isPublic = PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))
  const hasAuthCookie = request.cookies.getAll().some(c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'))

  let response = NextResponse.next({ request })

  // Fast-path: if they are hitting a public page and have no session cookie, skip the expensive Supabase verification
  if (isPublic && !hasAuthCookie) {
    return withSecurityHeaders(response)
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    if (path === '/') {
      // Serve marketing AT the apex (rewrite, not redirect): the canonical homepage
      // is https://usersessions.io/ so link equity and SEO stay on the root URL,
      // while signed-in users see the dashboard at the same address.
      url.pathname = '/home'
      return withSecurityHeaders(NextResponse.rewrite(url))
    }
    url.pathname = '/login'
    return withSecurityHeaders(NextResponse.redirect(url))
  }

  return withSecurityHeaders(response)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sitemap\\.xml|robots\\.txt|manifest\\.webmanifest|.*\\.(?:js|svg|png|jpg|jpeg|gif|webp|ico|xml|txt)$).*)'],
}
