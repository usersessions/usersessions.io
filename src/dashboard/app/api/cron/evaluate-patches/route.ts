import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { authorizeCron } from '@/lib/cron'
import crypto from 'crypto'

export const dynamic = 'force-dynamic';

function getHashBucket(sessionId: string, patchId: string): number {
  const hash = crypto.createHash('md5').update(`${sessionId}-${patchId}`).digest('hex');
  return parseInt(hash.substring(0, 8), 16) % 100;
}

export async function POST(req: Request) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient();
  
  try {
    // 1. Fetch all canary patches
    const { data: canaryPatches, error: patchErr } = await supabase
      .from('us_ui_patches')
      .select('*')
      .eq('status', 'canary');

    if (patchErr) throw patchErr;
    if (!canaryPatches || canaryPatches.length === 0) {
      return NextResponse.json({ success: true, message: 'No canary patches to evaluate.' });
    }

    // Process each patch
    for (const patch of canaryPatches) {
      // 2. Fetch sessions from the last N hours that saw this patch's page
      // In MVP, we'll fetch all recent sessions for this client that have patchMetrics
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
      const { data: recentSessions } = await supabase
        .from('us_sessions')
        .select('id, raw_metadata')
        .eq('client_id', patch.client_id)
        .gte('ingested_at', oneHourAgo)
        .neq('raw_metadata', null);

      if (!recentSessions || recentSessions.length === 0) continue;

      let canaryCount = 0;
      let controlCount = 0;
      let canaryJsErrors = 0;
      let controlJsErrors = 0;

      for (const session of recentSessions) {
        const meta = session.raw_metadata as any;
        const bucket = getHashBucket(session.id, patch.id);
        
        // Did they load a page where this patch was active? 
        // In this MVP, we assume if they have `patchMetrics`, they were exposed to the experiment.
        if (!meta.patchMetrics) continue;

        if (bucket < patch.canary_percentage) {
          canaryCount++;
          // Global JS Errors for the canary group
          canaryJsErrors += (meta.patchMetrics.global?.jsErrors || 0);
        } else {
          controlCount++;
          controlJsErrors += (meta.patchMetrics.global?.jsErrors || 0);
        }
      }

      if (canaryCount < 10 || controlCount < 10) {
        // Not enough data yet
        continue;
      }

      const canaryErrorRate = canaryJsErrors / canaryCount;
      const controlErrorRate = controlJsErrors / controlCount;

      // 3. Rollback Logic
      // Trigger if EITHER:
      //   a) Canary error rate is >5% higher than control (relative — catches regressions vs baseline)
      //   b) Canary error rate > 0.5 errors/session absolute (catches regressions when control is clean)
      let shouldRollback = false;
      let rollbackTrigger = null;

      const relativeSpike = controlErrorRate > 0 && canaryErrorRate > controlErrorRate * 1.05;
      const absoluteSpike = canaryErrorRate > 0.5; // > 0.5 JS errors per session in canary group

      if (relativeSpike || absoluteSpike) {
        shouldRollback = true;
        rollbackTrigger = {
          metric: 'js_errors',
          canaryRate: canaryErrorRate,
          controlRate: controlErrorRate,
          threshold: relativeSpike ? '5% relative increase over control' : '0.5 absolute errors/session',
        };
      }

      // Update Live Metrics
      const liveMetrics = {
        canaryCount,
        controlCount,
        canaryErrorRate,
        controlErrorRate,
        evaluatedAt: new Date().toISOString()
      };

      if (shouldRollback) {
        // AUTOMATIC ROLLBACK
        console.warn(`[Patch Rollback] Auto-rolling back patch ${patch.id} due to metrics.`, rollbackTrigger);
        await supabase.from('us_ui_patches').update({
          status: 'rolled_back',
          rollback_trigger: rollbackTrigger,
          live_metrics: liveMetrics,
          rolled_back_at: new Date().toISOString()
        }).eq('id', patch.id);
      } else {
        // Just update live metrics
        await supabase.from('us_ui_patches').update({
          live_metrics: liveMetrics
        }).eq('id', patch.id);
      }
    }

    return NextResponse.json({ success: true, processed: canaryPatches.length });

  } catch (err: any) {
    console.error('[Evaluate Patches Cron] Failed:', err.message);
    return NextResponse.json({ error: 'Evaluation failed' }, { status: 500 });
  }
}
