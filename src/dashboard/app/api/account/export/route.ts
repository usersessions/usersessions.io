import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Force dynamic: Supabase URL is a runtime env var on Cloudflare, not a build var.
export const dynamic = 'force-dynamic'

/**
 * GET /api/account/export — data portability (GDPR Art. 20 / CCPA).
 * Uses the RLS-scoped client so the export can only ever contain the
 * requesting user's own rows, by construction.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const [profile, sessionData, notificationEvents, clientRow] =
    await Promise.all([
      supabase.from('profiles').select('id, full_name, email, plan, created_at').eq('id', user.id).maybeSingle(),
      supabase.from('us_sessions').select('id, source, started_at, ingested_at, duration_seconds, error_count, rage_click_count, page_url'),
      // us_notification_events is the real in-app notification log
      supabase.from('us_notification_events').select('id, kind, title, body, read_at, created_at'),
      // Integration summary from us_clients (webhook URLs are secrets — excluded)
      supabase.from('us_clients').select('connected_session_source, connected_composio_apps, slack_alert_channel, created_at').eq('profile_id', user.id).maybeSingle(),
    ])

  const payload = {
    exported_at: new Date().toISOString(),
    profile: profile.data ?? null,
    sessions: sessionData.data ?? [],
    notification_events: notificationEvents.data ?? [],
    integrations: clientRow.data
      ? {
          session_source: clientRow.data.connected_session_source,
          composio_apps: clientRow.data.connected_composio_apps,
          slack_alert_channel: clientRow.data.slack_alert_channel,
          connected_since: clientRow.data.created_at,
        }
      : null,
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="usersessions-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}
