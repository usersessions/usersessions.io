/**
 * GET /api/integrations/composio/callback
 * Composio OAuth redirect target. Persists the connected account id to
 * us_clients.composio_connected_accounts and adds the app to connected_composio_apps.
 *
 * The caller is identified by their Supabase session, never by a query parameter:
 * an attacker must not be able to attach their own Slack/Jira to a victim's client.
 * The connected account is additionally verified against Composio.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getConnectedAccount } from '@/lib/actions/composio-client'

export const dynamic = 'force-dynamic'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://usersessions.io'
const APP_SLUG = /^[a-z0-9_]{2,40}$/

function back(param: string): NextResponse {
  return NextResponse.redirect(`${SITE}/connect?${param}`)
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const connectedAccountId = sp.get('connected_account_id') ?? sp.get('connectedAccountId')
  const app = (sp.get('app') ?? '').toLowerCase()

  if (!connectedAccountId || !APP_SLUG.test(app)) return back('composio_error=missing_params')

  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.redirect(`${SITE}/login?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`)

  // Verify with Composio that this connected account exists and belongs to this user
  const account = await getConnectedAccount(connectedAccountId)
  if (!account) return back('composio_error=account_not_found')
  if (account.userId && account.userId !== user.id) return back('composio_error=account_owner_mismatch')
  if (account.toolkit && account.toolkit !== app) return back('composio_error=app_mismatch')

  const supabase = createServiceClient()

  const { data: client } = await supabase
    .from('us_clients')
    .select('id, composio_connected_accounts, connected_composio_apps')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!client) {
    const handle = user.email?.split('@')[0]
    const { error: insertErr } = await supabase
      .from('us_clients')
      .insert({
        profile_id: user.id,
        name: handle ? `${handle}'s Workspace` : 'My Workspace',
        composio_entity_id: user.id,
        composio_connected_accounts: { [app]: connectedAccountId },
        connected_composio_apps: [app],
      })
    if (insertErr) {
      console.error('[composio/callback] Insert error:', insertErr.message)
      return back('composio_error=db_error')
    }
    return back(`composio_success=${app}`)
  }

  const accounts = { ...((client.composio_connected_accounts as Record<string, string>) ?? {}), [app]: connectedAccountId }
  const apps = Array.from(new Set([...(((client.connected_composio_apps as string[]) ?? []).map((a) => a.toLowerCase())), app]))

  const { error: updateErr } = await supabase
    .from('us_clients')
    .update({
      composio_entity_id: user.id,
      composio_connected_accounts: accounts,
      connected_composio_apps: apps,
      activation_step: 'destination_connected',
    })
    .eq('id', client.id)

  if (updateErr) {
    console.error('[composio/callback] Update error:', updateErr.message)
    return back('composio_error=db_error')
  }

  await supabase.from('us_activation_events').upsert({
    client_id: client.id,
    step: 'destination_connected',
    metadata: { app },
  }, { onConflict: 'client_id,step' })

  return back(`composio_success=${app}`)
}
