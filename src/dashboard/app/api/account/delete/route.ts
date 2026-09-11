import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// Force dynamic: Supabase URL is a runtime env var on Cloudflare, not a build var.
export const dynamic = 'force-dynamic'


/**
 * POST /api/account/delete — permanent account deletion (GDPR Art. 17 / CCPA).
 * Requires the literal confirmation string. Deleting the auth user cascades
 * through profiles into every user-owned table (all FKs are on delete cascade).
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url), 303)

  const form = await request.formData()
  if (String(form.get('confirm') ?? '') !== 'DELETE') {
    return NextResponse.redirect(new URL('/settings?delete_error=1', request.url), 303)
  }

  const admin = createServiceClient()
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) {
    return NextResponse.redirect(new URL('/settings?delete_error=1', request.url), 303)
  }

  try {
    await supabase.auth.signOut()
  } catch {
    // session is already invalid once the user is deleted
  }
  return NextResponse.redirect(new URL('/home?deleted=1', request.url), 303)
}
