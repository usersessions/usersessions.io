import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/resend'
import { rateLimit } from '@/lib/rate-limit'
import { escapeHtml, field, isEmail } from '@/lib/html-escape'

export const dynamic = 'force-dynamic'

function clientIp(req: NextRequest): string {
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
}

// Consumer/free/disposable email domains — business emails only
const BLOCKED_DOMAINS = new Set([
  'gmail.com','googlemail.com','yahoo.com','yahoo.co.uk','yahoo.co.in',
  'yahoo.fr','yahoo.de','yahoo.es','yahoo.it','yahoo.ca','yahoo.com.au',
  'hotmail.com','hotmail.co.uk','hotmail.fr','hotmail.de','hotmail.es',
  'outlook.com','outlook.co.uk','outlook.fr','outlook.de','live.com',
  'live.co.uk','msn.com','icloud.com','me.com','mac.com',
  'aol.com','aol.co.uk','protonmail.com','protonmail.ch','pm.me',
  'zohomail.com','yandex.com','yandex.ru','mail.com','email.com',
  'gmx.com','gmx.de','gmx.net','web.de','libero.it','virgilio.it',
  'wanadoo.fr','orange.fr','free.fr','laposte.net','sfr.fr',
  // Disposable / temp
  'yopmail.com','guerrillamail.com','mailinator.com','10minutemail.com',
  'tempmail.com','temp-mail.org','throwawaymail.com','sharklasers.com',
  'dispostable.com','trashmail.com','fakeinbox.com','mailnull.com',
  'spamgourmet.com','spam4.me','maildrop.cc','discard.email',
])

function isBusinessEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return false
  return !BLOCKED_DOMAINS.has(domain)
}

function teamNotificationHtml(data: {
  full_name: string; email: string; company: string
  role: string; current_tool: string; team_size: string
}): string {
  const now = new Date().toLocaleString('en-US', { timeZone: 'Africa/Nairobi', dateStyle: 'full', timeStyle: 'short' })
  return `
<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;margin:0;padding:32px 16px;}
  .card{background:#fff;border-radius:12px;max-width:560px;margin:0 auto;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);}
  .header{background:#0A0A0F;padding:24px 32px;display:flex;align-items:center;gap:12px;}
  .logo{color:#FF6600;font-weight:800;font-size:18px;letter-spacing:-.03em;}
  .badge{background:#FF6600;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;letter-spacing:.05em;}
  .body{padding:32px;}
  .label{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#999;margin-bottom:4px;}
  .value{font-size:15px;color:#0A0A0F;font-weight:600;margin-bottom:20px;}
  .divider{height:1px;background:#f0f0f0;margin:8px 0 20px;}
  .cta{display:inline-block;background:#0A0A0F;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;margin-top:8px;}
  .footer{background:#fafafa;border-top:1px solid #f0f0f0;padding:16px 32px;font-size:12px;color:#999;}
</style></head><body>
<div class="card">
  <div class="header">
    <span class="logo">usersessions</span>
    <span class="badge">NEW DEMO REQUEST</span>
  </div>
  <div class="body">
    <p style="margin:0 0 24px;font-size:15px;color:#444;line-height:1.6;">A new demo request just came in. They've been auto-approved and can now log in.</p>
    <div class="label">Full Name</div><div class="value">${data.full_name}</div>
    <div class="label">Work Email</div><div class="value"><a href="mailto:${data.email}" style="color:#FF6600;">${data.email}</a></div>
    <div class="divider"></div>
    <div class="label">Company</div><div class="value">${data.company}</div>
    <div class="label">Role</div><div class="value">${data.role}</div>
    <div class="label">Current Session Tool</div><div class="value">${data.current_tool}</div>
    <div class="label">Team Size</div><div class="value">${data.team_size}</div>
    <div class="divider"></div>
    <div class="label">Requested</div><div class="value">${now}</div>
    <a href="https://usersessions.io/admin" class="cta">View in Admin Dashboard →</a>
  </div>
  <div class="footer">UserSessions.io · Auto-notification · Reply to this email to reach ${data.full_name} directly</div>
</div>
</body></html>`
}

