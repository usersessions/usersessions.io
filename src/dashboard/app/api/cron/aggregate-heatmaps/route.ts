import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { authorizeCron } from '@/lib/cron'

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient();
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  
  try {
    // 1. Fetch raw page_view events from first-party capture
    // In production, we'd process in batches and track processed events,
    // but for MVP we process events from the last hour.
    const { data: rawEvents, error: fetchErr } = await supabase
      .from('us_events')
      .select('payload, session_id')
      .eq('type', 'page_view')
      .gte('occurred_at', oneHourAgo);

    if (fetchErr) throw fetchErr;
    if (!rawEvents || rawEvents.length === 0) {
      return NextResponse.json({ success: true, message: 'No events to aggregate.' });
    }

    // We also need client_id for each session
    const sessionIds = [...new Set(rawEvents.map(e => e.session_id))];
    const { data: sessions } = await supabase
      .from('us_sessions')
      .select('id, client_id')
      .in('id', sessionIds);
    
    const clientIdMap = new Map((sessions || []).map(s => [s.id, s.client_id]));

    // 2. Aggregate
    // Key: clientId|urlPattern|viewport|dateTruncHour
    const aggregations = new Map<string, any>();

    const dateTruncHour = new Date();
    dateTruncHour.setMinutes(0, 0, 0); // truncate to current hour

    for (const ev of rawEvents) {
      const clientId = clientIdMap.get(ev.session_id);
      if (!clientId) continue;

      const p = ev.payload as any;
      if (!p.url || !p.viewport) continue;
      
      const key = `${clientId}|${p.url}|${p.viewport}`;
      if (!aggregations.has(key)) {
        aggregations.set(key, {
          clientId,
          url: p.url,
          viewport: p.viewport,
          clicks: {},
          scroll: {},
          moves: {}
        });
      }

      const agg = aggregations.get(key);

      // Aggregate Clicks (bin by 10x10 px grid for density)
      if (Array.isArray(p.clicks)) {
        for (const c of p.clicks) {
          if (c.masked) continue; // Do not aggregate masked clicks
          const gridX = Math.round(c.x / 10) * 10;
          const gridY = Math.round(c.y / 10) * 10;
          const k = `${gridX},${gridY}`;
          agg.clicks[k] = (agg.clicks[k] || 0) + 1;
        }
      }

      // Aggregate Scroll Depth (histogram)
      if (typeof p.maxScrollDepth === 'number') {
        const bucket = Math.round(p.maxScrollDepth / 10) * 10; // 0, 10, 20... 100
        agg.scroll[bucket] = (agg.scroll[bucket] || 0) + 1;
      }

      // Aggregate Mouse Moves (bin by 20x20 px grid)
      if (Array.isArray(p.mouseMoves)) {
        for (const m of p.mouseMoves) {
          const gridX = Math.round(m.x / 20) * 20;
          const gridY = Math.round(m.y / 20) * 20;
          const k = `${gridX},${gridY}`;
          agg.moves[k] = (agg.moves[k] || 0) + 1;
        }
      }
    }

    // 3. Upsert into database
    const upserts = [];
    for (const agg of aggregations.values()) {
      upserts.push({
        client_id: agg.clientId,
        page_url_pattern: agg.url,
        viewport_bucket: agg.viewport,
        date_trunc_hour: dateTruncHour.toISOString(),
        click_density_grid: agg.clicks,
        scroll_depth_histogram: agg.scroll,
        attention_density_grid: agg.moves,
        rage_click_clusters: [] // Extracted separately via rage_click events
      });
    }

    if (upserts.length > 0) {
      // Upsert handles unique constraint on (client_id, page_url_pattern, viewport_bucket, date_trunc_hour)
      // Note: In a real system, you'd merge the JSONB fields during upsert. 
      // For MVP, we simply overwrite or insert the hour's rollup.
      const { error: upsertErr } = await supabase.from('us_heatmap_aggregates').upsert(upserts, {
        onConflict: 'client_id, page_url_pattern, viewport_bucket, date_trunc_hour'
      });

      if (upsertErr) {
        console.error('[Heatmap Cron] Upsert error:', upsertErr);
        throw upsertErr;
      }
    }

    return NextResponse.json({ success: true, processed: upserts.length });

  } catch (err: any) {
    console.error('[Heatmap Cron] Failed:', err.message);
    return NextResponse.json({ error: 'Aggregation failed' }, { status: 500 });
  }
}
