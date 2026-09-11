import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/clients/accept-patching-terms
 * Records that the signed-in user accepted the live UI patching terms for THEIR client.
 * (Previously unauthenticated and updated the first client row in the table.)
 */
export async function POST() {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: client } = await supabase
    .from('us_clients')
    .select('id, ui_patching_terms_accepted')
    .eq('profile_id', user.id)
    .maybeSingle()
  if (!client) return NextResponse.json({ error: 'No client found' }, { status: 404 })

  if (client.ui_patching_terms_accepted) return NextResponse.json({ success: true, alreadyAccepted: true })

  const { error } = await supabase
    .from('us_clients')
    .update({
      ui_patching_terms_accepted: true,
      ui_patching_terms_accepted_at: new Date().toISOString(),
    })
    .eq('id', client.id)

  if (error) {
    console.error('[Terms] Failed to accept patching terms:', error.message)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
