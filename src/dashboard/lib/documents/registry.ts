/**
 * UserSessions.io — Document Registry
 * CRUD operations over us_documents.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { Document, DocType } from './types'

export async function registerDocument(doc: Omit<Document, 'id' | 'created_at'>): Promise<Document> {
  const supabase = createServiceClient()
  
  // Upsert on idempotency constraint (client_id, doc_type, period_start, period_end)
  // For non-period docs, period_start/end will be null, which means the UNIQUE constraint
  // NULLS NOT DISTINCT will enforce uniqueness if we have a single non-period doc of that type per client,
  // but Supabase/Postgres upsert needs the precise conflict target.
  // We'll use a direct insert; if it fails due to the constraint, we update.
  
  const { data, error } = await supabase
    .from('us_documents')
    .insert(doc)
    .select('*')
    .single()

  if (error) {
    if (error.code === '23505') {
      // Conflict on the unique constraint
      if (doc.period_start && doc.period_end) {
        const { data: updated, error: updateError } = await supabase
          .from('us_documents')
          .update(doc)
          .eq('client_id', doc.client_id)
          .eq('doc_type', doc.doc_type)
          .eq('period_start', doc.period_start)
          .eq('period_end', doc.period_end)
          .select('*')
          .single()
        
        if (updateError) throw updateError
        return updated as Document
      }
    }
    throw error
  }
  
  return data as Document
}

export async function getDocument(id: string): Promise<Document | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('us_documents')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return null
  return data as Document
}

export async function listDocuments(clientId: string, docType?: DocType): Promise<Document[]> {
  const supabase = createServiceClient()
  let query = supabase
    .from('us_documents')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (docType) {
    query = query.eq('doc_type', docType)
  }

  const { data, error } = await query
  if (error) throw error
  return data as Document[]
}

export async function getLatestDocument(clientId: string, docType: DocType): Promise<Document | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('us_documents')
    .select('*')
    .eq('client_id', clientId)
    .eq('doc_type', docType)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return data as Document
}
