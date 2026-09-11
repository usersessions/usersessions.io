import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin-api'
import { createServiceClient } from '@/lib/supabase/server'

// Force dynamic: Supabase URL is a runtime env var on Cloudflare, not a build var.
export const dynamic = 'force-dynamic'


export type SearchResult = { category: string; id: string; label: string; href: string }

// Global admin search across users, client workspaces and findings.
export async function GET(request: Request) {
  const user = await requireAdminApi()
  if (!user) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const q = (new URL(request.url).searchParams.get('q') ?? '').trim().slice(0, 100)
  if (q.length < 2) return NextResponse.json({ results: [] })
  // Strip PostgREST filter metacharacters so the term cannot break out of the ilike pattern
  const term = `%${q.replace(/[%_,().\\]/g, '')}%`

  const db = createServiceClient()
  const [users, clients, findings] = await Promise.all([
    db.from('profiles').select('id, email, full_name').or(`email.ilike.${term},full_name.ilike.${term}`).limit(10),
    db.from('us_clients').select('id, name, client_domain, profile_id').or(`name.ilike.${term},client_domain.ilike.${term}`).limit(10),
    db.from('us_findings').select('id, summary, severity, client_id').ilike('summary', term).order('created_at', { ascending: false }).limit(10),
  ])

  const results: SearchResult[] = [
    ...(users.data ?? []).map((u) => ({ category: 'Users', id: u.id, label: u.full_name ? `${u.email} (${u.full_name})` : u.email, href: `/admin/users/${u.id}` })),
    ...(clients.data ?? []).map((c) => ({ category: 'Workspaces', id: c.id, label: c.client_domain ? `${c.name} (${c.client_domain})` : c.name, href: `/admin/users/${c.profile_id}` })),
    ...(findings.data ?? []).map((f) => ({ category: 'Findings', id: f.id, label: `[${f.severity}] ${f.summary}`, href: `/findings?id=${f.id}` })),
  ]
  return NextResponse.json({ results })
}
