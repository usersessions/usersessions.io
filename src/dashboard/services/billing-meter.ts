/**
 * Billing meter (Pricing doc §3 + §5)
 *
 * Aggregates executed Actions per client per billing period.
 * Source of truth: us_actions WHERE status='executed' AND result='success'
 *
 * This service produces a summary report used to:
 *   - Power the admin dashboard action count
 *   - Provide data for invoice generation
 *
 * Billing enforcement is Paystack subscription-based (plan tiers defined in
 * @/lib/tiers.ts). The old credit-deduction RPC (us_deduct_credits) has been
 * removed. Overage is tracked for reporting only; gates live in the action
 * execution path.
 *
 * Idempotency: every record is keyed on action_id via us_billing_events.
 * A retried job never double-bills the same executed action (Pricing doc §3).
 *
 * Run as a nightly cron at /api/cron/ingest or triggered on demand from admin.
 */

import { createServiceClient } from '@/lib/supabase/server'

export interface BillingPeriod {
  start: Date
  end: Date
}

/**
 * Returns the current billing period (calendar month).
 */
export function currentBillingPeriod(): BillingPeriod {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { start, end }
}

export interface ClientBillingSummary {
  clientId: string
  clientName: string
  billingPeriodStart: string
  billingPeriodEnd: string
  totalExecutedActions: number
  billableActions: number          // actions not yet recorded in us_billing_events
  actionsByToolkit: Record<string, number>
  estimatedOverageActions: number  // above the included plan allotment
}

/**
 * Computes billable action counts for all clients (or a single client).
 * Does NOT deduct credits — returns the summary for reporting only.
 */
export async function computeBillingSummary(params?: {
  clientId?: string
  period?: BillingPeriod
}): Promise<ClientBillingSummary[]> {
  const supabase = createServiceClient()
  const period = params?.period ?? currentBillingPeriod()

  const periodStart = period.start.toISOString()
  const periodEnd = period.end.toISOString()

  // Fetch all billable actions in the period
  let query = supabase
    .from('us_actions')
    .select('id, client_id, composio_toolkit, executed_at, us_clients(name)')
    .eq('status', 'executed')
    .eq('result', 'success')
    .gte('executed_at', periodStart)
    .lte('executed_at', periodEnd)

  if (params?.clientId) {
    query = query.eq('client_id', params.clientId)
  }

  const { data: actions, error } = await query

  if (error) {
    console.error('[billing-meter] Failed to fetch billable actions:', error.message)
    return []
  }

  // Fetch action IDs already recorded in us_billing_events (idempotency guard)
  const actionIds = (actions ?? []).map((a) => a.id)
  const { data: existingBillingEvents } = await supabase
    .from('us_billing_events')
    .select('action_id')
    .in('action_id', actionIds.length > 0 ? actionIds : ['__none__'])

  const alreadyBilled = new Set((existingBillingEvents ?? []).map((e) => e.action_id))

  // Group by client
  const byClient = new Map<string, {
    name: string
    actions: typeof actions
  }>()

  for (const action of actions ?? []) {
    const clientId = action.client_id
    const clientName = (action as any).us_clients?.name ?? clientId
    if (!byClient.has(clientId)) byClient.set(clientId, { name: clientName, actions: [] })
    byClient.get(clientId)!.actions.push(action)
  }

  const summaries: ClientBillingSummary[] = []

  for (const [clientId, { name, actions: clientActions }] of byClient) {
    const byToolkit: Record<string, number> = {}
    let newBillable = 0

    for (const action of clientActions) {
      const toolkit = action.composio_toolkit
      byToolkit[toolkit] = (byToolkit[toolkit] ?? 0) + 1
      if (!alreadyBilled.has(action.id)) newBillable++
    }

    summaries.push({
      clientId,
      clientName: name,
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      totalExecutedActions: clientActions.length,
      billableActions: newBillable,
      actionsByToolkit: byToolkit,
      estimatedOverageActions: 0,  // future: subtract plan allotment
    })
  }

  return summaries
}

/**
 * Records billing events for all unbilled actions in the period.
 * Idempotent — skips action_ids already in us_billing_events.
 *
 * NOTE: This no longer deducts from a credit wallet. Billing enforcement
 * is handled by Paystack subscription plan gates in the action execution
 * path. This function purely records audit trail events.
 */
export async function recordBillingEvents(params?: {
  clientId?: string
  period?: BillingPeriod
}): Promise<{ recorded: number; skipped: number }> {
  const supabase = createServiceClient()
  const period = params?.period ?? currentBillingPeriod()

  const periodStart = period.start.toISOString()
  const periodEnd = period.end.toISOString()

  let query = supabase
    .from('us_actions')
    .select('id, client_id, executed_at')
    .eq('status', 'executed')
    .eq('result', 'success')
    .gte('executed_at', periodStart)
    .lte('executed_at', periodEnd)

  if (params?.clientId) query = query.eq('client_id', params.clientId)

  const { data: actions } = await query
  if (!actions?.length) return { recorded: 0, skipped: 0 }

  const actionIds = actions.map((a) => a.id)
  const { data: existing } = await supabase
    .from('us_billing_events')
    .select('action_id')
    .in('action_id', actionIds)

  const alreadyBilled = new Set((existing ?? []).map((e) => e.action_id))
  const unbilled = actions.filter((a) => !alreadyBilled.has(a.id))

  if (unbilled.length === 0) return { recorded: 0, skipped: alreadyBilled.size }

  // Group by client to batch inserts
  const byClient = new Map<string, typeof unbilled>()
  for (const a of unbilled) {
    if (!byClient.has(a.client_id)) byClient.set(a.client_id, [])
    byClient.get(a.client_id)!.push(a)
  }

  let recorded = 0

  for (const [clientId, clientActions] of byClient) {
    const toInsert = clientActions.map((a) => ({
      client_id: clientId,
      action_id: a.id,
      billing_period_start: period.start.toISOString().split('T')[0],
      billing_period_end: period.end.toISOString().split('T')[0],
      paystack_transaction_reference: null,
    }))

    const { error: insertErr } = await supabase.from('us_billing_events').insert(toInsert)
    if (insertErr) {
      console.error(`[billing-meter] Failed to insert billing events for client ${clientId}:`, insertErr.message)
    } else {
      recorded += toInsert.length
    }
  }

  console.log(`[billing-meter] Recorded ${recorded} billing events (${alreadyBilled.size} skipped)`)
  return { recorded, skipped: alreadyBilled.size }
}
