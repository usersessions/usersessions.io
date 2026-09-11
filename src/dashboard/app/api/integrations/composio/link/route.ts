import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getComposioClient, COMPOSIO_AUTH_CONFIGS, type ComposioToolkit } from '@/lib/actions/composio-client'

export const dynamic = 'force-dynamic'

// Map of supported platforms
const SUPPORTED_PLATFORMS: Record<string, ComposioToolkit> = {
  googlecalendar:  'google_calendar',
  google_calendar: 'google_calendar',
  shopify:         'shopify',
  google_drive:    'google_drive',
  googledrive:     'googledrive',
  onedrive:        'onedrive',
  slack:           'slack',
  discord:         'discord',
  notion:          'notion',
  jira:            'jira',
  linear:          'linear'
}

/**
 * POST /api/integrations/composio/link
 *
 * Returns a Composio magic link for the user to authenticate a platform.
 * Composio manages the full OAuth flow and token lifecycle — we no longer
 * exchange codes or store secrets in Vault for Composio-managed integrations.
 *
 * Body: { platform: string }
 * Response: { authUrl: string }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const platform: string = body?.platform?.toLowerCase()
  const connectionData: Record<string, string> | undefined = body?.connection_data

  if (!platform || !SUPPORTED_PLATFORMS[platform]) {
    return NextResponse.json(
      { error: 'unsupported_platform', supported: Object.keys(SUPPORTED_PLATFORMS) },
      { status: 400 }
    )
  }

  try {
    const composio = getComposioClient()

    // Map the Supabase user_id → Composio entityId.
    // Composio's entity system uses our userId as a stable identifier so
    // connections persist across sessions without us managing tokens.
    const entity = composio.getEntity(user.id)

    // Resolve the toolkit name for this platform
    const toolkit = SUPPORTED_PLATFORMS[platform].toUpperCase()

    // Generate a managed OAuth link. Composio handles the redirect, code
    // exchange, token storage, and refresh lifecycle on their end.
    const origin = new URL(req.url).origin
    
    const connectionRequest = await entity.initiateConnection({
      appName: toolkit,
      authConfig: { connectedAccountId: COMPOSIO_AUTH_CONFIGS[SUPPORTED_PLATFORMS[platform]] },
      config: { redirectUrl: `${origin}/settings/integrations?composio=connected&platform=${platform}` },
      connectionData,
    })

    const authUrl = connectionRequest.redirectUrl

    if (!authUrl) {
      throw new Error(`Composio did not return a redirect URL for ${platform}`)
    }

    return NextResponse.json({ authUrl })
  } catch (err: any) {
    console.error(`[Composio Link] Failed for ${platform}:`, err)
    return NextResponse.json(
      { error: 'composio_link_failed', detail: String(err?.message ?? err).slice(0, 200) },
      { status: 500 }
    )
  }
}
