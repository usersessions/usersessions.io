import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ allowed: false, reason: 'invalid_request' })
    }

    const normalizedEmail = email.toLowerCase().trim()
    const domain = normalizedEmail.split('@')[1]
    const supabase = createServiceClient()

    // 1. Check if the exact user already exists in profiles
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (profileError) {
      console.error('[check-allowlist] DB error checking profiles:', profileError)
      return NextResponse.json({ allowed: true, reason: 'db_error' })
    }

    if (existingProfile) {
      return NextResponse.json({ allowed: true, reason: 'existing_user' })
    }

    // 2. Check if anyone else from their company domain is already a user
    // This allows seamless team member invites / signups
    if (domain) {
      const { data: teamProfiles } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', `%@${domain}`)
        .limit(1)
        
      if (teamProfiles && teamProfiles.length > 0) {
        return NextResponse.json({ allowed: true, reason: 'team_member_auto_approved' })
      }
    }

    // 3. Check specific demo request for this exact email
    const { data: exactRequest } = await supabase
      .from('us_demo_requests')
      .select('status')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (exactRequest && exactRequest.status === 'approved') {
      return NextResponse.json({ allowed: true, reason: 'request_approved' })
    }

    // 4. Check if any demo request for this company domain is approved
    if (domain) {
      const { data: domainRequests } = await supabase
        .from('us_demo_requests')
        .select('status')
        .ilike('email', `%@${domain}`)
        .eq('status', 'approved')
        .limit(1)
        
      if (domainRequests && domainRequests.length > 0) {
        return NextResponse.json({ allowed: true, reason: 'domain_auto_approved' })
      }
    }

    // If they got here, they have no access and no approved team members
    if (exactRequest) {
      return NextResponse.json({ allowed: false, reason: 'not_approved' })
    }

    return NextResponse.json({ allowed: false, reason: 'no_request' })
  } catch (err) {
    console.error('[check-allowlist] Unexpected error:', err)
    return NextResponse.json({ allowed: false, reason: 'error' })
  }
}
