import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'



/**
 * GET /api/integrations/composio/catalog?q=...
 *
 * Returns Composio's live app catalog filtered by a search query.
 * This replaces the hardcoded COMPOSIO_APPS list in the connect page.
 *
 * Uses the public Composio apps endpoint (no auth required for listing).
 * For per-entity connection status, we merge in a second call using the
 * client's composio_entity_id.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') || ''
  const limit = parseInt(searchParams.get('limit') || '20', 10)

  // Get user's connected apps from our DB to mark which ones are live
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let connectedApps: string[] = []
  if (user) {
    const { data: client } = await supabase
      .from('us_clients')
      .select('connected_composio_apps, composio_entity_id')
      .eq('profile_id', user.id)
      .maybeSingle()
    connectedApps = client?.connected_composio_apps ?? []
  }

  try {
    // Composio v3 apps listing (unauthenticated catalog)
    const encoded = encodeURIComponent(q)
    const url = q
      ? `https://backend.composio.dev/api/v3/apps?search=${encoded}&limit=${limit}`
      : `https://backend.composio.dev/api/v3/apps?limit=${limit}`

    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        // No auth key needed for public catalog listing
      },
    })

    if (!res.ok) {
      // Fall back to a curated list on error so the UI is never empty
      return NextResponse.json({ apps: getCuratedFallback(connectedApps), isFallback: true })
    }

    const data = await res.json()
    const items: any[] = Array.isArray(data) ? data : (data.items || data.data || data.apps || [])

    const apps = items.slice(0, limit).map((app: any) => ({
      id: (app.key || app.slug || app.name || '').toLowerCase(),
      name: app.displayName || app.display_name || app.name || app.key || '',
      logo: app.logo || app.logo_url || null,
      description: app.description || `Connect to ${app.displayName || app.name}`,
      categories: app.categories || [],
      connected: connectedApps.includes((app.key || app.slug || '').toLowerCase()),
    }))

    return NextResponse.json({ apps, isFallback: false })
  } catch (err) {
    return NextResponse.json({ apps: getCuratedFallback(connectedApps), isFallback: true })
  }
}

/** Curated fallback when Composio's catalog API is unreachable */
function getCuratedFallback(connectedApps: string[]) {
  return [
    { id: 'slack',       name: 'Slack',       description: 'Alerts & approval workflows', logo: null, categories: ['messaging'], connected: connectedApps.includes('slack') },
    { id: 'linear',      name: 'Linear',      description: 'Bug tickets & issue tracking', logo: null, categories: ['project_management'], connected: connectedApps.includes('linear') },
    { id: 'jira',        name: 'Jira',        description: 'Automatic bug ticket creation', logo: null, categories: ['project_management'], connected: connectedApps.includes('jira') },
    { id: 'github',      name: 'GitHub',      description: 'Auto-open issues from findings', logo: null, categories: ['developer_tools'], connected: connectedApps.includes('github') },
    { id: 'notion',      name: 'Notion',      description: 'Document and track findings', logo: null, categories: ['productivity'], connected: connectedApps.includes('notion') },
    { id: 'hubspot',     name: 'HubSpot',     description: 'Account risk flagging in CRM', logo: null, categories: ['crm'], connected: connectedApps.includes('hubspot') },
    { id: 'salesforce',  name: 'Salesforce',  description: 'Account risk flagging in CRM', logo: null, categories: ['crm'], connected: connectedApps.includes('salesforce') },
  ]
}
