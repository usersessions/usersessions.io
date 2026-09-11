import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { html, selector, issue_description } = body

    if (!html || !selector || !issue_description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    })

    const prompt = `You are an expert frontend engineer acting as an autonomous UI patching agent.
You have been given a piece of broken or misaligned HTML, its CSS selector, and a description of the issue.
Your task is to generate a JSON payload containing the exact inline CSS styles needed to fix the element.

Target Selector: ${selector}
Issue Description: ${issue_description}
HTML Context:
\`\`\`html
${html}
\`\`\`

Output ONLY valid JSON in the exact format expected by our patching engine, with no markdown formatting or extra text.
Format required:
{
  "patch_type": "css",
  "patch_payload": {
    "styles": {
      "camelCaseCssProperty": "value",
      "anotherProperty": "value"
    }
  }
}
`

    const msg = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    })

    const responseText = (msg.content[0] as { text: string }).text
    
    // Parse the JSON out of the response (handles if Claude still wraps in markdown)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from LLM response')
    }
    
    const patchData = JSON.parse(jsonMatch[0])
    
    // Add required fields for capture.js to process it
    const finalPatch = {
      id: `demo_patch_${Math.random().toString(36).substring(7)}`,
      target_selector: selector,
      patch_type: patchData.patch_type || 'css',
      patch_payload: patchData.patch_payload,
    }

    return NextResponse.json({ patch: finalPatch })
  } catch (error: any) {
    console.error('[Demo Patch API] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
