// lib/actions/composio-client.ts
// Edge-compatible Composio REST client shared across all server-side Composio calls.
//
// We avoid importing `composio-core`: OpenNext bundles it for Cloudflare Workers and
// the SDK size (15MB+) exceeds the 3 MiB worker limit.

const COMPOSIO_BASE = process.env.COMPOSIO_API_BASE || 'https://backend.composio.dev/api/v3'

export interface ComposioConnection {
  /** Connected account id (`ca_...`). This is what tools/execute expects. */
  id: string
  status: string
  auth_config_id: string | undefined
  platform_slug: string
  [key: string]: unknown
}

export function getComposioClient() {
  const apiKey = process.env.COMPOSIO_API_KEY
  if (!apiKey) throw new Error('Missing COMPOSIO_API_KEY environment variable')

  const headers = {
    'x-api-key': apiKey,
    'Content-Type': 'application/json',
  }

  return {
    getEntity: (entityId: string) => ({
      getConnections: async (): Promise<ComposioConnection[]> => {
        const res = await fetch(`${COMPOSIO_BASE}/connected_accounts?user_id=${encodeURIComponent(entityId)}&limit=50`, { headers })
        if (!res.ok) throw new Error(`Composio API error: ${res.status} ${res.statusText}`)
        const data = await res.json()
        const items: any[] = Array.isArray(data) ? data : (data.items || data.data || [])
        return items.map((c: any) => ({
          ...c,
          id: c.id ?? c.connected_account_id ?? '',
          status: String(c.status ?? '').toLowerCase(),
          auth_config_id: c.auth_config?.id || c.auth_config_id,
          platform_slug: (c.toolkit?.slug || c.app_name || '').toLowerCase(),
        }))
      },

      initiateConnection: async (params: { appName: string; authConfig?: any; config: { redirectUrl: string }; connectionData?: Record<string, string> }) => {
        const payload: Record<string, any> = {
          auth_config_id: params.authConfig?.connectedAccountId,
          user_id: entityId,
          callback_url: params.config.redirectUrl,
        }
        if (params.connectionData && Object.keys(params.connectionData).length > 0) {
          payload.connection_data = params.connectionData
        }
        const res = await fetch(`${COMPOSIO_BASE}/connected_accounts/link`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const txt = await res.text()
          throw new Error(`Composio link error: ${txt}`)
        }
        const data = await res.json()
        return { redirectUrl: data.redirect_url }
      },

      /**
       * Execute a tool. Composio v3 expects the tool inputs under `arguments`;
       * spreading them at the top level (the previous behaviour) silently dropped them.
       */
      execute: async (payload: { actionName: string; params: Record<string, unknown>; connectedAccountId?: string }) => {
        const body: Record<string, unknown> = {
          user_id: entityId,
          arguments: payload.params ?? {},
        }
        if (payload.connectedAccountId) body.connected_account_id = payload.connectedAccountId

        const res = await fetch(`${COMPOSIO_BASE}/tools/execute/${encodeURIComponent(payload.actionName)}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const txt = await res.text()
          throw new Error(`Composio execute error (${res.status}) for ${payload.actionName}: ${txt.slice(0, 500)}`)
        }
        const data = await res.json()
        if (data && data.successful === false) {
          throw new Error(`Composio tool ${payload.actionName} reported failure: ${String(data.error ?? 'unknown').slice(0, 500)}`)
        }
        return data
      },

      searchTools: async (query: string, limit = 5, toolkitSlugs?: string[]): Promise<Array<{ name: string; toolkit: string; description: string }>> => {
        const qs = new URLSearchParams({ search: query, user_id: entityId, limit: String(limit) })
        if (toolkitSlugs && toolkitSlugs.length > 0) qs.set('toolkit_slug', toolkitSlugs.map((t) => t.toLowerCase()).join(','))
        const res = await fetch(`${COMPOSIO_BASE}/tools?${qs.toString()}`, { headers })
        if (!res.ok) {
          console.warn('[composio] searchTools failed:', res.status, res.statusText)
          return []
        }
        const data = await res.json()
        const items: any[] = Array.isArray(data) ? data : (data.items || data.tools || [])
        return items.map((t: any) => ({
          name: t.slug || t.name || '',
          toolkit: (t.toolkit?.slug || t.app_name || '').toLowerCase(),
          description: t.description || '',
        }))
      },
    }),
  }
}

// -- Auth config IDs (Composio project: usersessions) ---------------------------------
// Pre-created auth configs in the Composio dashboard. Used to *initiate* connections.
// They are NOT connected-account ids and must not be passed to tools/execute.
export const COMPOSIO_AUTH_CONFIGS: Record<string, string> = {
  slack:            'ac_pm7pmrZ74wKM',
  jira:             'ac_bAwgRsU5GsvQ',
  salesforce:       'ac_UFCwWoFgyOFa',
  hubspot:          process.env.COMPOSIO_HUBSPOT_CONFIG || 'ac_UFCwWoFgyOFa',
  linear:           process.env.COMPOSIO_LINEAR_CONFIG || '',
  googlecalendar:   'ac_AoO1Kbs0T4uO',
  google_calendar:  'ac_AoO1Kbs0T4uO',
  shopify:          'ac_l3L-X7hjQvqs',
  google_drive:     'ac_rv4lV-m6405-',
  googledrive:      'ac_rv4lV-m6405-',
  onedrive:         'ac_arJocymom_Nc',
  one_drive:        'ac_arJocymom_Nc',
  discord:          'ac_3RRy9-fOvjS7',
  notion:           'ac_P-6AOFfgSav7',
  gmail:            'ac_Y9sZ5FEegpDc',
} as const

export type ComposioToolkitKey = keyof typeof COMPOSIO_AUTH_CONFIGS

/** Look up a pre-configured auth config id by toolkit slug (case-insensitive). */
export function getAuthConfigId(toolkit: string): string {
  const key = toolkit.toLowerCase() as ComposioToolkitKey
  const id = COMPOSIO_AUTH_CONFIGS[key]
  if (!id) throw new Error(`No Composio auth config for toolkit '${toolkit}'`)
  return id
}

/**
 * High-level typed execute helper used by executor.ts and approval.ts.
 * `connectedAccountId` should come from resolveConnectedAccount(); when omitted,
 * Composio picks the entity's default connection for the tool's toolkit.
 */
export async function executeComposioAction(params: {
  entityId: string
  toolkit: string
  actionName: string
  actionParams: Record<string, unknown>
  connectedAccountId?: string
}): Promise<unknown> {
  const client = getComposioClient()
  const entity = client.getEntity(params.entityId)
  return entity.execute({
    actionName: params.actionName,
    params: params.actionParams,
    connectedAccountId: params.connectedAccountId,
  })
}

/**
 * Resolve the active connected-account id for a toolkit + entity.
 * Returns undefined when nothing is connected (caller decides whether that is fatal).
 */
export async function resolveConnectedAccount(entityId: string, toolkit: string): Promise<string | undefined> {
  try {
    const client = getComposioClient()
    const connections = await client.getEntity(entityId).getConnections()
    const match = connections.find((c) => c.platform_slug === toolkit.toLowerCase() && c.status === 'active')
    return match?.id || undefined
  } catch (err: any) {
    console.warn(`[composio] resolveConnectedAccount(${toolkit}) failed:`, err?.message ?? err)
    return undefined
  }
}

/**
 * Search for a tool WITHIN the given toolkits only. Never returns a tool from an
 * unrelated toolkit: executing a Gmail tool with Jira params is worse than failing.
 */
export async function searchBestTool(
  entityId: string,
  query: string,
  allowedToolkits: string[],
): Promise<{ actionName: string; toolkit: string; connectedAccountId?: string } | null> {
  if (allowedToolkits.length === 0) return null
  try {
    const client = getComposioClient()
    const allowed = allowedToolkits.map((t) => t.toLowerCase())
    const tools = await client.getEntity(entityId).searchTools(query, 10, allowed)
    const best = tools.find((t) => allowed.includes(t.toolkit))
    if (!best || !best.name) return null
    const connectedAccountId = await resolveConnectedAccount(entityId, best.toolkit)
    return { actionName: best.name, toolkit: best.toolkit, connectedAccountId }
  } catch {
    return null
  }
}

/**
 * Fetch a single connected account so callers can verify ownership before persisting it.
 * Returns null when the account does not exist or the API call fails.
 */
export async function getConnectedAccount(connectedAccountId: string): Promise<{ id: string; userId: string | null; toolkit: string | null; status: string } | null> {
  const apiKey = process.env.COMPOSIO_API_KEY
  if (!apiKey || !/^[A-Za-z0-9_-]{4,128}$/.test(connectedAccountId)) return null
  try {
    const res = await fetch(`${COMPOSIO_BASE}/connected_accounts/${encodeURIComponent(connectedAccountId)}`, {
      headers: { 'x-api-key': apiKey },
    })
    if (!res.ok) return null
    const c: any = await res.json()
    return {
      id: c.id ?? connectedAccountId,
      userId: c.user_id ?? c.entity_id ?? c.member?.id ?? null,
      toolkit: (c.toolkit?.slug || c.app_name || '').toLowerCase() || null,
      status: String(c.status ?? '').toLowerCase(),
    }
  } catch {
    return null
  }
}

/** @deprecated Use ComposioToolkitKey */
export type ComposioToolkit = ComposioToolkitKey
