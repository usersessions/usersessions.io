/**
 * POST /api/actions/[id]/approve
 * Human approves a pending action from the audit log UI.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { approveAction } from '@/services/approval'
import { requireLicenseOrSubscription } from '@/lib/billing/license'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: actionId } = await params

  // Verify the action belongs to this user's client
  const { data: action } = await supabase
    .from('us_actions')
    .select('id, client_id, us_clients(profile_id)')
    .eq('id', actionId)
    .single()

  if (!action) return NextResponse.json({ error: 'Action not found' }, { status: 404 })
  if ((action as any).us_clients?.profile_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Enterprise / Cloud License Check ──
  // The precision-gating and action execution layer is a closed-source module.
  const clientId = action.client_id ?? (action.us_clients as any)?.id
  const hasAccess = await requireLicenseOrSubscription(clientId)
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'License Required', message: 'Action execution requires an active Managed Cloud subscription or Enterprise License.' },
      { status: 402 } // 402 Payment Required
    )
  }

  const result = await approveAction({
    actionId,
    approvedByEmail: user.email ?? user.id,
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 422 })
  }

  return NextResponse.json({ message: 'Action approved and executed' })
}
