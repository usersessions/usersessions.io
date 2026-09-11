import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSecurityDocumentUrl, SecurityDocKey } from '@/lib/documents/security-bundle'
// import { sendEmail } from '@/lib/email/resend' 
// Depending on how you want to implement the "email me" functionality, 
// you can hook it up here.

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new NextResponse('Unauthorized', { status: 401 })

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') as SecurityDocKey | null
    const send = searchParams.get('send') === 'true'

    if (!type || !['soc2', 'dpa', 'faq'].includes(type)) {
      return new NextResponse('Invalid security document type', { status: 400 })
    }

    const url = await getSecurityDocumentUrl(type)

    if (send) {
      // Phase 4: Wire this up to actually send the email with the link.
      // await sendSecurityDocumentEmail(user.email, type, url)
      return NextResponse.json({ sent: true })
    }

    return NextResponse.redirect(url)

  } catch (error) {
    console.error('[api/documents/security-bundle] Error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
