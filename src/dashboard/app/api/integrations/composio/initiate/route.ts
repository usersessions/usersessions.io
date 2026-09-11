/**
 * POST /api/integrations/composio/initiate
 * Start Composio OAuth flow for a given app (Slack, Jira, Salesforce, HubSpot).
 * Returns a redirectUrl that the client opens in a popup or redirect.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getComposioClient } from '@/lib/actions/composio-client'

const AUTH_CONFIGS: Record<string, string> = {
  slack: 'ac_pm7pmrZ74wKM',
  jira: 'ac_bAwgRsU5GsvQ',
  salesforce: 'ac_UFCwWoFgyOFa',
  hubspot: process.env.COMPOSIO_HUBSPOT_CONFIG ?? '',
  linear: process.env.COMPOSIO_LINEAR_CONFIG ?? '',
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { app } = await req.json() as { app: string }
  if (!app) return NextResponse.json({ error: 'app is required' }, { status: 400 })

  const authConfigId = AUTH_CONFIGS[app.toLowerCase()]
  if (!authConfigId) {
    return NextResponse.json({ error: `Unknown app: ${app}. Supported: ${Object.keys(AUTH_CONFIGS).join(', ')}` }, { status: 400 })
  }

  const entityId = user.id   // Use Supabase user ID as Composio entity ID
  const callbackUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/integrations/composio/callback?app=${app}&userId=${user.id}`

  try {
    const composio = getComposioClient()
    const entity = composio.getEntity(entityId)
    const { redirectUrl } = await entity.initiateConnection({
      appName: app,
      authConfig: { connectedAccountId: authConfigId },
      config: { redirectUrl: callbackUrl },
    })

    return NextResponse.json({ redirectUrl })
  } catch (err: any) {
    console.error('[composio/initiate] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
