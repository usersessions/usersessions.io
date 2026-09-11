import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { generateMBRPdf } from '@/lib/documents/mbr-generator'
import { registerDocument } from '@/lib/documents/registry'
import type { MBRMetrics } from '@/lib/documents/types'

export const dynamic = 'force-dynamic'

const MAX_PERIOD_DAYS = 92

function parseIso(v: unknown): Date | null {
  if (typeof v !== 'string') return null
  const t = Date.parse(v)
  return Number.isFinite(t) ? new Date(t) : null
}

/** Real metrics for a client over [start, end). */
async function computeMetrics(
  db: ReturnType<typeof createServiceClient>,
  clientId: string,
  start: Date,
  end: Date,
): Promise<Omit<MBRMetrics, 'period_label' | 'prev_period_findings' | 'prev_period_actions'>> {
  const [{ data: findings }, { data: actions }] = await Promise.all([
    db.from('us_findings')
      .select('severity, account_value')
      .eq('client_id', clientId)
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString())
      .limit(10_000),
    db.from('us_actions')
      .select('composio_toolkit, approved_by')
      .eq('client_id', clientId)
      .eq('status', 'executed')
      .eq('result', 'success')
      .gte('executed_at', start.toISOString())
      .lt('executed_at', end.toISOString())
      .limit(10_000),
  ])

  const bySeverity: Record<'P0' | 'P1' | 'P2' | 'P3', number> = { P0: 0, P1: 0, P2: 0, P3: 0 }
  let arrAtRisk = 0
  for (const f of findings ?? []) {
    if (f.severity in bySeverity) bySeverity[f.severity as keyof typeof bySeverity]++
    if ((f.severity === 'P0' || f.severity === 'P1') && typeof f.account_value === 'number') arrAtRisk += f.account_value
  }

  const byToolkit: Record<string, number> = {}
  let auto = 0
  let human = 0
  for (const a of actions ?? []) {
    const tk = String(a.composio_toolkit ?? 'unknown')
    byToolkit[tk] = (byToolkit[tk] ?? 0) + 1
    if (String(a.approved_by ?? '').startsWith('auto')) auto++
    else human++
  }

  return {
    findings_total: findings?.length ?? 0,
    findings_by_severity: bySeverity,
    actions_executed: actions?.length ?? 0,
    actions_by_toolkit: byToolkit,
    actions_auto_executed: auto,
    actions_human_approved: human,
    arr_at_risk_usd: Math.round(arrAtRisk),
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new NextResponse('Unauthorized', { status: 401 })

    const { data: client } = await supabase
      .from('us_clients')
      .select('id, name')
      .eq('profile_id', user.id)
      .maybeSingle()
    if (!client) return new NextResponse('Client not found', { status: 404 })

    let body: any
    try {
      body = await req.json()
    } catch {
      return new NextResponse('Invalid JSON', { status: 400 })
    }
    const start = parseIso(body?.periodStart)
    const end = parseIso(body?.periodEnd)
    if (!start || !end || end <= start) return new NextResponse('Invalid period bounds', { status: 400 })
    if ((end.getTime() - start.getTime()) / 86_400_000 > MAX_PERIOD_DAYS) {
      return new NextResponse(`Period may not exceed ${MAX_PERIOD_DAYS} days`, { status: 400 })
    }

    const db = createServiceClient()
    const spanMs = end.getTime() - start.getTime()
    const [current, previous] = await Promise.all([
      computeMetrics(db, client.id, start, end),
      computeMetrics(db, client.id, new Date(start.getTime() - spanMs), start),
    ])

    const metrics: MBRMetrics = {
      period_label: start.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
      ...current,
      prev_period_findings: previous.findings_total,
      prev_period_actions: previous.actions_executed,
    }

    const pdfBuffer = await generateMBRPdf(client.name, metrics)

    const fileName = `${client.id}/mbr-${start.toISOString().slice(0, 10)}.pdf`
    const { data: uploadData, error: uploadError } = await db
      .storage
      .from('documents')
      .upload(fileName, pdfBuffer, { contentType: 'application/pdf', upsert: true })

    if (uploadError || !uploadData) {
      console.error('[MBR] Upload failed:', uploadError?.message)
      return new NextResponse('Failed to upload PDF', { status: 500 })
    }

    const doc = await registerDocument({
      client_id: client.id,
      doc_type: 'mbr',
      period_start: start.toISOString(),
      period_end: end.toISOString(),
      storage_path: uploadData.path,
      external_url: null,
      doc_version: null,
      sent_at: null,
      sent_to: [],
      metadata: { mbr_metrics: metrics },
    })

    return NextResponse.json({ id: doc.id, metrics })
  } catch (error) {
    console.error('[api/documents/mbr] Error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
