import { NextResponse } from 'next/server'
import { authenticateBearer } from '@/lib/auth/bearer'
import { createServiceClient } from '@/lib/supabase/server'

// Force dynamic: Supabase URL is a runtime env var on Cloudflare, not a build var.
export const dynamic = 'force-dynamic'


/**
 * Founder profile for the extension. Signup data (name, email) is reused so
 * users never re-type what they already gave us. Bearer-only: the extension
 * is the sole consumer.
 */
export async function GET(request: Request) {
  const user = await authenticateBearer(request)
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const db = createServiceClient()
  const { data, error } = await db
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'FAILED' }, { status: 500 })

  return NextResponse.json({
    founderName: data?.full_name ?? '',
    contactEmail: data?.email ?? user.email ?? '',
  })
}
