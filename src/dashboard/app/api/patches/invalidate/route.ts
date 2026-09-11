import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS, 'Access-Control-Allow-Headers': 'Content-Type' } })
}

/**
 * POST /api/patches/invalidate?patchId=...&clientId=<capture_public_key>
 *
 * Beacon from capture.js when a patch failed to match on 3 consecutive route changes.
 * `clientId` is the PUBLIC capture key embedded in the customer's page, not the UUID.
 * Only live/canary patches can be marked stale; the beacon can never touch shadow,
 * rolled-back or other clients' patches.
 */
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const captureKey = searchParams.get('clientId')
    const patchId = searchParams.get('patchId')

    if (!captureKey || !patchId || !UUID_RE.test(patchId)) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400, headers: CORS })
    }

    if (!rateLimit(`patch-invalidate:${captureKey}`, 60, 60_000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: CORS })
    }

    const supabase = createServiceClient()

    const { data: client } = await supabase
      .from('us_clients')
      .select('id')
      .eq('capture_public_key', captureKey)
      .maybeSingle()

    // Do not reveal whether the key exists.
    if (!client) return NextResponse.json({ success: true }, { headers: CORS })

    const { error } = await supabase
      .from('us_ui_patches')
      .update({ status: 'stale' })
      .eq('id', patchId)
      .eq('client_id', client.id)
      .in('status', ['live', 'canary'])

    if (error) {
      console.error('[Patches] Invalidate error:', error.message)
      return NextResponse.json({ error: 'Failed to invalidate patch' }, { status: 500, headers: CORS })
    }

    return NextResponse.json({ success: true }, { headers: CORS })
  } catch (err: any) {
    console.error('[Patches] Invalidate error:', err.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS })
  }
}
