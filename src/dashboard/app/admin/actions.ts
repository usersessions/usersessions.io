'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { audit, requireAdmin } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/server'

export async function toggleFlag(formData: FormData) {
  const { user } = await requireAdmin()
  const flagName = String(formData.get('flagName') ?? '')
  const enabled = String(formData.get('enabled')) === 'true'
  if (!flagName) return

  const db = createServiceClient()
  await db.from('feature_flags').update({ enabled, updated_at: new Date().toISOString() }).eq('flag_name', flagName)
  await audit(user.id, 'flag_toggle', null, { flagName, enabled })
  revalidatePath('/admin/flags')
}

export async function setSubscriptionStatus(formData: FormData) {
  const { user } = await requireAdmin()
  const targetUserId = String(formData.get('userId') ?? '')
  const status = String(formData.get('status') ?? '')
  if (!targetUserId || !['none', 'active', 'non_renewing', 'attention', 'cancelled'].includes(status)) return

  const db = createServiceClient()
  await db.from('profiles').update({ subscription_status: status }).eq('id', targetUserId)
  await audit(user.id, 'billing_override_status', targetUserId, { status })
  revalidatePath('/admin/users')
}

export async function setPlan(formData: FormData) {
  const { user } = await requireAdmin()
  const targetUserId = String(formData.get('userId') ?? '')
  const plan = String(formData.get('plan') ?? '')
  if (!targetUserId || !['free', 'starter', 'pro', 'business', 'enterprise'].includes(plan)) return

  const db = createServiceClient()
  const { error: err1 } = await db.from('profiles').update({ plan }).eq('id', targetUserId)
  if (err1) console.error('Failed to update profiles.plan:', err1)

  const { error: err2 } = await db.from('us_clients').update({ plan_tier: plan }).eq('profile_id', targetUserId)
  if (err2) console.error('Failed to update us_clients.plan_tier:', err2)

  await audit(user.id, 'billing_override_plan', targetUserId, { plan })
  revalidatePath('/admin/users')
  revalidatePath('/', 'layout') // Purge client cache so user dashboard updates immediately
}

/** Suspend a user: blocks API access and future sign-ins. Admins can never be suspended. */
export async function suspendUser(formData: FormData) {
  const { user } = await requireAdmin()
  const targetUserId = String(formData.get('userId') ?? '')
  const reason = String(formData.get('reason') ?? '').slice(0, 500)
  if (!targetUserId) return

  const db = createServiceClient()
  const { data: target } = await db.from('profiles').select('role').eq('id', targetUserId).maybeSingle()
  if (!target || target.role === 'admin') return

  await db.from('profiles').update({ suspended_at: new Date().toISOString() }).eq('id', targetUserId)
  await audit(user.id, 'user_suspend', targetUserId, { reason: reason || null })
  revalidatePath('/admin/users')
}

export async function unsuspendUser(formData: FormData) {
  const { user } = await requireAdmin()
  const targetUserId = String(formData.get('userId') ?? '')
  if (!targetUserId) return

  const db = createServiceClient()
  await db.from('profiles').update({ suspended_at: null }).eq('id', targetUserId)
  await audit(user.id, 'user_unsuspend', targetUserId, null)
  revalidatePath('/admin/users')
}

/**
 * Force delete a user permanently. Admin-only; admins can never be deleted.
 * Requires typing the target's exact email as confirmation. The audit entry is
 * written BEFORE the deletion so the trail survives the cascade — deleting the
 * auth user cascades through profiles into every user-owned table (sessions,
 * transactions, etc.), same as the GDPR self-delete route.
 */
export async function forceDeleteUser(formData: FormData) {
  const { user } = await requireAdmin()
  const targetUserId = String(formData.get('userId') ?? '')
  const confirmEmail = String(formData.get('confirmEmail') ?? '').trim().toLowerCase()
  if (!targetUserId) return

  const db = createServiceClient()
  const { data: target } = await db.from('profiles').select('email, role').eq('id', targetUserId).maybeSingle()
  if (!target || target.role === 'admin') return
  if (!target.email || target.email.toLowerCase() !== confirmEmail) return

  await audit(user.id, 'user_force_delete', targetUserId, { email: target.email })
  const { error } = await db.auth.admin.deleteUser(targetUserId)
  if (error) {
    await audit(user.id, 'user_force_delete_failed', targetUserId, { email: target.email, error: error.message })
    return
  }
  revalidatePath('/admin/users')
  redirect('/admin/users')
}
