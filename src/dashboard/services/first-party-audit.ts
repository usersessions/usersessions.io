/**
 * First-Party Heuristic Site Audit ("cold start" findings).
 *
 * REPLACES: services/initial-audit.ts (which used ScrapeGraphAI — a third-party
 * scraper with no visibility into dynamic content or auth-walled pages).
 *
 * NEW APPROACH: Uses data we already collect first-party via capture.js:
 *   1. Real page URLs and session metadata from us_sessions
 *   2. Rage-click and dead-click signals from us_heatmap_aggregates
 *   3. Any sentinel-sourced findings already in us_findings
 *
 * Cold-start fallback: if capture.js was just installed and no sessions have
 * arrived yet, we perform a lightweight safeFetch of the homepage (title +
 * meta description only) as a minimal seed — no third-party API required.
 *
 * Callers must have already verified that the caller owns `clientId`.
 */
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'
import { safeFetch, isPublicHttpUrl } from '@/services/ssrf-protector'

export type FirstPartyAuditResult =
  | { ok: true; findingsCount: number; skipped?: string; source: 'first_party' | 'meta_fallback' }
  | { ok: false; error: string }

const CATEGORIES = new Set(['bug', 'friction', 'billing', 'security'])
const SEVERITIES  = new Set(['P0', 'P1', 'P2', 'P3'])

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extracts <title> and <meta name="description"> from raw HTML.
 * Fast & safe — no HTML parser needed.
 */
