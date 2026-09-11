/**
 * POST /api/onboarding/complete
 * Mark onboarding as complete for the authenticated user's client.
 * Called by the onboarding flow after all 3 steps are done.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('us_clients')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('profile_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: 'Onboarding complete' })
}
