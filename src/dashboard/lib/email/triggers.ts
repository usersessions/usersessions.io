/**
 * UserSessions.io Email Triggers — all 14 email templates.
 *
 * Design rules (Section 5 of the notification spec):
 * - No CSS custom properties — all hex values hardcoded
 * - Table-based layout only (Outlook compatibility)
 * - DM Sans / DM Mono with full fallback stacks
 * - Max width 600px
 * - Plain-text auto-derived by resend.ts htmlToText()
 * - Every actionable email uses signed one-click URLs (not /login redirects)
 */

import { EmailLayout, Paragraph, MetricBox, KeyValueTable, Mono, ActionButtonGroup, AlertBadge, SectionDivider } from './template'
import { sendEmail } from './resend'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://usersessions.io'

// ─────────────────────────────────────────────────────────────────────
// 1. ONBOARDING — Welcome / Setup Confirmation
// ─────────────────────────────────────────────────────────────────────
export async function sendWelcomeEmail(to: string, name: string) {
  const html = EmailLayout({
    title: 'Welcome to UserSessions',
    previewText: 'You\'re set up. Your session data is now being watched.',
    headline: 'Welcome to UserSessions',
    subhead: 'The AI action layer for session data you already collect.',
    cta: { label: 'Connect your first source →', href: SITE + '/connect' },
    children: [
      Paragraph('Hi ' + (name || 'there') + ','),
      Paragraph('UserSessions is live on your account. We don\'t capture new data — we work with the FullStory, Datadog, PostHog, or Hotjar data you already have.'),
      Paragraph('Next step: connect your session source and authorize Composio so we can route findings to Slack, Jira, or your CRM. The whole setup takes about 15 minutes.'),
    ].join(''),
  })
  return sendEmail({ to, subject: 'Welcome to UserSessions — connect your first source', html })
}

// ─────────────────────────────────────────────────────────────────────
// 2. ONBOARDING — First Finding Detected (activation moment)
// ─────────────────────────────────────────────────────────────────────
export async function sendFirstFindingDetected(
  to: string,
  finding: { id: string; severity: string; summary: string; approveUrl: string; dismissUrl: string }
) {
  const html = EmailLayout({
    title: 'Your first finding is ready',
    previewText: 'UserSessions just caught something in your sessions.',
    headline: 'Your first finding is ready.',
    subhead: 'This is the moment it starts working.',
    footerNote: 'This is the first finding UserSessions has surfaced for your account.',
    children: [
      Paragraph('We just finished analyzing your first batch of sessions. Here\'s what we found:'),
      KeyValueTable([
        ['Severity', finding.severity],
        ['Summary', finding.summary],
      ]),
      Paragraph('You can approve the recommended action or dismiss this finding below. One click — no login required.'),
      ActionButtonGroup(
        { label: '✅ Approve action', href: finding.approveUrl },
        { label: 'Dismiss', href: finding.dismissUrl }
      ),
    ].join(''),
  })
  return sendEmail({ to, subject: 'Your first UserSessions finding is ready', html })
}

// ─────────────────────────────────────────────────────────────────────
// 3. TRANSACTIONAL — Finding Escalation (Slack unactioned → email)
// ─────────────────────────────────────────────────────────────────────
export async function sendFindingEscalation(
  to: string,
  finding: { id: string; severity: string; summary: string; accountArr: string; approveUrl: string; dismissUrl: string }
) {
  const html = EmailLayout({
    title: finding.severity + ' finding still awaiting approval',
    previewText: 'A finding in your queue hasn\'t been actioned yet.',
    headline: AlertBadge(finding.severity) + ' &nbsp;Still waiting.',
    subhead: 'This finding was sent to Slack but hasn\'t been actioned.',
    cta: undefined,
    children: [
      KeyValueTable([
        ['Severity', finding.severity],
        ['ARR at risk', finding.accountArr],
        ['Finding', finding.summary],
      ]),
      Paragraph('This finding has been in your queue past the configured window. Approve or dismiss it now — one click, no login required.'),
      ActionButtonGroup(
        { label: '✅ Approve', href: finding.approveUrl },
        { label: '✗ Dismiss', href: finding.dismissUrl }
      ),
    ].join(''),
  })
  return sendEmail({
    to,
    subject: '[Action required] ' + finding.severity + ' finding has been waiting',
    html,
  })
}

