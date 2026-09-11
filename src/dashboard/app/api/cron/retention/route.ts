import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { deleteReplayData } from '@/lib/r2'
import { authorizeCron } from '@/lib/cron'

export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()

  try {
    // 1. Delete 90+ day old replays (but keep the session/findings metadata)
    // We do this by nulling out the replay_url
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const { data: oldSessions, error: oldError } = await supabase
      .from('us_sessions')
      .select('id, replay_url')
      .lt('ingested_at', ninetyDaysAgo.toISOString())
      .not('replay_url', 'is', null)

    if (oldError) throw oldError

    let deleted90d = 0
    if (oldSessions && oldSessions.length > 0) {
      for (const session of oldSessions) {
        if (session.replay_url) {
          // If the URL is just a key or an S3 path, we extract the key.
          // For simplicity, assuming the key is the session ID or stored in replay_url
          const key = session.replay_url.startsWith('r2://') 
            ? session.replay_url.replace('r2://', '') 
            : `${session.id}.json`
          await deleteReplayData(key)
        }
      }

      // Null out the replay_urls
      await supabase
        .from('us_sessions')
        .update({ replay_url: null })
        .in('id', oldSessions.map(s => s.id))
      
      deleted90d = oldSessions.length
    }

    // 2. Delete 48h old raw sessions that failed pre-filter (no errors/rage clicks/findings)
    // The heatmap aggregation cron runs separately and aggregates these before we delete them.
    const fortyEightHoursAgo = new Date()
    fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48)

    // A session failed pre-filter if it has no errors, no rage clicks, and no findings.
    // Instead of querying findings, we rely on error_count=0 and rage_click_count=0 
    // (the prefilter criteria)
    const { data: junkSessions, error: junkError } = await supabase
      .from('us_sessions')
      .select('id, replay_url')
      .lt('ingested_at', fortyEightHoursAgo.toISOString())
      .eq('error_count', 0)
      .eq('rage_click_count', 0)

    if (junkError) throw junkError

    let deleted48h = 0
    if (junkSessions && junkSessions.length > 0) {
      for (const session of junkSessions) {
        if (session.replay_url) {
          const key = session.replay_url.startsWith('r2://') 
            ? session.replay_url.replace('r2://', '') 
            : `${session.id}.json`
          await deleteReplayData(key)
        }
      }

      // Delete the rows completely (cascades to us_events)
      await supabase
        .from('us_sessions')
        .delete()
        .in('id', junkSessions.map(s => s.id))

      deleted48h = junkSessions.length
    }

    return NextResponse.json({
      success: true,
      deleted90dReplays: deleted90d,
      deleted48hJunkSessions: deleted48h,
    })

  } catch (error: any) {
    console.error('Retention cron error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
