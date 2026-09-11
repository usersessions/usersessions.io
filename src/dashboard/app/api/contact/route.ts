import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/resend'
import { rateLimit } from '@/lib/rate-limit'
import { escapeHtml, field, isEmail } from '@/lib/html-escape'

export const dynamic = 'force-dynamic'

function clientIp(req: NextRequest): string {
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
}

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`contact:${clientIp(req)}`, 5, 10 * 60_000)) {
      return NextResponse.json({ error: 'Too many submissions. Please try again later.' }, { status: 429 })
    }

    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const name = field(body?.name, 120)
    const email = field(body?.email, 320)
    const company = field(body?.company, 200)
    const teamSize = field(body?.teamSize, 60)
    const message = field(body?.message, 5000)

    if (!name || !email || !company || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (!isEmail(email)) return NextResponse.json({ error: 'Invalid email' }, { status: 400 })

    const adminEmail = process.env.ADMIN_EMAIL ?? 'info@usersessions.io'

    await sendEmail({
      to: adminEmail,
      replyTo: email,
      subject: `[Sales Inquiry] ${company} - ${name}`,
      html: `
        <h2>New Sales Inquiry</h2>
        <table cellpadding="8" style="border-collapse:collapse;width:100%">
          <tr><td><strong>Name</strong></td><td>${escapeHtml(name)}</td></tr>
          <tr><td><strong>Email</strong></td><td><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
          <tr><td><strong>Company</strong></td><td>${escapeHtml(company)}</td></tr>
          <tr><td><strong>Team size</strong></td><td>${escapeHtml(teamSize || 'Not specified')}</td></tr>
        </table>
        <h3>Message</h3>
        <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
      `,
    })

    await sendEmail({
      to: email,
      subject: 'Thanks for reaching out - usersessions',
      html: `
        <p>Hi ${escapeHtml(name)},</p>
        <p>Thanks for your interest. We have received your message and will get back to you within one business day.</p>
        <p>Feel free to reply to this email if you have any questions in the meantime.</p>
        <p>The usersessions team</p>
      `,
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[/api/contact]', err)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
