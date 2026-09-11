import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { dispatch } from '@/lib/notifications/dispatch'
import { safeFetch } from '@/services/ssrf-protector'

export const dynamic = 'force-dynamic'

/**
 * GET /api/onboarding/verify-script
 *
 * Actively fetches the client's domain (like Google Analytics does) and scans
 * the HTML for the UserSessions capture script tag with the correct client key.
 * If found, stamps script_installed_at and returns { verified: true }.
 * Polled every 3s by the onboarding UI — auto-advances step 3 the moment the
 * user actually has the script on their site.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: client } = await supabase
    .from('us_clients')
    .select('id, client_domain, capture_public_key, script_installed_at')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!client) {
    return NextResponse.json({ verified: false })
  }

  // Already verified — no need to crawl again
  if (client.script_installed_at) {
    return NextResponse.json({ verified: true, installedAt: client.script_installed_at })
  }

  if (!client.client_domain || !client.capture_public_key) {
    return NextResponse.json({ verified: false })
  }

  // ── Actively crawl the domain ─────────────────────────────────────────────
  const domain = client.client_domain.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const isLocal = domain.startsWith('localhost') || domain.startsWith('127.0.0.1')
  if (isLocal && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ verified: false, reason: 'local_domain_not_allowed' })
  }
  const targetUrl = `${isLocal ? 'http' : 'https'}://${domain}`

  let html: string
  try {
    // safeFetch resolves the host via DoH and refuses private ranges (SSRF guard):
    // client_domain is user-controlled.
    const res = isLocal
      ? await fetch(targetUrl, { signal: AbortSignal.timeout(10_000), redirect: 'follow' })
      : await safeFetch(targetUrl, {
          headers: {
            'User-Agent': 'UserSessions-Verifier/1.0 (+https://usersessions.io/bot)',
            'Accept': 'text/html,application/xhtml+xml',
          },
        })

    if (!res.ok) {
      console.warn(`[verify-script] ${targetUrl} returned ${res.status}`)
      return NextResponse.json({ verified: false, reason: `site_returned_${res.status}` })
    }

    html = await res.text()
  } catch (err: any) {
    console.warn(`[verify-script] Could not fetch ${targetUrl}:`, err.message)
    return NextResponse.json({ verified: false, reason: 'fetch_failed' })
  }

  // ── Check for the script tag ──────────────────────────────────────────────
  // We look for both the CDN src AND the client key so there's no false positive
  const hasCdnSrc = html.includes('usersessions.io/capture.js')
  const hasClientKey = html.includes(client.capture_public_key)

  console.log(`[verify-script] Scanned ${targetUrl}`)
  console.log(`[verify-script] Expected key: ${client.capture_public_key}`)
  console.log(`[verify-script] Found script URL? ${hasCdnSrc}`)
  console.log(`[verify-script] Found client key? ${hasClientKey}`)

  if (!hasCdnSrc || !hasClientKey) {
    return NextResponse.json({ verified: false, reason: 'missing_script_or_key' })
  }

  // ── Script found — stamp the install time ─────────────────────────────────
  const now = new Date().toISOString()
  const serviceClient = createServiceClient()

  await serviceClient
    .from('us_clients')
    .update({
      script_installed_at: now,
      activation_step: 'script_verified',
    })
    .eq('id', client.id)

  await serviceClient.from('us_activation_events').upsert({
    client_id: client.id,
    step: 'script_verified',
    metadata: { verified_url: targetUrl },
  }, { onConflict: 'client_id,step' })

  // Fire email/in-app notification
  if (user.email) {
    await dispatch({
      event_type: 'integration_connected',
      source_type: 'integration',
      source_id: client.id,
      client_id: client.id,
      recipient_user_id: user.id,
      recipient_email: user.email,
      metadata: {},
    }, {
      domain,
    }).catch(err => console.error('[verify-script] Notification dispatch error:', err))
  }

  return NextResponse.json({ verified: true, installedAt: now })
}
