import { type NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyActionToken } from '@/lib/notifications/signed-actions'
import { markInAppRead } from '@/lib/notifications/channel-inapp'
import { approveAction, dismissAction } from '@/services/approval'
import { requireLicenseOrSubscription } from '@/lib/billing/license'
import { ACTION_STATUSES, FINDING_STATUSES } from '@/types/constants'

export const dynamic = 'force-dynamic'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://usersessions.io'

function page(status: number, title: string, heading: string, body: string): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html><html><head><title>${title}</title></head><body style="font-family:system-ui,sans-serif;max-width:480px;margin:80px auto;text-align:center">
      <h2>${heading}</h2>
      <p>${body}</p>
      <a href="${SITE}" style="color:#C05621">Open dashboard</a>
    </body></html>`,
    { status, headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' } },
  )
}

/**
 * GET /api/notify/action?t=<token>
 *
 * One-click signed action endpoint for email CTAs. The HMAC token carries the
 * user id; there is no login. We therefore use the service client and enforce
 * ownership explicitly: the finding must belong to a client owned by that user.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t')
  if (!token) return NextResponse.redirect(new URL('/login', SITE))

  const payload = await verifyActionToken(token)
  if (!payload) {
    return page(410, 'Link expired', 'This link has expired or is invalid.',
      'One-click action links are valid for 72 hours. Please open your dashboard to action this finding.')
  }

  const db = createServiceClient()

  async function ownedFinding(findingId: string): Promise<{ id: string; client_id: string } | null> {
    const { data } = await db
      .from('us_findings')
      .select('id, client_id, us_clients(profile_id)')
      .eq('id', findingId)
      .maybeSingle()
    if (!data) return null
    if ((data as any).us_clients?.profile_id !== payload!.userId) return null
    return { id: data.id, client_id: data.client_id }
  }

  async function markActioned(findingId: string) {
    await db
      .from('us_notification_events')
      .update({ actioned_at: new Date().toISOString(), actioned_channel: 'email' })
      .eq('source_id', findingId)
      .is('actioned_at', null)
    await markInAppRead('finding_pending_approval', findingId, payload!.userId)
  }

  try {
    switch (payload.action) {
      case 'approve_finding': {
        if (!payload.findingId) break
        const finding = await ownedFinding(payload.findingId)
        if (!finding) return page(403, 'Not allowed', 'This finding is not in your workspace.', 'Sign in to the dashboard to review your findings.')

        if (!(await requireLicenseOrSubscription(finding.client_id))) {
          return NextResponse.redirect(new URL('/billing?reason=license_required', SITE))
        }

        const { data: pending } = await db
          .from('us_actions')
          .select('id')
          .eq('finding_id', finding.id)
          .eq('status', ACTION_STATUSES.APPROVE_REQUIRED)

        let executed = 0
        let failed = 0
        for (const a of pending ?? []) {
          const r = await approveAction({ actionId: a.id, approvedByEmail: `email-link:${payload.userId}` })
          if (r.success) executed++
          else failed++
        }

        const status = executed > 0 && failed === 0
          ? FINDING_STATUSES.EXECUTED
          : executed > 0
            ? FINDING_STATUSES.PARTIALLY_EXECUTED
            : FINDING_STATUSES.APPROVED
        await db.from('us_findings').update({ status, dismissed_reason: null }).eq('id', finding.id)
        await markActioned(finding.id)

        return NextResponse.redirect(new URL(`/?finding=${finding.id}&actioned=approved&executed=${executed}&failed=${failed}`, SITE))
      }

      case 'dismiss_finding': {
        if (!payload.findingId) break
        const finding = await ownedFinding(payload.findingId)
        if (!finding) return page(403, 'Not allowed', 'This finding is not in your workspace.', 'Sign in to the dashboard to review your findings.')

        const { data: pending } = await db
          .from('us_actions')
          .select('id')
          .eq('finding_id', finding.id)
          .eq('status', ACTION_STATUSES.APPROVE_REQUIRED)
        for (const a of pending ?? []) {
          await dismissAction({ actionId: a.id, dismissedByEmail: `email-link:${payload.userId}`, reason: 'dismissed_via_email' })
        }

        await db.from('us_findings')
          .update({ status: FINDING_STATUSES.DISMISSED, dismissed_reason: 'dismissed_via_email' })
          .eq('id', finding.id)
        await markActioned(finding.id)

        return NextResponse.redirect(new URL(`/?finding=${finding.id}&actioned=dismissed`, SITE))
      }

      case 'reconnect_integration':
        return NextResponse.redirect(new URL('/connect', SITE))

      case 'view_action':
        return NextResponse.redirect(new URL(`/audit?action=${encodeURIComponent(payload.actionId ?? '')}`, SITE))

      case 'view_billing':
        return NextResponse.redirect(new URL('/billing', SITE))
    }
  } catch (err) {
    console.error('[notify:action] execution error:', err)
    return page(500, 'Error', 'Something went wrong.', 'We could not complete that action. Please open your dashboard and try again.')
  }

  return NextResponse.redirect(new URL('/', SITE))
}
