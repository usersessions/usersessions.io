import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin-api'
import { getSystemHealth } from '@/lib/monitoring'

// System health snapshot for admin clients (quick actions, dashboards).
export async function GET() {
  const user = await requireAdminApi()
  if (!user) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const health = await getSystemHealth()
  return NextResponse.json({ health, generatedAt: new Date().toISOString() })
}
