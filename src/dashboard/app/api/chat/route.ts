import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/chat
 *
 * Body: { message: string, clientId?: string }
 *
 * Calls Gemini with context from the user's actual analytics data.
 * Returns: { answer: string, sessions?: { id: string, created_at: string }[] }
 */

export const dynamic = 'force-dynamic'

// Simple intent classifier — returns data-fetch hints
function classifyIntent(message: string): {
  needsSessions: boolean
  needsFindings: boolean
  needsRageClicks: boolean
  needsPages: boolean
} {
  const lower = message.toLowerCase()
  return {
    needsSessions: /session|replay|record|watch|visit/.test(lower),
    needsFindings: /finding|issue|bug|problem|error|friction/.test(lower),
    needsRageClicks: /rage|click|frustrat|angry/.test(lower),
    needsPages: /page|url|path|route|checkout|pricing|landing/.test(lower),
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let body: { message?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 4000) : ''
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // The workspace comes from the session, never from the request body.
    const { data: client } = await supabase
      .from('us_clients')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle()
    const clientId = client?.id ?? null

    const intent = classifyIntent(message)
    const contextParts: string[] = []
    let relatedSessions: any[] = []

    if (clientId) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      if (intent.needsSessions || intent.needsRageClicks) {
        const { data: sessions } = await supabase
          .from('us_sessions')
          .select('id, ingested_at, source, rage_click_count, error_count, page_url')
          .eq('client_id', clientId)
          .gte('ingested_at', sevenDaysAgo)
          .order('rage_click_count', { ascending: false })
          .limit(20)

        if (sessions?.length) {
          relatedSessions = sessions.slice(0, 5).map(s => ({
            id: s.id,
            created_at: s.ingested_at,
            rage_click_count: s.rage_click_count,
          }))

          const totalRageClicks = sessions.reduce((sum, s) => sum + (s.rage_click_count ?? 0), 0)
          const totalErrors = sessions.reduce((sum, s) => sum + (s.error_count ?? 0), 0)
          contextParts.push(
            `SESSIONS (last 7 days, top 20 by rage clicks): ${sessions.length} sessions. ` +
            `Total rage clicks: ${totalRageClicks}. Total JS errors: ${totalErrors}. ` +
            `Top sessions: ${sessions.slice(0, 5).map(s => `Session ${s.id} (${s.rage_click_count} rage clicks, ${s.error_count} errors${s.page_url ? `, page ${s.page_url}` : ''})`).join('; ')}.`
          )
        }
      }

      if (intent.needsFindings) {
        const { data: findings } = await supabase
          .from('us_findings')
          .select('summary, severity, category, status, account_value, created_at')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(10)

        if (findings?.length) {
          contextParts.push(
            `FINDINGS (latest 10): ` +
            findings.map(f => `"${f.summary}" (${f.category}, ${f.severity}, ${f.status}${f.account_value ? `, account ARR $${Math.round(f.account_value).toLocaleString()}` : ''})`).join('; ')
          )
        }
      }

      if (intent.needsPages) {
        const { data: heatmaps } = await supabase
          .from('us_heatmap_aggregates')
          .select('page_url_pattern, viewport_bucket, click_density_grid, date_trunc_hour')
          .eq('client_id', clientId)
          .gte('date_trunc_hour', sevenDaysAgo)
          .limit(200)

        if (heatmaps?.length) {
          const clicksByPage = new Map<string, number>()
          for (const h of heatmaps) {
            const grid = (h.click_density_grid ?? {}) as Record<string, number>
            const total = Object.values(grid).reduce((s, n) => s + (Number(n) || 0), 0)
            clicksByPage.set(h.page_url_pattern, (clicksByPage.get(h.page_url_pattern) ?? 0) + total)
          }
          const top = [...clicksByPage.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
          contextParts.push(`TOP PAGES BY CLICKS (7 days): ` + top.map(([url, n]) => `${url} (${n} clicks)`).join(', '))
        }
      }
    }

    const systemPrompt = `You are a data analyst AI assistant for UserSessions.io — a session replay and UX analytics platform. 
You have direct access to the user's analytics data and session replays.
Your job is to help product managers, designers, and developers understand their users' behavior, find friction points, and improve their product.

When answering:
- Be specific and cite actual numbers from the data when available.
- If you identify specific sessions worth watching, mention them.
- Keep answers concise but actionable — lead with the insight, follow with the data.
- If there's not enough data, say so honestly and suggest what to look for.

${contextParts.length > 0 ? `REAL DATA FROM THE USER'S DASHBOARD:\n${contextParts.join('\n\n')}` : 'No analytics data available yet — the user may be new or has no sessions recorded.'}`

    const geminiApiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY
    if (!geminiApiKey) {
      // Graceful degradation — return a helpful mock if no API key
      return NextResponse.json({
        answer: "I can see your analytics data but I'm not fully configured yet. Please check back soon — the AI Chat feature is being set up. In the meantime, check your Sessions and Findings pages for insights.",
        sessions: relatedSessions,
      })
    }

    const geminiModel = (process.env.GEMINI_MODEL || 'gemini-2.0-flash').replace(/[^a-z0-9.-]/gi, '')
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: message }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 512,
          },
        }),
      }
    )

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      console.error('[chat] Gemini error:', errText)
      return NextResponse.json({ error: 'AI service error', sessions: relatedSessions }, { status: 502 })
    }

    const geminiData = await geminiRes.json()
    const answer = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No response generated.'

    return NextResponse.json({ answer, sessions: relatedSessions })
  } catch (err) {
    console.error('[chat] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