// ─────────────────────────────────────────────────────────────────────
// 4. TRANSACTIONAL — Action Failed
// ─────────────────────────────────────────────────────────────────────
export async function sendActionFailed(
  to: string,
  action: { id: string; toolkit: string; composioAction: string; errorDetail: string }
) {
  const html = EmailLayout({
    title: 'Action failed — ' + action.toolkit,
    previewText: 'We couldn\'t complete an action in your pipeline.',
    headline: 'An action failed.',
    subhead: 'We couldn\'t complete ' + action.composioAction + ' via ' + action.toolkit + '.',
    cta: { label: 'Review in Audit Log →', href: SITE + '/audit?action=' + action.id },
    children: [
      KeyValueTable([
        ['Toolkit', action.toolkit],
        ['Action', Mono(action.composioAction)],
        ['Error', action.errorDetail],
      ]),
      Paragraph('This action has not been billed. You can retry it from the Audit Log or dismiss it if the underlying issue has been resolved.'),
    ].join(''),
  })
  return sendEmail({
    to,
    subject: 'Action failed: ' + action.toolkit + ' / ' + action.composioAction,
    html,
  })
}

// ─────────────────────────────────────────────────────────────────────
// 5. TRANSACTIONAL — Integration Disconnected (immediate, not batched)
// ─────────────────────────────────────────────────────────────────────
export async function sendIntegrationDisconnected(
  to: string,
  opts: { source: string; reconnectUrl: string }
) {
  const html = EmailLayout({
    title: opts.source + ' disconnected',
    previewText: 'Session monitoring has paused — action required.',
    headline: opts.source + ' is disconnected.',
    subhead: 'Every session missed while disconnected is invisible to the whole pipeline.',
    children: [
      Paragraph('We lost connection to ' + Mono(opts.source) + '. Session ingestion and analysis has paused for this source.'),
      Paragraph('Reconnect it now to resume monitoring. This link doesn\'t require you to log in first.'),
      ActionButtonGroup(
        { label: '🔗 Reconnect ' + opts.source, href: opts.reconnectUrl },
        { label: 'Open dashboard', href: SITE + '/connect' }
      ),
    ].join(''),
  })
  return sendEmail({
    to,
    subject: 'Action required: ' + opts.source + ' disconnected',
    html,
  })
}

// ─────────────────────────────────────────────────────────────────────
// 6. BILLING — Payment Failed
// ─────────────────────────────────────────────────────────────────────
export async function sendPaymentFailedEmail(to: string) {
  const html = EmailLayout({
    title: 'Payment failed',
    previewText: 'Your payment didn\'t go through — we\'ll retry automatically.',
    headline: 'Payment failed.',
    subhead: 'Nothing is lost — the charge will be retried automatically.',
    cta: { label: 'Update payment method →', href: SITE + '/settings' },
    children: [
      Paragraph('Your most recent UserSessions payment didn\'t go through. Your plan stays active while we retry.'),
      Paragraph('If payment keeps failing after our retry attempts, your account moves to the free tier and live monitoring pauses. Update your payment method to keep everything running.'),
    ].join(''),
  })
  return sendEmail({ to, subject: 'Payment failed — action needed', html })
}

// ─────────────────────────────────────────────────────────────────────
// 7. BILLING — Usage Threshold (80% or 100%)
// ─────────────────────────────────────────────────────────────────────
export async function sendUsageThreshold(
  to: string,
  percent: 80 | 100,
  opts: { used: number; included: number }
) {
  const overage = percent === 100
  const html = EmailLayout({
    title: percent + '% of included actions used',
    previewText: overage
      ? 'You\'ve used all included actions. Overages apply.'
      : 'You\'re at 80% of your included monthly actions.',
    headline: percent + '% used.',
    subhead: overage
      ? 'Additional executed actions are now billed at the overage rate.'
      : 'You\'re approaching your monthly action limit.',
    cta: { label: 'View usage in Settings →', href: SITE + '/settings' },
    children: [
      MetricBox('Actions used', opts.used.toLocaleString()),
      MetricBox('Included in plan', opts.included.toLocaleString()),
      overage
        ? Paragraph('You\'ve used all included actions this period. Additional executed actions are billed at $0.50 each. Dismissed findings and failed actions are never billed.')
        : Paragraph('At current pace you\'ll exceed your included actions before the end of the billing period. Failed actions and dismissed findings don\'t count toward this limit.'),
    ].join(''),
  })
  return sendEmail({
    to,
    subject: 'UserSessions: ' + percent + '% of included actions used',
    html,
  })
}

