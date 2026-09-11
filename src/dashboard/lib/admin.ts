import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from './supabase/server'

/**
 * HARD server-side gate on every /admin route (BUILD_SPEC §12): non-admins are redirected,
 * never shown admin UI hidden with CSS.
 */
export async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') redirect('/')

  return { user, email: profile.email as string }
}

/** Append-only. Every admin action that changes user-visible state writes here — no exceptions. */
export async function audit(
  adminId: string,
  action: string,
  targetUserId?: string | null,
  detail?: unknown
): Promise<void> {
  const db = createServiceClient()
  await db.from('admin_audit_log').insert({
    admin_id: adminId,
    action,
    target_user_id: targetUserId ?? null,
    detail: detail ?? null,
  })
}
