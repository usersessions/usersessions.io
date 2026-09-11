import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/resend'
import { sendWelcomeEmail } from '@/lib/email/triggers'

const ADMIN_EMAIL = 'info@usersessions.io'

/**
 * Handles both magic link and Google OAuth callbacks.
 * NON-NEGOTIABLE (BUILD_SPEC §6): a profiles row is ensured on every sign-in.
 * Google OAuth is open to all users. The admin role is pinned server-side to the
 * admin email only — /admin routes are gated by the role check, never by which
 * sign-in method was used. Supports a sanitized internal ?next= redirect
 * (used by /rx to land on /admin).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next')
  const next = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      const email = (data.user.email ?? '').toLowerCase()

      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .maybeSingle()
      const isNewProfile = !existing

      await supabase
        .from('profiles')
        .upsert(
          {
            id: data.user.id,
            email: data.user.email ?? '',
            full_name: (data.user.user_metadata?.full_name as string | undefined) ?? null,
          },
          { onConflict: 'id', ignoreDuplicates: true }
        )

      // Welcome + internal new-signup alert — fire once, on first-ever profile creation.
      if (isNewProfile) {
        const name = (data.user.user_metadata?.full_name as string | undefined)?.split(' ')[0] ?? 'there'
        void sendWelcomeEmail(data.user.email ?? '', name)
        
        void sendEmail({
          to: ADMIN_EMAIL,
          subject: `🚀 New signup: ${data.user.email}`,
          html: `
            <h1>New signup</h1>
            <p><strong>Email:</strong> ${data.user.email}</p>
            <p><strong>Name:</strong> ${data.user.user_metadata?.full_name || '—'}</p>
            <p><strong>Source:</strong> ${data.user.app_metadata?.provider || 'email'}</p>
            <a href="${origin}/admin/users">View in admin</a>
          `,
        })
      }


      // Auto-create workspace client row for new signups.
      // capture_public_key is generated here so the snippet is ready instantly.
      // Service client bypasses RLS for this server-side insert.
      let isNewClient = false
      if (isNewProfile) {
        const db = createServiceClient()
        const name = (data.user.user_metadata?.full_name as string | undefined) ?? data.user.email?.split('@')[0] ?? 'My Workspace'
        const { error: clientErr } = await db.from('us_clients').insert({
          profile_id: data.user.id,
          name: `${name}'s Workspace`,
          activation_step: 'signed_up',
        })
        if (!clientErr) {
          isNewClient = true
          // Seed the first activation event
          const { data: clientRow } = await db
            .from('us_clients')
            .select('id')
            .eq('profile_id', data.user.id)
            .single()
          if (clientRow) {
            await db.from('us_activation_events').insert({
              client_id: clientRow.id,
              step: 'signed_up',
              metadata: { provider: data.user.app_metadata?.provider ?? 'email' },
            })
          }
        }
      }

      // Admin role is pinned to the admin email — idempotent, via service role
      // (RLS keeps users from self-promoting).
      if (email === ADMIN_EMAIL) {
        const db = createServiceClient()
        await db.from('profiles').update({ role: 'admin' }).eq('id', data.user.id).neq('role', 'admin')
      }

      // Suspended accounts cannot sign in (admin suspension, audited).
      const { data: gate } = await supabase
        .from('profiles')
        .select('suspended_at')
        .eq('id', data.user.id)
        .maybeSingle()
      if (gate?.suspended_at) {
        await supabase.auth.signOut()
        return NextResponse.redirect(`${origin}/login?error=suspended`)
      }

      // New users always land on onboarding; returning users go to their destination.
      const destination = isNewClient ? '/onboarding' : next
      return NextResponse.redirect(`${origin}${destination}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
