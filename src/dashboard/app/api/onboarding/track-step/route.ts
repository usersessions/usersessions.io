import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type ActivationStep = 'heatmap_viewed' | 'destination_connected' | 'first_action_seen'

// Funnel order, mirrors the CHECK constraint on us_clients.activation_step
const FUNNEL = ['signed_up', 'domain_added', 'script_verified', 'heatmap_viewed', 'destination_connected', 'first_action_seen'] as const

const STEP_COLUMN: Partial<Record<ActivationStep, string>> = {
  heatmap_viewed: 'first_heatmap_viewed_at',
  first_action_seen: 'first_action_seen_at',
}

const VALID_STEPS: ReadonlySet<string> = new Set<ActivationStep>(['heatmap_viewed', 'destination_connected', 'first_action_seen'])

/**
 * POST /api/onboarding/track-step  { step, metadata? }
 * Records an activation funnel milestone. activation_step only ever advances.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const step = body?.step as ActivationStep
  const metadata = body?.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? body.metadata : {}
  if (!VALID_STEPS.has(step)) return NextResponse.json({ error: 'Invalid step' }, { status: 400 })

  const { data: client } = await supabase
    .from('us_clients')
    .select('id, activation_step')
    .eq('profile_id', user.id)
    .maybeSingle()

  // Non-critical telemetry: no client row yet means nothing to record
  if (!client) return NextResponse.json({ success: true, step, skipped: true })

  const now = new Date().toISOString()
  const update: Record<string, string> = {}
  const col = STEP_COLUMN[step]
  if (col) update[col] = now

  const currentIdx = FUNNEL.indexOf((client.activation_step ?? 'signed_up') as typeof FUNNEL[number])
  const nextIdx = FUNNEL.indexOf(step)
  if (nextIdx > currentIdx) update.activation_step = step

  if (Object.keys(update).length > 0) {
    const { error } = await supabase.from('us_clients').update(update).eq('id', client.id)
    if (error) console.error('[track-step] client update failed:', error.message)
  }

  await supabase.from('us_activation_events').upsert(
    { client_id: client.id, step, metadata },
    { onConflict: 'client_id,step' },
  )

  return NextResponse.json({ success: true, step })
}
