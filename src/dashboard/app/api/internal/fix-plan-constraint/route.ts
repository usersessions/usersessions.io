import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// One-time migration route to fix the profiles_plan_check constraint.
// PROTECTED: only accessible from localhost or with a valid SERVICE secret.
// DELETE THIS FILE after the migration has been applied.
export async function GET(request: Request) {
  const secret = request.headers.get('x-migration-secret')
  const expectedSecret = process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-16)
  
  if (secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceClient()

  // Drop and recreate the constraint with enterprise included
  const steps = [
    `ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_plan_check`,
    `ALTER TABLE public.profiles ADD CONSTRAINT profiles_plan_check CHECK (plan IN ('free','starter','pro','business','enterprise','agency','audit','standard'))`,
  ]

  const results: Array<{ step: string; ok: boolean; error?: string }> = []

  for (const sql of steps) {
    const { error } = await db.rpc('exec_migration_sql', { sql })
    results.push({ step: sql.slice(0, 60), ok: !error, error: error?.message })
  }

  return NextResponse.json({ results })
}