function extractMetaContext(html: string): string {
  const titleMatch  = html.match(/<title[^>]*>([^<]{0,200})<\/title>/i)
  const descMatch   = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{0,500})["']/i)
                  ?? html.match(/<meta[^>]+content=["']([^"']{0,500})["'][^>]+name=["']description["']/i)
  const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{0,500})["']/i)

  const parts: string[] = []
  if (titleMatch?.[1])  parts.push(`Page title: ${titleMatch[1].trim()}`)
  if (descMatch?.[1])   parts.push(`Meta description: ${descMatch[1].trim()}`)
  if (ogDescMatch?.[1]) parts.push(`OG description: ${ogDescMatch[1].trim()}`)
  return parts.join('\n') || 'No metadata found.'
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function runFirstPartyAudit(params: {
  clientId: string
  websiteUrl?: string
}): Promise<FirstPartyAuditResult> {
  const { clientId, websiteUrl } = params
  const supabase = createServiceClient()

  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: 'ANTHROPIC_API_KEY not set' }
  }

  // ── Idempotency guard ──────────────────────────────────────────────────────
  const { data: existing } = await supabase
    .from('us_clients')
    .select('audit_status')
    .eq('id', clientId)
    .maybeSingle()
  if (existing?.audit_status === 'done')    return { ok: true, findingsCount: 0, skipped: 'already_done',    source: 'first_party' }
  if (existing?.audit_status === 'running') return { ok: true, findingsCount: 0, skipped: 'already_running', source: 'first_party' }

  await supabase.from('us_clients').update({ audit_status: 'running' }).eq('id', clientId)

  try {
    // ── 1. Gather first-party capture.js data ──────────────────────────────
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const [sessionsRes, heatmapRes, sentinelRes] = await Promise.all([
      // Real sessions beaconed by capture.js in the last 24h
      supabase
        .from('us_sessions')
        .select('page_url, duration_ms, started_at, raw_metadata')
        .eq('client_id', clientId)
        .eq('source', 'capture')
        .gte('started_at', since24h)
        .order('started_at', { ascending: false })
        .limit(50),

      // Heatmap aggregates: rage clicks, dead clicks
      supabase
        .from('us_heatmap_aggregates')
        .select('page_url, element_selector, event_type, count')
        .eq('client_id', clientId)
        .in('event_type', ['rage_click', 'dead_click'])
        .order('count', { ascending: false })
        .limit(20),

      // Any sentinel findings (real issues already caught)
      supabase
        .from('us_findings')
        .select('category, severity, summary')
        .eq('client_id', clientId)
        .eq('source', 'sentinel')
        .neq('status', 'dismissed')
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    const sessions       = sessionsRes.data  ?? []
    const heatmapSignals = heatmapRes.data   ?? []
    const sentinelFinds  = sentinelRes.data  ?? []

    // ── 2. Decide: first-party data vs. meta-tag fallback ─────────────────
    const hasFirstPartyData = sessions.length > 0 || heatmapSignals.length > 0
    let auditContext: string
    let auditSource: 'first_party' | 'meta_fallback' = 'first_party'

    if (hasFirstPartyData) {
      // Build a structured context from real captured data
      const pageFrequency: Record<string, number> = {}
      for (const s of sessions) {
        if (s.page_url) pageFrequency[s.page_url] = (pageFrequency[s.page_url] ?? 0) + 1
      }
      const topPages = Object.entries(pageFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([url, count]) => `  • ${url} (${count} session${count > 1 ? 's' : ''})`)
        .join('\n')

      const rageSummary = heatmapSignals
        .filter(h => h.event_type === 'rage_click')
        .slice(0, 5)
        .map(h => `  • ${h.count}× rage-click on "${h.element_selector}" at ${h.page_url}`)
        .join('\n')

      const deadSummary = heatmapSignals
        .filter(h => h.event_type === 'dead_click')
        .slice(0, 5)
        .map(h => `  • ${h.count}× dead-click on "${h.element_selector}" at ${h.page_url}`)
        .join('\n')

      const existingFinds = sentinelFinds
        .slice(0, 5)
        .map(f => `  • [${f.severity}] ${f.summary}`)
        .join('\n')

      auditContext = [
        `TOTAL SESSIONS LAST 24H: ${sessions.length}`,
        '',
        topPages    ? `TOP PAGES BY TRAFFIC:\n${topPages}` : '',
        rageSummary ? `RAGE-CLICK SIGNALS (frustrated users clicking repeatedly):\n${rageSummary}` : '',
        deadSummary ? `DEAD-CLICK SIGNALS (users clicking non-interactive elements):\n${deadSummary}` : '',
        existingFinds ? `ALREADY-DETECTED ISSUES (do NOT repeat these):\n${existingFinds}` : '',
      ].filter(Boolean).join('\n\n')
    } else {
      // Cold-start: no sessions yet — use homepage meta as minimal seed
      auditSource = 'meta_fallback'
      let metaContext = 'No metadata could be fetched.'

      if (websiteUrl && await isPublicHttpUrl(websiteUrl)) {
        try {
          const res = await safeFetch(websiteUrl, {
            headers: {
              'User-Agent': 'UserSessions-Auditor/2.0 (+https://usersessions.io/bot)',
              'Accept': 'text/html',
            },
          })
          if (res.ok) {
            const html = await res.text()
            metaContext = extractMetaContext(html)
          }
        } catch {
          // best-effort only
        }
      }

      auditContext = [
        'NOTE: capture.js was just installed. No real session data has been collected yet.',
        'This is a minimal cold-start audit based on homepage metadata only.',
        'A more accurate audit will run automatically once real sessions arrive.',
        '',
        'HOMEPAGE METADATA:',
        metaContext,
      ].join('\n')
    }

    // ── 3. Ask Haiku to generate friction findings ─────────────────────────
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const aiResponse = await anthropic.messages.create({
      // Haiku: fast one-shot analysis, not the real-time reasoning path.
      model: process.env.ANTHROPIC_HAIKU_MODEL ?? 'claude-haiku-4-5',
      max_tokens: 1024,
      system: 'You return only valid JSON. Never wrap it in markdown code fences.',
      messages: [{
        role: 'user',
        content: `You are a senior UX engineer reviewing real user behaviour data captured by a session-recording script.
Based ONLY on the data below, identify 2-3 actionable UX friction findings.

Rules:
- Use only what the data tells you. Do not invent issues.
- If data is sparse (cold start), generate 1 generic but plausible finding about first-impression clarity.
- Each finding must have:
    category: 'friction' | 'bug' | 'billing' | 'security'
    severity: 'P0' | 'P1' | 'P2' | 'P3'   (P2/P3 for heuristics, P0/P1 for rage-click evidence)
    summary: one sentence starting with "[First-Party Audit]"

Output ONLY: { "findings": [ { "category": "...", "severity": "...", "summary": "..." } ] }

--- DATA ---
${auditContext}`,
      }],
    })

    let text = aiResponse.content[0]?.type === 'text' ? aiResponse.content[0].text.trim() : '{}'
    // Strip any accidental markdown fences
    text = text.replace(/^```(?:json)?/im, '').replace(/```$/m, '').trim()
    const parsed = JSON.parse(text)
    const generated: any[] = Array.isArray(parsed?.findings) ? parsed.findings : []

    const valid = generated
      .filter(f => CATEGORIES.has(f?.category) && SEVERITIES.has(f?.severity) && typeof f?.summary === 'string')
      .slice(0, 5)

    if (valid.length === 0) {
      await supabase.from('us_clients').update({ audit_status: 'done' }).eq('id', clientId)
      return { ok: true, findingsCount: 0, source: auditSource }
    }

    // ── 4. Attach findings to a synthetic session ──────────────────────────
    const { data: session, error: sessionError } = await supabase
      .from('us_sessions')
      .insert({
        client_id: clientId,
        source: 'capture',              // first-party source sentinel
        source_session_id: `fp-audit-${Date.now()}`,
        end_user_id: 'system-auditor',
        started_at: new Date().toISOString(),
        page_url: websiteUrl ? new URL(websiteUrl).pathname : '/',
        raw_metadata: {
          auditor: 'first_party',
          sessions_analysed: sessions.length,
          heatmap_signals: heatmapSignals.length,
          audit_source: auditSource,
        },
      })
      .select('id')
      .single()
    if (sessionError || !session) {
      throw new Error(`Failed to create audit session: ${sessionError?.message}`)
    }

    const { error: findingsError } = await supabase.from('us_findings').insert(
      valid.map(f => ({
        client_id: clientId,
        session_id: session.id,
        category: f.category,
        severity: f.severity,
        summary: String(f.summary).slice(0, 500),
        confidence: auditSource === 'first_party' ? 0.85 : 0.60,
        status: 'pending',
      })),
    )
    if (findingsError) throw new Error(`Failed to insert findings: ${findingsError.message}`)

    await supabase.from('us_clients').update({ audit_status: 'done' }).eq('id', clientId)
    return { ok: true, findingsCount: valid.length, source: auditSource }

  } catch (error: any) {
    console.error('[first-party-audit] Error:', error?.message ?? error)
    await supabase.from('us_clients').update({ audit_status: 'error' }).eq('id', clientId)
    return { ok: false, error: error?.message ?? 'Internal Server Error' }
  }
}
