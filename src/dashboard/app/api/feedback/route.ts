import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/resend'
import { rateLimit } from '@/lib/rate-limit'
import { escapeHtml, field, isEmail } from '@/lib/html-escape'

export const dynamic = 'force-dynamic'

const TYPES = new Set(['general', 'bug', 'feature', 'praise'])
const TYPE_LABEL: Record<string, string> = {
  bug: 'Bug Report',
  feature: 'Feature Request',
  praise: 'Praise',
  general: 'General Feedback',
}

function clientIp(req: NextRequest): string {
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
}

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`feedback:${clientIp(req)}`, 5, 10 * 60_000)) {
      return NextResponse.json({ error: 'Too many submissions. Please try again later.' }, { status: 429 })
    }

    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const name = field(body?.name, 120)
    const emailRaw = field(body?.email, 320)
    const type = TYPES.has(body?.type) ? body.type : 'general'
    const message = field(body?.message, 5000)

    if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    if (emailRaw && !isEmail(emailRaw)) return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    const email = emailRaw || null

    const supabase = createServiceClient()
    const { data: record, error: dbError } = await supabase
      .from('us_feedback')
      .insert({ name: name || null, email, type, message })
      .select('id, created_at')
      .single()
    if (dbError) console.error('[feedback] DB insert failed:', dbError.message)

    const adminEmail = process.env.ADMIN_EMAIL || 'info@usersessions.io'
    const typeLabel = TYPE_LABEL[type]

    await sendEmail({
      to: adminEmail,
      replyTo: email ?? undefined,
      subject: `[Feedback] ${typeLabel}${name ? ` from ${name}` : ''}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#e55a00">New Feedback Received</h2>
          <table cellpadding="10" style="border-collapse:collapse;width:100%;background:#f9f9f9;border-radius:8px">
            <tr><td><strong>Type</strong></td><td>${escapeHtml(typeLabel)}</td></tr>
            <tr><td><strong>Name</strong></td><td>${name ? escapeHtml(name) : '<em>Anonymous</em>'}</td></tr>
            <tr><td><strong>Email</strong></td><td>${email ? `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>` : '<em>Not provided</em>'}</td></tr>
            <tr><td><strong>DB Row</strong></td><td><code>${escapeHtml(record?.id ?? '-')}</code></td></tr>
          </table>
          <h3>Message</h3>
          <p style="white-space:pre-wrap;background:#fff;padding:16px;border-radius:8px;border:1px solid #eee">${escapeHtml(message)}</p>
        </div>
      `,
    })

    if (email) {
      await sendEmail({
        to: email,
        subject: 'Thanks for your feedback - usersessions',
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <p>Hi${name ? ` ${escapeHtml(name)}` : ''},</p>
            <p>Thanks for taking the time to send us feedback. It genuinely helps us build a better product.</p>
            <p>We read everything and will follow up if your message needs a reply.</p>
            <p style="color:#888;font-size:13px">The usersessions team</p>
          </div>
        `,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[/api/feedback]', err)
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 })
  }
}
