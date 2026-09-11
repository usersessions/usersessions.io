'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

/** Updates the signed-in user's own profile row (RLS-scoped — role/plan untouchable here). */
export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const fullName = String(formData.get('full_name') ?? '')
    .trim()
    .slice(0, 120)

  await supabase
    .from('profiles')
    .update({ full_name: fullName || null })
    .eq('id', user.id)

  revalidatePath('/settings')
  revalidatePath('/', 'layout') // sidebar avatar/name
  redirect('/settings?saved=1')
}

/** Saves notification preferences to profiles. */
export async function saveNotificationPrefs(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('profiles')
    .update({
      notif_weekly_digest: formData.get('notif_weekly_digest') === 'on',
      notif_link_alerts: formData.get('notif_link_alerts') === 'on',
      notif_new_platforms: formData.get('notif_new_platforms') === 'on',
    })
    .eq('id', user.id)

  revalidatePath('/settings')
  redirect('/settings?notif_saved=1')
}

/**
 * Permanently deletes the signed-in user's account:
 * - Removes their profile row
 * - Signs them out of all sessions
 * - Deletes the auth user (service role required)
 */
export async function deleteAccount(formData: FormData) {
  const confirm = String(formData.get('confirm') ?? '').trim()
  if (confirm !== 'DELETE') {
    redirect('/settings?delete_error=confirm_mismatch')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const serviceClient = createServiceClient()

  // Delete associated client data first
  await serviceClient.from('us_clients').delete().eq('profile_id', user.id)
  // Delete profile
  await serviceClient.from('profiles').delete().eq('id', user.id)
  // Sign out from all sessions before deleting auth user
  await supabase.auth.signOut({ scope: 'global' })
  // Hard delete the auth user (only service role can do this)
  await serviceClient.auth.admin.deleteUser(user.id)

  redirect('/login?deleted=1')
}

import { randomBytes, createHash } from 'crypto'

export async function generateApiKey(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: client } = await supabase.from('us_clients').select('id').eq('profile_id', user.id).maybeSingle()
  if (!client) return

  const name = String(formData.get('name') ?? '').trim()
  if (!name) return

  // Generate a raw 32-byte hex token, prefix it for identification
  const rawKey = 'us_' + randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(rawKey).digest('hex')

  await supabase.from('us_mcp_tokens').insert({
    client_id: client.id,
    token_hash: tokenHash,
    name,
  })

  revalidatePath('/settings')
  return { rawKey }
}

export async function revokeApiKey(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  if (!id) return

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: client } = await supabase.from('us_clients').select('id').eq('profile_id', user.id).maybeSingle()
  if (!client) return

  await supabase.from('us_mcp_tokens').delete().eq('id', id).eq('client_id', client.id)

  revalidatePath('/settings')
}
