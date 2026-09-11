/**
 * Enrichment layer (Build Spec §6)
 *
 * Called between ingestion and reasoning. Uses Composio read actions to:
 *   1. Fetch account ARR/tier/health from Salesforce or HubSpot
 *   2. Check for existing open tickets in Jira/Linear (duplicate-creation guard)
 *
 * The reasoning layer should never classify a session without knowing whether
 * it belongs to a $2K/mo account or a $400K/year one (Build Spec §3).
 *
 * Phase 3 additions: Zendesk/Intercom open-ticket check, Google Calendar CSM
 * availability.
 */

import { executeComposioAction } from '@/lib/actions/composio-client'
import { createServiceClient } from '@/lib/supabase/server'
import type { EnrichmentContext, USAccount, USClient } from '@/types/usersessions'

// ── Domain extraction helpers ─────────────────────────────────

/**
 * Extracts the domain of an end-user email. Returns null unless it is a plain
 * hostname ([a-z0-9.-]): the value is interpolated into vendor query languages
 * (SOQL, JQL) and end-user ids are attacker-controlled input.
 */
function emailToDomain(email: string): string | null {
  const match = email.match(/@([^@]+)$/)
  if (!match) return null
  const domain = match[1].toLowerCase().trim()
  return /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/.test(domain) ? domain : null
}

/** Escape a value for use inside a double-quoted JQL string. */
function jqlString(value: string): string {
  return `"${value.replace(/[\\"]/g, '\\$&').slice(0, 200)}"`
}

// ── Salesforce enrichment ─────────────────────────────────────

async function fetchFromSalesforce(
  entityId: string,
  endUserEmail: string | null,
): Promise<Partial<USAccount> | null> {
  if (!endUserEmail) return null

  const domain = emailToDomain(endUserEmail)
  if (!domain) return null

  try {
    // Salesforce SOQL: find the Account by website/email domain
    const result = (await executeComposioAction({
      entityId,
      toolkit: 'salesforce',
      actionName: 'SALESFORCE_SOQL_QUERY',
      actionParams: {
        query: `SELECT Id, Name, AnnualRevenue, Website, OwnerId, Health_Score__c, StageName FROM Account WHERE Website LIKE '%${domain}%' LIMIT 1`,
      },
    })) as any

    const records = result?.records ?? result?.data?.records ?? []
    if (!records.length) return null

    const acc = records[0]
    return {
      external_account_id: acc.Id,
      domain,
      arr: acc.AnnualRevenue ?? null,
      health_score: acc.Health_Score__c ?? null,
      csm_owner: acc.OwnerId ?? null,
    }
  } catch (err: any) {
    console.warn(`[enrichment] Salesforce fetch failed for domain ${domain}:`, err.message)
    return null
  }
}

// ── HubSpot enrichment ────────────────────────────────────────

async function fetchFromHubSpot(
  entityId: string,
  endUserEmail: string | null,
): Promise<Partial<USAccount> | null> {
  if (!endUserEmail) return null

  const domain = emailToDomain(endUserEmail)
  if (!domain) return null

  try {
    const result = (await executeComposioAction({
      entityId,
      toolkit: 'hubspot',
      actionName: 'HUBSPOT_GET_COMPANY_BY_DOMAIN',
      actionParams: { domain },
    })) as any

    const company = result?.company ?? result?.data ?? null
    if (!company) return null

    return {
      external_account_id: String(company.id ?? company.companyId),
      domain,
      arr: company.properties?.annualrevenue
        ? parseFloat(company.properties.annualrevenue)
        : null,
      health_score: null,   // HubSpot doesn't have a native health score
      csm_owner: company.properties?.hubspot_owner_id ?? null,
    }
  } catch (err: any) {
    console.warn(`[enrichment] HubSpot fetch failed for domain ${domain}:`, err.message)
    return null
  }
}

// ── Open ticket check (duplicate guard) ──────────────────────

