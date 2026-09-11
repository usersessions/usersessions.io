import { NextResponse } from 'next/server'
import { audit } from '@/lib/admin'
import { requireAdminApi } from '@/lib/admin-api'
import { sendEmail } from '@/lib/email/resend'

// Sends a test email to the requesting admin. Audit-logged either way.
export async function POST() {
  const user = await requireAdminApi()
  if (!user) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  if (!user.email) return NextResponse.json({ error: 'NO_EMAIL' }, { status: 400 })

  const { ok } = await sendEmail({
    to: user.email,
    subject: 'usersessions — admin test email',
    html: '<p>Test email from the usersessions admin settings page. If you are reading this, delivery works.</p>',
  })
  await audit(user.id, 'email_test', null, { to: user.email, ok })
  return NextResponse.json({ ok })
}
