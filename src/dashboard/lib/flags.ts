import { createServiceClient } from './supabase/server'

/**
 * Feature flags. Revenue-critical launch features DEFAULT ON when no explicit
 * flag row exists (owner decision: the product ships live, not dark). An
 * explicit feature_flags row ALWAYS wins, so the admin flags panel keeps its
 * instant kill-switch. Flags outside the launch set remain fail-closed
 * (BUILD_SPEC §11): lookup errors never enable an unknown feature.
 */
const LAUNCH_DEFAULT_ON = new Set(['pricing_page', 'billing'])

export async function isEnabled(flagName: string): Promise<boolean> {
  const fallback = LAUNCH_DEFAULT_ON.has(flagName)
  try {
    const db = createServiceClient()
    const { data, error } = await db
      .from('feature_flags')
      .select('enabled')
      .eq('flag_name', flagName)
      .maybeSingle()
    if (error || data == null) return fallback
    return Boolean(data.enabled)
  } catch {
    return fallback
  }
}