// ─────────────────────────────────────────────────────────────────────
// 8. BILLING — Monthly Invoice Summary
// ─────────────────────────────────────────────────────────────────────
export async function sendMonthlyInvoice(
  to: string,
  opts: {
    periodLabel: string      // e.g. "July 2026"
    baseFee: string          // e.g. "$499"
    executedActions: number  // only executed+success — never dismissed or failed
    overage: string          // e.g. "$0" or "$45.00"
    total: string            // e.g. "$544.00"
  }
) {
  const html = EmailLayout({
    title: 'Invoice — ' + opts.periodLabel,
    previewText: 'Your UserSessions invoice for ' + opts.periodLabel,
    headline: opts.periodLabel + ' invoice.',
    subhead: 'Base platform fee + executed actions.',
    cta: { label: 'Open billing settings →', href: SITE + '/settings' },
    children: [
      KeyValueTable([
        ['Period', opts.periodLabel],
        ['Base platform fee', opts.baseFee],
        ['Executed actions', opts.executedActions.toLocaleString()],
        ['Overage', opts.overage],
        ['Total', opts.total],
      ]),
      Paragraph('Only successfully executed actions are billed. Dismissed findings, failed actions, and auto-approved routine actions that failed to execute are excluded.'),
    ].join(''),
    footerNote: 'Invoice generated automatically at end of billing period.',
  })
  return sendEmail({
    to,
    subject: 'UserSessions invoice — ' + opts.periodLabel,
    html,
  })
}

// ─────────────────────────────────────────────────────────────────────
// 9. SECURITY — Policy Autonomy Increased (sent to all admins)
// ─────────────────────────────────────────────────────────────────────
export async function sendPolicyAutonomyChanged(
  to: string,
  opts: { ruleName: string; changedBy: string; previousLevel: string; newLevel: string }
) {
  const html = EmailLayout({
    title: 'Policy rule changed — autonomy increased',
    previewText: 'A policy rule now auto-executes at a higher threshold.',
    headline: 'Autonomy increased.',
    subhead: 'A policy rule now auto-executes actions it previously required you to approve.',
    cta: { label: 'Review policy rules →', href: SITE + '/settings' },
    children: [
      KeyValueTable([
        ['Rule', opts.ruleName],
        ['Changed by', opts.changedBy],
        ['Previous level', opts.previousLevel],
        ['New level', opts.newLevel],
      ]),
      Paragraph('This email is sent to all admins whenever autonomy is increased — not just the person who made the change. If this change wasn\'t expected, review and revert the policy rule immediately.'),
    ].join(''),
    footerNote: 'This is a security notification. All admins on this account have been notified.',
  })
  return sendEmail({
    to,
    subject: '[Security] Policy rule autonomy increased — ' + opts.ruleName,
    html,
  })
}

// ─────────────────────────────────────────────────────────────────────
// 10. SECURITY — New Team Member Added
// ─────────────────────────────────────────────────────────────────────
export async function sendTeamMemberAdded(
  to: string,
  opts: { newMemberEmail: string; addedBy: string }
) {
  const html = EmailLayout({
    title: 'New team member added',
    previewText: opts.newMemberEmail + ' has been added to your UserSessions account.',
    headline: 'New team member.',
    subhead: opts.newMemberEmail + ' now has access to your account.',
    cta: { label: 'Manage team →', href: SITE + '/team' },
    children: [
      KeyValueTable([
        ['New member', opts.newMemberEmail],
        ['Added by', opts.addedBy],
      ]),
      Paragraph('If you didn\'t authorize this, review your team members immediately and remove access if needed.'),
    ].join(''),
  })
  return sendEmail({
    to,
    subject: 'Team update: ' + opts.newMemberEmail + ' added to your account',
    html,
  })
}

