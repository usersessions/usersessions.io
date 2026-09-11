import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { validatePatchPayload } from '@/lib/patches/validate'
import { matchesUrlPattern } from '@/lib/patches/url-pattern'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

const EXCLUDED_ROUTES = /(checkout|payment|billing|login|auth|account|settings|signup)/i
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'no-store',
}

function getHashBucket(sessionId: string, patchId: string): number {
  // Deterministic 0..99 bucket so a visitor stays in/out of a canary for the whole session
  const hash = crypto.createHash('md5').update(`${sessionId}-${patchId}`).digest('hex')
  return parseInt(hash.substring(0, 8), 16) % 100
}

function empty(status = 200) {
  return NextResponse.json({ patches: [] }, { status, headers: CORS })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

/**
 * GET /api/patches/active?clientId=<capture_public_key>&sessionId=...&url=<pathname>
 *
 * Returns live patches plus canary patches for which this session is in-bucket.
 * Shadow / stale / rolled-back patches are never returned.
 * `clientId` is the PUBLIC capture key from the embed snippet (not the UUID).
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const captureKey = searchParams.get('clientId')
    const sessionId = searchParams.get('sessionId')
    const url = searchParams.get('url')

    if (!captureKey || !sessionId || !url || url.length > 2048) return empty(400)

    if (!rateLimit(`patches-active:${captureKey}`, 600, 60_000)) return empty(429)

    // Server-side copy of the client exclusion list
    if (EXCLUDED_ROUTES.test(url)) return empty()

    const supabase = createServiceClient()

    const { data: client } = await supabase
      .from('us_clients')
      .select('id')
      .eq('capture_public_key', captureKey)
      .maybeSingle()

    if (!client) return empty()

    const { data: patches, error } = await supabase
      .from('us_ui_patches')
      .select('id, target_selector, target_signals, patch_type, patch_payload, status, canary_percentage, url_pattern')
      .eq('client_id', client.id)
      .in('status', ['live', 'canary'])

    if (error || !patches || patches.length === 0) return empty()

    const applicable = []
    for (const patch of patches) {
      if (!matchesUrlPattern(patch.url_pattern, url)) continue

      // Never ship a payload that fails the safety gate, even if it is in the DB.
      if (!validatePatchPayload(patch.patch_type, patch.patch_payload).ok) {
        console.warn(`[Patches] Skipping unsafe payload on patch ${patch.id}`)
        continue
      }

      if (patch.status === 'live') {
        applicable.push(patch)
      } else if (getHashBucket(sessionId, patch.id) < (patch.canary_percentage ?? 0)) {
        applicable.push(patch)
      }
    }

    return NextResponse.json(
      {
        patches: applicable.map((p) => ({
          id: p.id,
          target_selector: p.target_selector,
          target_signals: p.target_signals,
          patch_type: p.patch_type,
          patch_payload: p.patch_payload,
          status: p.status,
        })),
      },
      { headers: CORS },
    )
  } catch (err: any) {
    console.error('[Patches] Active patches error:', err.message)
    return empty(500)
  }
}
