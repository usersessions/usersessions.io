import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDocument } from '@/lib/documents/registry'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new NextResponse('Unauthorized', { status: 401 })

    const { id } = await context.params
    const doc = await getDocument(id)
    if (!doc) return new NextResponse('Not Found', { status: 404 })

    // Verify ownership
    const { data: client } = await supabase
      .from('us_clients')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle()

    if (!client || doc.client_id !== client.id) {
      return new NextResponse('Forbidden', { status: 403 })
    }

    if (doc.external_url) {
      return NextResponse.redirect(doc.external_url)
    }

    if (doc.storage_path) {
      const { data, error } = await supabase
        .storage
        .from('documents')
        .createSignedUrl(doc.storage_path, 3600) // 1 hour

      if (error || !data) {
        return new NextResponse('Failed to generate URL', { status: 500 })
      }
      return NextResponse.redirect(data.signedUrl)
    }

    return new NextResponse('Document has no file associated', { status: 400 })

  } catch (error) {
    console.error('[api/documents/:id] Error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
