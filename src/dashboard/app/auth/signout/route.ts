import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** Server-side sign-out: clears the session cookie and returns to /login. */
export async function POST(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login', request.url), { status: 303 })
}
