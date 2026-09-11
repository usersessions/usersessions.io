/**
 * UserSessions.io Email Design System v2.0 — Premium Text-Forward.
 * Pure string-based HTML generation: no JSX, no react-dom/server.
 */

const T = {
  bg: '#F8F7F4',
  paper: '#FFFFFF',
  ink: '#1A150F',
  mute: '#7A6E63',
  ghost: '#B0A898',
  line: '#E2D9C8',
}

const SANS = "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
const MONO = "'DM Mono', 'SF Mono', Monaco, Consolas, 'Courier New', monospace"
const SERIF = "'Instrument Serif', Georgia, 'Times New Roman', serif"
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://usersessions.io'

interface EmailProps {
  title: string
  previewText?: string
  headline: string
  subhead?: string
  children: string
  cta?: { label: string; href: string }
  footerNote?: string
}

export function EmailLayout({ title, previewText, headline, subhead, children, cta, footerNote }: EmailProps): string {
  const address = process.env.EMAIL_POSTAL_ADDRESS || ''
  const ctaHtml = cta ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:40px"><tbody><tr><td align="center"><a href="' + cta.href + '" style="display:inline-block;background-color:' + T.ink + ';color:#fff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px">' + cta.label + '</a></td></tr></tbody></table>' : ''
  const subheadHtml = subhead ? '<p style="margin:12px 0 0;font-size:16px;color:' + T.mute + ';line-height:1.5;font-weight:500">' + subhead + '</p>' : ''
  const previewHtml = previewText ? '<div style="display:none;max-height:0;overflow:hidden">' + previewText + '</div>' : ''
  const footerNoteHtml = footerNote ? '<p style="margin:0 0 8px;font-size:13px;color:' + T.ghost + ';font-weight:500">' + footerNote + '</p>' : ''
  const addressPart = address ? ' &bull; ' + address : ''

  return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>' + title + '</title><style>@media only screen and (max-width:600px){.card{padding:32px 24px!important}.headline{font-size:24px!important}}</style></head><body style="margin:0;padding:0;background-color:' + T.bg + ';font-family:' + SANS + '">' + previewHtml + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:' + T.bg + '"><tbody><tr><td align="center" style="padding:48px 16px 64px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px"><tbody><tr><td align="center" style="padding-bottom:32px"><a href="' + SITE + '" style="font-family:' + SERIF + ';font-style:italic;font-size:28px;color:' + T.ink + ';text-decoration:none;letter-spacing:-0.02em">usersessions</a></td></tr><tr><td class="card" style="background-color:' + T.paper + ';border:1px solid ' + T.line + ';border-radius:24px;padding:48px 40px;box-shadow:0 4px 24px rgba(20,15,0,0.04)"><h1 class="headline" style="margin:0;font-size:28px;font-weight:800;color:' + T.ink + ';letter-spacing:-0.03em;line-height:1.2">' + headline + '</h1>' + subheadHtml + '<div style="margin:32px 0;border-top:1px solid ' + T.line + '"></div><div style="font-size:15px;color:' + T.ink + ';line-height:1.6;font-weight:500">' + children + '</div>' + ctaHtml + '</td></tr><tr><td align="center" style="padding-top:32px"><p style="margin:0 0 8px;font-size:13px;color:' + T.mute + ';font-weight:500">UserSessions.io — AI Action Layer for Session Data</p>' + footerNoteHtml + '<p style="margin:0;font-size:12px;color:' + T.ghost + '"><a href="' + SITE + '/settings" style="color:' + T.ghost + ';text-decoration:underline">Manage preferences</a>' + addressPart + '</p></td></tr></tbody></table></td></tr></tbody></table></body></html>'
}

export function Paragraph(text: string): string {
  return '<p style="margin:0 0 16px;color:' + T.ink + ';line-height:1.6">' + text + '</p>'
}

export function Mono(text: string): string {
  return '<span style="font-family:' + MONO + ';font-size:0.9em;padding:2px 4px;background-color:' + T.bg + ';border-radius:4px;color:' + T.ink + '">' + text + '</span>'
}

export function MetricBox(label: string, value: string): string {
  return '<div style="padding:16px;background-color:' + T.bg + ';border-radius:12px;border:1px solid ' + T.line + ';margin-bottom:16px"><div style="font-family:' + MONO + ';font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:' + T.mute + ';margin-bottom:8px">' + label + '</div><div style="font-family:' + SERIF + ';font-size:32px;color:' + T.ink + ';line-height:1">' + value + '</div></div>'
}

export function KeyValueTable(rows: Array<[string, string]>): string {
  const trs = rows.map(([key, val], i) => '<tr><td style="padding:12px 16px;border-top:' + (i === 0 ? 'none' : '1px solid ' + T.line) + ';color:' + T.mute + ';font-size:13px;font-weight:600">' + key + '</td><td style="padding:12px 16px;border-top:' + (i === 0 ? 'none' : '1px solid ' + T.line) + ';color:' + T.ink + ';font-size:13px;font-weight:700" align="right">' + val + '</td></tr>').join('')
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ' + T.line + ';border-radius:12px;overflow:hidden;margin:24px 0"><tbody>' + trs + '</tbody></table>'
}

/**
 * ActionButtonGroup — side-by-side action buttons for email.
 * Primary button (approve) has amber/orange fill; secondary (dismiss) is outlined.
 * Uses a table layout for email-client compatibility (no flexbox).
 */
export function ActionButtonGroup(
  primary: { label: string; href: string },
  secondary: { label: string; href: string }
): string {
  const primaryBtn = '<a href="' + primary.href + '" style="display:inline-block;background-color:#C05621;color:#ffffff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;font-family:' + SANS + ';letter-spacing:-0.01em">' + primary.label + '</a>'
  const secondaryBtn = '<a href="' + secondary.href + '" style="display:inline-block;background-color:transparent;color:#7A6E63;border:1.5px solid #E2D9C8;padding:11px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;font-family:' + SANS + ';letter-spacing:-0.01em">' + secondary.label + '</a>'
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px"><tbody><tr><td><table role="presentation" cellpadding="0" cellspacing="0"><tbody><tr><td style="padding-right:12px">' + primaryBtn + '</td><td>' + secondaryBtn + '</td></tr></tbody></table></td></tr></tbody></table>'
}

/** Severity badge rendered as a colored inline table cell — no CSS vars, hardcoded hex. */
const SEV_COLORS: Record<string, { bg: string; text: string }> = {
  P0: { bg: '#FEE2E2', text: '#991B1B' },
  P1: { bg: '#FEF3C7', text: '#92400E' },
  P2: { bg: '#FEF9C3', text: '#854D0E' },
  P3: { bg: '#DBEAFE', text: '#1E3A8A' },
}
export function AlertBadge(severity: string): string {
  const c = SEV_COLORS[severity] ?? { bg: '#F3F4F6', text: '#374151' }
  return '<span style="display:inline-block;padding:3px 10px;border-radius:99px;background-color:' + c.bg + ';color:' + c.text + ';font-family:' + MONO + ';font-size:11px;font-weight:700;letter-spacing:0.06em">' + severity + '</span>'
}

/** Labeled section divider for multi-section emails like weekly digest. */
export function SectionDivider(label: string): string {
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0 16px"><tbody><tr><td style="border-top:1px solid #E2D9C8;padding-top:16px;font-family:' + MONO + ';font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#B0A898;font-weight:600">' + label + '</td></tr></tbody></table>'
}
