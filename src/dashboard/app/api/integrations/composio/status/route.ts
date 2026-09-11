/**
 * GET /api/integrations/composio/status
 * Returns which Composio apps are currently connected for the authenticated user.
 * Used by the Connect page to show real connection state on load.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: client } = await supabase
    .from('us_clients')
    .select('connected_composio_apps, composio_connected_accounts, connected_session_source, session_last_sync_at')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!client) {
    return NextResponse.json({
      connectedApps: [],
      connectedAccounts: {},
      sessionSource: null,
      lastSyncAt: null,
    })
  }

  return NextResponse.json({
    connectedApps: client.connected_composio_apps ?? [],
    connectedAccounts: client.composio_connected_accounts ?? {},
    sessionSource: client.connected_session_source ?? null,
    lastSyncAt: client.session_last_sync_at ?? null,
  })
}
