/**
 * POST /api/sources/connect
 * Save session source credentials for the authenticated user's client.
 * Validates credentials against the vendor before saving.
 * Supports: datadog_rum, posthog, fullstory
 */
import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateDatadogCredentials } from '@/services/connectors/datadog-rum'
import { validatePostHogCredentials } from '@/services/connectors/posthog'
import { validateFullStoryCredentials } from '@/services/connectors/fullstory'
import { runFirstPartyAudit } from '@/services/first-party-audit'
import type { SessionSource } from '@/types/usersessions'

export const dynamic = 'force-dynamic'

const SOURCES = new Set<SessionSource>(['datadog_rum', 'posthog', 'fullstory'])

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { source?: SessionSource; api_key?: string; app_key?: string; client_name?: string; website_url?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { source, api_key, app_key, client_name, website_url } = body

  if (!source || !SOURCES.has(source) || typeof api_key !== 'string' || !api_key.trim()) {
    return NextResponse.json({ error: 'source (datadog_rum | posthog | fullstory) and api_key are required' }, { status: 400 })
  }

  let websiteUrl: string | null = null
  if (typeof website_url === 'string' && website_url.trim()) {
    try {
      const u = new URL(website_url.trim().match(/^https?:\/\//i) ? website_url.trim() : `https://${website_url.trim()}`)
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('bad protocol')
      websiteUrl = u.toString()
    } catch {
      return NextResponse.json({ error: 'website_url must be a valid http(s) URL' }, { status: 400 })
    }
  }

  // Validate credentials against the vendor API before saving
  let validation: { valid: boolean; error?: string } = { valid: true }
  if (source === 'datadog_rum') {
    validation = await validateDatadogCredentials(api_key, app_key ?? '')
  } else if (source === 'posthog') {
    if (!app_key) return NextResponse.json({ error: 'app_key (PostHog Project ID) is required for PostHog' }, { status: 400 })
    validation = await validatePostHogCredentials(api_key, app_key)
  } else if (source === 'fullstory') {
    if (!app_key) return NextResponse.json({ error: 'app_key (FullStory Org ID) is required for FullStory' }, { status: 400 })
    validation = await validateFullStoryCredentials(api_key, app_key)
  }
  if (!validation.valid) {
    return NextResponse.json({ error: `Credential validation failed: ${validation.error}` }, { status: 422 })
  }

  // One client per profile. Select-then-write so this works whether or not the
  // unique index on profile_id has been applied yet.
  const { data: existing } = await supabase
    .from('us_clients')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()

  const fields = {
    connected_session_source: source,
    session_source_api_key: api_key,
    session_source_app_key: app_key ?? null,
    ...(websiteUrl ? { website_url: websiteUrl } : {}),
    ...(client_name ? { name: String(client_name).slice(0, 120) } : {}),
  }

  const write = existing
    ? supabase.from('us_clients').update(fields).eq('id', existing.id)
    : supabase.from('us_clients').insert({ profile_id: user.id, name: client_name ?? user.email ?? 'My Workspace', ...fields })

  const { data: client, error } = await write.select('id, name, connected_session_source, website_url').single()
  if (error || !client) {
    return NextResponse.json({ error: error?.message ?? 'Failed to save client' }, { status: 500 })
  }

  // First-party audit fires after the response (does not block the user).
  // No third-party API key required — reads from capture.js data.
  const clientId = client.id
  const auditUrl = websiteUrl ?? undefined
  after(async () => {
    const result = await runFirstPartyAudit({ clientId, websiteUrl: auditUrl })
    if (!result.ok) console.error('[api/sources/connect] first-party audit failed:', result.error)
  })

  return NextResponse.json({ client, message: 'Session source connected successfully' })
}
