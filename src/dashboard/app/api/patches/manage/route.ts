import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireLicenseOrSubscription } from '@/lib/billing/license'
import { validatePatchPayload } from '@/lib/patches/validate'

export const dynamic = 'force-dynamic'

const ACTIONS = new Set(['promote_to_canary', 'promote_to_live', 'kill'])

/**
 * POST /api/patches/manage
 *
 * Promote / kill a UI patch. This endpoint changes what runs inside a customer's
 * production pages, so:
 *   1. the caller must have a valid Supabase session,
 *   2. the client is resolved from that session (a client_id in the body is only
 *      accepted if it matches),
 *   3. the patch must belong to that client,
 *   4. the payload is re-validated before it can reach any end-user browser.
 */
export async function POST(req: Request) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { patchId?: unknown; action?: unknown; clientId?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { patchId, action } = body
  if (typeof patchId !== 'string' || typeof action !== 'string' || !ACTIONS.has(action)) {
    return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: client } = await supabase
    .from('us_clients')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!client) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (typeof body.clientId === 'string' && body.clientId !== client.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: patch, error } = await supabase
    .from('us_ui_patches')
    .select('*')
    .eq('id', patchId)
    .eq('client_id', client.id)
    .maybeSingle()

  if (error || !patch) {
    return NextResponse.json({ error: 'Patch not found' }, { status: 404 })
  }

  const hasAccess = await requireLicenseOrSubscription(client.id)
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'License Required', message: 'Live UI Patching requires an active Managed Cloud subscription or Enterprise License.' },
      { status: 402 },
    )
  }

  if (action !== 'kill') {
    const validation = validatePatchPayload(patch.patch_type, patch.patch_payload)
    if (!validation.ok) {
      return NextResponse.json({ error: 'Unsafe patch payload', reason: validation.reason }, { status: 422 })
    }
  }

  const now = new Date().toISOString()
  const approvedBy = user.email ?? user.id
  const updates: Record<string, unknown> = {}
  let nextStatus: string = patch.status

  if (action === 'promote_to_canary') {
    if (patch.status !== 'shadow') {
      return NextResponse.json({ error: 'Can only promote shadow patches to canary' }, { status: 400 })
    }
    nextStatus = 'canary'
    updates.canary_started_at = now
    updates.approved_by = approvedBy
  } else if (action === 'promote_to_live') {
    if (patch.status !== 'canary') {
      return NextResponse.json({ error: 'Can only promote canary patches to live' }, { status: 400 })
    }
    nextStatus = 'live'
    updates.promoted_to_live_at = now
    updates.approved_by = approvedBy
  } else {
    nextStatus = patch.status === 'shadow' ? 'disabled' : 'rolled_back'
    if (nextStatus === 'rolled_back') updates.rolled_back_at = now
    updates.rollback_trigger = { reason: 'Manual kill switch', by: approvedBy, at: now }
  }

  updates.status = nextStatus

  const { error: updateErr } = await supabase
    .from('us_ui_patches')
    .update(updates)
    .eq('id', patchId)
    .eq('client_id', client.id)

  if (updateErr) {
    console.error('[Patch Manage] Failed to update patch:', updateErr.message)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ success: true, status: nextStatus })
}
