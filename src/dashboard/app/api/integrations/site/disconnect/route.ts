import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { dispatch } from '@/lib/notifications/dispatch'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: client } = await supabase
    .from('us_clients')
    .select('id, client_domain')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!client) {
    return NextResponse.json({ error: 'No client found' }, { status: 404 })
  }

  const serviceClient = createServiceClient()

  // Disconnect site by clearing out the domain and related fields.
  // activation_step is CHECK-constrained; 'signed_up' is the initial value.
  const { error: updateErr } = await serviceClient
    .from('us_clients')
    .update({
      client_domain: null,
      script_installed_at: null,
      audit_status: null,
      onboarding_completed_at: null,
      activation_step: 'signed_up',
    })
    .eq('id', client.id)

  if (updateErr) {
    console.error('[site-disconnect] update failed:', updateErr.message)
    return NextResponse.json({ error: 'Failed to disconnect site' }, { status: 500 })
  }

  // Drop the funnel events that no longer apply so the onboarding UI restarts cleanly
  await serviceClient
    .from('us_activation_events')
    .delete()
    .eq('client_id', client.id)
    .in('step', ['domain_added', 'script_verified', 'heatmap_viewed'])

  // Fire disconnect notification (email + in-app)
  if (user.email) {
    await dispatch({
      event_type: 'integration_disconnected',
      source_type: 'integration',
      source_id: client.id,
      client_id: client.id,
      recipient_user_id: user.id,
      recipient_email: user.email,
      metadata: {},
    }, {
      integrationName: 'Website',
      domain: client.client_domain || 'your site',
    }).catch(err => console.error('[site-disconnect] Notification dispatch error:', err))
  }

  return NextResponse.json({ ok: true })
}
