/**
 * POST /api/actions/[id]/dismiss
 * Human dismisses a pending action from the audit log UI.
 * Dismissal reason is logged for policy tuning.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { dismissAction } from '@/services/approval'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: actionId } = await params
  const body = await req.json().catch(() => ({})) as { reason?: string }

  // Verify ownership
  const { data: action } = await supabase
    .from('us_actions')
    .select('id, us_clients(profile_id)')
    .eq('id', actionId)
    .single()

  if (!action) return NextResponse.json({ error: 'Action not found' }, { status: 404 })
  if ((action as any).us_clients?.profile_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await dismissAction({
    actionId,
    dismissedByEmail: user.email ?? user.id,
    reason: body.reason,
  })

  return NextResponse.json({ message: 'Action dismissed' })
}