// ─────────────────────────────────────────────────────────────────────
// 11. DIGEST — Weekly Account Digest
// Doubles as renewal-call prep — mirrors the Accounts screen
// ─────────────────────────────────────────────────────────────────────
export async function sendWeeklyDigest(
  to: string,
  stats: {
    findingsDetected: number
    actionsExecuted: number
    arrMonitored: string
    topAccount: string
  }
) {
  const html = EmailLayout({
    title: 'Weekly account digest',
    previewText: stats.actionsExecuted + ' actions executed this week across your monitored accounts.',
    headline: 'This week.',
    subhead: 'What UserSessions caught and acted on.',
    cta: { label: 'Open Accounts →', href: SITE + '/accounts' },
    children: [
      SectionDivider('Activity'),
      MetricBox('Findings detected', stats.findingsDetected.toLocaleString()),
      MetricBox('Actions executed', stats.actionsExecuted.toLocaleString()),
      MetricBox('ARR currently monitored', stats.arrMonitored),
      SectionDivider('Top account'),
      Paragraph('The account with the most friction activity this week: <strong>' + stats.topAccount + '</strong>.'),
      Paragraph('Full detail — including per-account findings, execution history, and ARR trends — is in the Accounts screen.'),
    ].join(''),
  })
  return sendEmail({
    to,
    subject: 'UserSessions weekly — ' + stats.actionsExecuted + ' actions executed',
    html,
  })
}

// ─────────────────────────────────────────────────────────────────────
// 12. ONBOARDING — Pilot Check-in (GTM concierge motion)
// Flagged as manual_send: true — UI offers "Send now" button
// ─────────────────────────────────────────────────────────────────────
export async function sendPilotCheckin(
  to: string,
  opts: {
    companyName: string
    actionsExecuted: number
    arrProtected: string
    manualSend: boolean  // if true, was triggered manually from admin UI
  }
) {
  const html = EmailLayout({
    title: 'Mid-pilot check-in — ' + opts.companyName,
    previewText: 'Halfway through your UserSessions pilot. Here\'s what we\'ve done.',
    headline: 'Pilot check-in.',
    subhead: 'Here\'s what UserSessions has done for ' + opts.companyName + ' so far.',
    cta: { label: 'Discuss upgrading →', href: SITE + '/contact' },
    children: [
      KeyValueTable([
        ['Actions executed', opts.actionsExecuted.toLocaleString()],
        ['ARR protected', opts.arrProtected],
        ['Company', opts.companyName],
      ]),
      Paragraph('You\'re roughly halfway through your pilot. The numbers above reflect what UserSessions has caught and acted on without you needing to touch it.'),
      Paragraph('If you\'d like to talk about what the steady-state version looks like, or what the path to a full rollout looks like, let\'s get 30 minutes on the calendar.'),
    ].join(''),
    footerNote: opts.manualSend ? 'Sent personally — not automated.' : undefined,
  })
  return sendEmail({
    to,
    subject: 'Mid-pilot check-in: ' + opts.actionsExecuted + ' actions executed for ' + opts.companyName,
    html,
  })
}

// ─────────────────────────────────────────────────────────────────────
// Keep backward-compat exports for any existing callers
// ─────────────────────────────────────────────────────────────────────
export async function sendCriticalAlert(
  to: string,
  issue: { id: string; severity: string; description: string; accountArr: string }
) {
  return sendFindingEscalation(to, {
    id: issue.id,
    severity: issue.severity,
    summary: issue.description,
    accountArr: issue.accountArr,
    approveUrl: SITE + '/?finding=' + issue.id,
    dismissUrl: SITE + '/?finding=' + issue.id + '&dismiss=1',
  })
}

export async function sendApprovalReminder(to: string, pendingCount: number) {
  const html = EmailLayout({
    title: 'Pending approvals',
    headline: pendingCount + ' pending approval' + (pendingCount !== 1 ? 's' : ''),
    subhead: 'Findings in your queue are waiting for a decision.',
    cta: { label: 'Review queue →', href: SITE + '/' },
    children: Paragraph('You have ' + pendingCount + ' finding' + (pendingCount !== 1 ? 's' : '') + ' awaiting approval. Review them in your dashboard queue.'),
  })
  return sendEmail({ to, subject: pendingCount + ' pending approvals in UserSessions', html })
}

export async function sendHealthAlert(to: string, integration: string, errorMsg: string) {
  return sendIntegrationDisconnected(to, {
    source: integration,
    reconnectUrl: SITE + '/connect',
  })
}

