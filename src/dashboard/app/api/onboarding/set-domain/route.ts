import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

/**
 * POST /api/onboarding/set-domain
 * Saves the client's site domain and records the domain_added activation step.
 * Auto-creates the us_clients row if it doesn't exist yet (e.g. for existing users
 * who signed up before the client row creation logic was added).
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { domain } = body as { domain?: string }

  if (!domain || domain.trim().length === 0) {
    return NextResponse.json({ error: 'Domain is required' }, { status: 400 })
  }

  // Normalize: strip protocol, trailing slash, www, paths, and query parameters
  const normalized = domain
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0] // Remove paths
    .split('?')[0] // Remove query strings
    .toLowerCase()

  // Allow standard domains or localhost with optional port
  const isValid = /^[a-z0-9]([a-z0-9\-\.]{0,251}[a-z0-9])?(:\d+)?$/.test(normalized)
  
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 })
  }

  // Use service client to bypass RLS for the upsert
  const db = createServiceClient()

  // Fetch or auto-create the client row
  let { data: client } = await db
    .from('us_clients')
    .select('id, activation_step')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!client) {
    // Create missing client row for users who existed before this logic was added
    const name = user.email?.split('@')[0] ?? 'My Workspace'
    const { data: newClient, error: createErr } = await db
      .from('us_clients')
      .insert({
        profile_id: user.id,
        name: `${name}'s Workspace`,
        activation_step: 'signed_up',
      })
      .select('id, activation_step')
      .single()

    if (createErr || !newClient) {
      console.error('[set-domain] Failed to create client row:', createErr)
      return NextResponse.json({ error: 'Failed to initialise workspace. Please try again.' }, { status: 500 })
    }
    client = newClient
  }

  // Update domain and advance step
  await supabase
    .from('us_clients')
    .update({
      client_domain: normalized,
      activation_step: 'domain_added',
    })
    .eq('id', client.id)

  // Upsert activation event (UNIQUE on client_id + step)
  await supabase.from('us_activation_events').upsert({
    client_id: client.id,
    step: 'domain_added',
    metadata: { domain: normalized },
  }, { onConflict: 'client_id,step' })

  return NextResponse.json({ success: true, domain: normalized })
}
