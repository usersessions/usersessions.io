/**
 * Resend API wrapper — all product email (digest, notifications, receipts) goes through here.
 * Fail-soft: a missing key or failed send must never break a user-facing flow.
 * Every HTML email ships with a plain-text fallback (derived automatically unless provided).
 */
const RESEND_API_URL = 'https://api.resend.com/emails'

export interface SendEmailInput {
  to: string | string[]
  subject: string
  html: string
  /** Plain-text fallback. Auto-derived from the HTML when omitted. */
  text?: string
  /** Optional CC recipients */
  cc?: string | string[]
  /** Optional Reply-To address */
  replyTo?: string
}

/** Naive but safe HTML → plain text: drop head/style, convert breaks, strip tags, decode entities. */
export function htmlToText(html: string): string {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>\s*/gi, '\n')
    .replace(/<\/(p|div|tr|h1|h2|h3|table|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function sendEmail({ to, subject, html, text, cc, replyTo }: SendEmailInput): Promise<{ ok: boolean }> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn('[email] RESEND_API_KEY not set — email skipped:', subject)
    return { ok: false }
  }

  try {
    const payload: Record<string, unknown> = {
      from: process.env.RESEND_FROM ?? 'usersessions <notifications@usersessions.io>',
      to,
      subject,
      html,
      text: text ?? htmlToText(html),
    }
    if (cc) payload.cc = cc
    if (replyTo) payload.reply_to = replyTo

    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[email] Resend error:', res.status, body)
    }
    return { ok: res.ok }
  } catch (err) {
    console.error('[email] send failed:', err)
    return { ok: false }
  }
}