export async function sendPilotSummary(
  to: string,
  company: string,
  roiMetrics: { actionsSaved: number; bugCatchValue: string }
) {
  return sendPilotCheckin(to, {
    companyName: company,
    actionsExecuted: roiMetrics.actionsSaved,
    arrProtected: roiMetrics.bugCatchValue,
    manualSend: false,
  })
}

export async function sendPaymentReceiptEmail(
  to: string,
  amount: string | null,
  currency: string,
  plan: string,
  reference: string
) {
  const { EmailLayout: EL, KeyValueTable: KVT } = await import('./template')
  const html = EL({
    title: 'Payment received',
    headline: 'Payment received.',
    subhead: 'Your subscription is active.',
    cta: { label: 'Open dashboard →', href: SITE },
    children: KVT([
      ['Amount', amount ? amount + ' ' + currency : '—'],
      ['Plan', plan],
      ['Reference', reference],
    ]),
  })
  return sendEmail({ to, subject: 'Payment received — UserSessions', html })
}

// ─────────────────────────────────────────────────────────────────────
// 15. BILLING — Failed Payment Notice (with update link)
// ─────────────────────────────────────────────────────────────────────
export async function sendFailedPaymentNotice(
  to: string,
  invoice: { amount: string; updateUrl: string }
) {
  const html = EmailLayout({
    title: 'Payment failed — update required',
    previewText: 'Your most recent payment to UserSessions failed.',
    headline: AlertBadge('Action Required') + ' &nbsp;Payment failed.',
    subhead: 'Your most recent payment could not be processed.',
    cta: { label: 'Update payment method', href: invoice.updateUrl },
    children: [
      Paragraph(`We couldn't process the charge for ${invoice.amount}.`),
      Paragraph('Please update your payment method to avoid any interruption to your session processing.'),
    ].join(''),
  })
  return sendEmail({ to, subject: 'Action required: payment failed', html })
}

// ─────────────────────────────────────────────────────────────────────
// 16. BILLING — Usage Threshold Alert (80% / 100%)
// ─────────────────────────────────────────────────────────────────────
export async function sendUsageThresholdEmail(
  to: string,
  usage: { threshold: '80%' | '100%'; currentActions: number; tier: string; calcUrl: string }
) {
  const html = EmailLayout({
    title: `Approaching usage allotment (${usage.threshold})`,
    previewText: `You've used ${usage.threshold} of your included actions this month.`,
    headline: `Usage at ${usage.threshold}`,
    subhead: `You've used ${usage.threshold} of your ${usage.tier} tier included actions.`,
    cta: { label: 'Calculate projected overage', href: usage.calcUrl },
    children: [
      Paragraph(`Your account has executed ${usage.currentActions.toLocaleString()} automated actions this billing period.`),
      Paragraph(
        usage.threshold === '100%'
          ? "Additional actions will now be billed at your tier's overage rate."
          : "You are approaching your included allotment."
      ),
      Paragraph('You can project your end-of-month cost or preview an upgrade using the calculator below:'),
    ].join(''),
  })
  return sendEmail({ to, subject: `Notice: UserSessions usage at ${usage.threshold}`, html })
}

// ─────────────────────────────────────────────────────────────────────
// 17. LIFECYCLE — Pilot / Contract Renewal Reminder
// ─────────────────────────────────────────────────────────────────────
export async function sendRenewalReminder(
  to: string,
  renewal: { type: 'pilot' | 'contract'; endDate: string; renewUrl: string }
) {
  const html = EmailLayout({
    title: `Your ${renewal.type} is ending soon`,
    previewText: `Your UserSessions ${renewal.type} concludes on ${renewal.endDate}.`,
    headline: `Your ${renewal.type} is wrapping up.`,
    subhead: `Your current agreement ends on ${renewal.endDate}.`,
    cta: { label: 'Discuss next steps', href: renewal.renewUrl },
    children: [
      Paragraph(`Your ${renewal.type === 'pilot' ? 'pilot program' : 'annual contract'} with UserSessions is scheduled to end on ${renewal.endDate}.`),
      Paragraph('We\'d love to review the findings and automation value we\'ve delivered, and discuss the best structure for your next phase.'),
    ].join(''),
  })
  return sendEmail({ to, subject: `Upcoming UserSessions ${renewal.type} renewal`, html })
}