function prospectConfirmationHtml(data: { full_name: string; company: string }): string {
  const firstName = data.full_name.split(' ')[0]
  return `
<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;margin:0;padding:32px 16px;}
  .card{background:#fff;border-radius:12px;max-width:560px;margin:0 auto;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);}
  .header{background:#0A0A0F;padding:32px;text-align:center;}
  .logo{color:#FF6600;font-weight:800;font-size:22px;letter-spacing:-.03em;display:block;margin-bottom:8px;}
  .tagline{color:rgba(245,243,238,.45);font-size:12px;letter-spacing:.08em;text-transform:uppercase;}
  .body{padding:40px 32px;}
  h1{font-size:24px;font-weight:800;color:#0A0A0F;margin:0 0 16px;letter-spacing:-.02em;line-height:1.2;}
  p{font-size:15px;color:#555;line-height:1.7;margin:0 0 16px;}
  .step{display:flex;gap:16px;align-items:flex-start;margin-bottom:20px;}
  .step-num{background:#0A0A0F;color:#FF6600;font-weight:800;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;}
  .step-text{font-size:14px;color:#444;line-height:1.6;}
  .step-title{font-weight:700;color:#0A0A0F;margin-bottom:2px;}
  .cta{display:block;background:#0A0A0F;color:#fff;padding:16px 24px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;text-align:center;margin-top:28px;}
  .footer{background:#fafafa;border-top:1px solid #f0f0f0;padding:20px 32px;font-size:12px;color:#999;text-align:center;line-height:1.7;}
</style></head><body>
<div class="card">
  <div class="header">
    <span class="logo">usersessions</span>
    <span class="tagline">Every Session, Watched. Every Action, Governed.</span>
  </div>
  <div class="body">
    <h1>You're in, ${firstName}.</h1>
    <p>We've received your demo request for <strong>${data.company}</strong> and you now have access to the dashboard.</p>
    <p>Here's what happens next:</p>
    <div class="step">
      <div class="step-num">1</div>
      <div class="step-text"><div class="step-title">Connect your session tool</div>Sign in with this email using the link below, then connect your FullStory, PostHog, Datadog, LogRocket, or Hotjar account. One read-only API key. Nothing to install.</div>
    </div>
    <div class="step">
      <div class="step-num">2</div>
      <div class="step-text"><div class="step-title">We watch your last 30 days</div>Our engine classifies every recorded session for revenue-relevant friction — rage clicks, broken flows, failed payments — enriched with your real account names.</div>
    </div>
    <div class="step">
      <div class="step-num">3</div>
      <div class="step-text"><div class="step-title">Your team gets briefed</div>Findings land in Slack. Jira tickets are filed. Recovery calls are queued. Your CSMs wake up to a list of things already handled.</div>
    </div>
    <a href="https://usersessions.io/login" class="cta">Access Your Dashboard →</a>
    <p style="margin-top:20px;font-size:13px;color:#888;">If you have any questions before your session, just reply to this email — it goes directly to our team.</p>
  </div>
  <div class="footer">
    UserSessions.io · <a href="https://usersessions.io/privacy" style="color:#999;">Privacy Policy</a><br>
    You're receiving this because you requested a demo at usersessions.io
  </div>
</div>
</body></html>`
}

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`demo-request:${clientIp(req)}`, 3, 10 * 60_000)) {
      return NextResponse.json({ error: 'Too many submissions. Please try again later.' }, { status: 429 })
    }

    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    // Every field is user-supplied and lands in an HTML email: cap + escape.
    const full_name = escapeHtml(field(body?.full_name, 120))
    const email = field(body?.email, 320).toLowerCase()
    const company = escapeHtml(field(body?.company, 200))
    const role = escapeHtml(field(body?.role, 120))
    const current_tool = escapeHtml(field(body?.current_tool, 120))
    const team_size = escapeHtml(field(body?.team_size, 60))

    if (!full_name || !email || !company || !role || !current_tool || !team_size) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
    }
    if (!isEmail(email)) return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 })

    // Business email enforcement
    if (!isBusinessEmail(email)) {
      return NextResponse.json(
        { error: 'Please use your work email address. Consumer email domains (Gmail, Yahoo, etc.) are not accepted.' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Upsert: if they re-submit, update their info and re-approve
    const { error: dbError } = await supabase
      .from('us_demo_requests')
      .upsert(
        { email, full_name, company, role, current_tool, team_size, status: 'approved', approved_at: new Date().toISOString() },
        { onConflict: 'email', ignoreDuplicates: false }
      )

    if (dbError) {
      console.error('[demo-request] DB error:', dbError)
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
    }

    // Fire emails in parallel — fail-soft, never block the user
    await Promise.allSettled([
      // Team notification
      sendEmail({
        to: 'info@usersessions.io',
        cc: 'twalib@usersessions.io',
        subject: `[Demo Request] ${full_name} — ${company}`,
        html: teamNotificationHtml({ full_name, email, company, role, current_tool, team_size }),
        replyTo: email,
      }),
      // Prospect confirmation
      sendEmail({
        to: email,
        subject: `You're in — here's how to access your UserSessions dashboard`,
        html: prospectConfirmationHtml({ full_name, company }),
      }),
    ])

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[demo-request] Unexpected error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
