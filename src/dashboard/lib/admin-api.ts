import { createClient } from './supabase/server'

/**
 * Admin gate for API route handlers. Unlike requireAdmin (which redirects, for pages),
 * this returns the admin user or null so callers can respond 401/403 with JSON.
 */
export async function requireAdminApi() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return user
}
