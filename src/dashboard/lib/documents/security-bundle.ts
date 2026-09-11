/**
 * UserSessions.io — Security Bundle
 * Serves static security PDFs from Supabase Storage.
 */

import { createServiceClient } from '@/lib/supabase/server'

// In a real Phase 4 system, these versions would be dynamic or read from DB.
// For now, they are hardcoded.
export const SECURITY_DOC_VERSIONS = {
  soc2: 'v1.2',
  dpa: 'v2.0',
  faq: 'v1.5'
}

export type SecurityDocKey = keyof typeof SECURITY_DOC_VERSIONS

/**
 * Returns a signed URL (valid for 7 days) for the specified security document.
 */
export async function getSecurityDocumentUrl(docKey: SecurityDocKey): Promise<string> {
  const supabase = createServiceClient()
  
  const version = SECURITY_DOC_VERSIONS[docKey]
  let filename = ''
  
  switch (docKey) {
    case 'soc2': filename = `soc2-${version}.pdf`; break;
    case 'dpa': filename = `dpa-${version}.pdf`; break;
    case 'faq': filename = `security-faq-${version}.pdf`; break;
  }
  
  const { data, error } = await supabase
    .storage
    .from('security-docs')
    .createSignedUrl(filename, 7 * 24 * 60 * 60) // 7 days
    
  if (error || !data) {
    // If the bucket or file doesn't exist yet (very possible in dev/staging),
    // fallback to a dummy URL so the UI doesn't crash.
    console.error(`[security-bundle] Failed to generate signed URL for ${filename}:`, error?.message)
    return `https://usersessions.io/fallback-${filename}`
  }
  
  return data.signedUrl
}