async function fetchOpenTicketCount(
  entityId: string,
  accountId: string | null,
  connectedApps: string[],
): Promise<number> {
  if (!accountId) return 0
  let count = 0
  try {
    if (connectedApps.includes('jira')) {
      const jiraResult = await executeComposioAction({
        entityId,
        toolkit: 'jira',
        actionName: 'JIRA_SEARCH_ISSUES',
        actionParams: { jql: `status != Done AND text ~ ${jqlString(accountId)}` }
      }) as any
      if (jiraResult?.issues) count += jiraResult.issues.length
      else if (jiraResult?.data?.issues) count += jiraResult.data.issues.length
    }
    if (connectedApps.includes('linear')) {
      const linearResult = await executeComposioAction({
        entityId,
        toolkit: 'linear',
        actionName: 'LINEAR_SEARCH_ISSUES',
        actionParams: { query: accountId.slice(0, 200) }
      }) as any
      if (linearResult?.nodes) count += linearResult.nodes.length
      else if (linearResult?.data?.nodes) count += linearResult.data.nodes.length
    }
  } catch (err: any) {
    console.warn(`[enrichment] fetchOpenTicketCount failed for account ${accountId}:`, err.message)
  }
  return count
}

// ── Main enrichment entry point ───────────────────────────────

/**
 * Enriches a session with CRM account data.
 * 1. Tries Salesforce first, then HubSpot if Salesforce returns nothing.
 * 2. Caches the result in us_accounts so subsequent sessions skip the API call.
 * 3. Returns an EnrichmentContext for the reasoning layer.
 *
 * Fails soft — if both CRM calls fail, returns a null-ARR context so
 * reasoning can still classify (just without the account value weight).
 */
export async function enrichSession(params: {
  client: USClient
  endUserId: string | null
  sessionId: string       // us_sessions.id — used only for logging
}): Promise<EnrichmentContext> {
  const supabase = createServiceClient()
  const { client, endUserId } = params

  const nullContext: EnrichmentContext = {
    account_id: null,
    arr: null,
    health_score: null,
    csm_owner: null,
    plan_tier: null,
    open_tickets: 0,
  }

  if (!endUserId || !client.composio_entity_id) return nullContext

  // Try cached account first (keyed by domain extracted from endUserId if it's an email)
  const domain = emailToDomain(endUserId)
  if (domain) {
    const { data: cached } = await supabase
      .from('us_accounts')
      .select('*')
      .eq('client_id', client.id)
      .eq('domain', domain)
      .maybeSingle()

    if (cached && cached.enriched_at) {
      // Cache TTL: 24 hours — stale enough to be safe, fresh enough for ARR accuracy
      const ageMs = Date.now() - new Date(cached.enriched_at).getTime()
      if (ageMs < 24 * 60 * 60 * 1000) {
        return {
          account_id: cached.external_account_id,
          arr: cached.arr,
          health_score: cached.health_score,
          csm_owner: cached.csm_owner,
          plan_tier: cached.plan_tier_at_source,
          open_tickets: await fetchOpenTicketCount(
            client.composio_entity_id, 
            cached.external_account_id,
            client.connected_composio_apps.map((a) => a.toLowerCase())
          ),
        }
      }
    }
  }

  // Live CRM lookup — Salesforce first, HubSpot fallback
  const connectedApps = client.connected_composio_apps.map((a) => a.toLowerCase())
  let crmData: Partial<USAccount> | null = null

  if (connectedApps.includes('salesforce')) {
    crmData = await fetchFromSalesforce(client.composio_entity_id, endUserId)
  }
  if (!crmData && connectedApps.includes('hubspot')) {
    crmData = await fetchFromHubSpot(client.composio_entity_id, endUserId)
  }

  if (!crmData) return nullContext

  // Cache in us_accounts
  await supabase.from('us_accounts').upsert(
    {
      client_id: client.id,
      external_account_id: crmData.external_account_id!,
      domain: crmData.domain ?? domain,
      arr: crmData.arr,
      health_score: crmData.health_score,
      csm_owner: crmData.csm_owner,
      enriched_at: new Date().toISOString(),
    },
    { onConflict: 'client_id,external_account_id' },
  )

  // Update session's mapped_account_id
  await supabase
    .from('us_sessions')
    .update({ mapped_account_id: crmData.external_account_id })
    .eq('id', params.sessionId)

  return {
    account_id: crmData.external_account_id ?? null,
    arr: crmData.arr ?? null,
    health_score: crmData.health_score ?? null,
    csm_owner: crmData.csm_owner ?? null,
    plan_tier: null,
    open_tickets: await fetchOpenTicketCount(
      client.composio_entity_id,
      crmData.external_account_id ?? null,
      connectedApps
    ),
  }
}
