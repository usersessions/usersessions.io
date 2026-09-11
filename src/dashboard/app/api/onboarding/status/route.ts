import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/onboarding/status
 * Returns the client's current onboarding state.
 * Polled by the onboarding UI to auto-advance steps without user clicks.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: client } = await supabase
    .from('us_clients')
    .select(`
      id,
      name,
      client_domain,
      capture_public_key,
      activation_step,
      script_installed_at,
      first_heatmap_viewed_at,
      first_action_seen_at,
      onboarding_completed_at,
      connected_composio_apps,
      connected_session_source,
      audit_status
    `)
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!client) {
    return NextResponse.json({ error: 'No client found' }, { status: 404 })
  }

  // Fetch the most recent audit finding — supports both the new first-party
  // auditor and the legacy [Initial Audit] tag for backward compatibility.
  let latestFinding: { severity: string; summary: string } | null = null
  if (client.id && (client as any).audit_status === 'done') {
    const { data: findings } = await supabase
      .from('us_findings')
      .select('severity, summary')
      .eq('client_id', client.id)
      .or('summary.ilike.[First-Party Audit]%,summary.ilike.[Initial Audit]%')
      .order('created_at', { ascending: false })
      .limit(1)
    latestFinding = findings?.[0] ?? null
  }

  return NextResponse.json({
    clientId: client.id,
    domain: client.client_domain,
    capturePublicKey: client.capture_public_key,
    activationStep: client.activation_step,
    scriptInstalled: !!client.script_installed_at,
    firstHeatmapViewed: !!client.first_heatmap_viewed_at,
    firstActionSeen: !!client.first_action_seen_at,
    onboardingCompleted: !!client.onboarding_completed_at,
    connectedApps: client.connected_composio_apps ?? [],
    sessionSource: client.connected_session_source,
    auditStatus: (client as any).audit_status ?? null,
    latestFinding,
  })
}
