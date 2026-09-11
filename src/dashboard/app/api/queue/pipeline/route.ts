import { serve } from "@upstash/qstash/nextjs"
import { runClassificationPipeline } from "@/app/api/_pipeline"

// This handler will be called by Upstash QStash, providing automatic retries and background execution
// without hitting Vercel's Edge/Serverless HTTP timeouts.
export const POST = serve<{ clientId: string; sessionIds: string[] }>(
  async (context) => {
    const payload = context.requestPayload
    console.log(`[QStash] Running pipeline for client ${payload.clientId}, sessions: ${payload.sessionIds.length}`)
    
    // Process the classification pipeline in the background
    await runClassificationPipeline({
      clientId: payload.clientId,
      sessionIds: payload.sessionIds,
    })
  }
)
