import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AccountsClient from './AccountsClient'

export default async function AccountsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Aggregate findings by account name — group by account_name field or use source_session_id
  // We join us_findings with us_sessions to get a usable account label
  const { data: findings } = await supabase
    .from('us_findings')
    .select(`
      id, severity, status, account_value, created_at, summary,
      us_sessions ( source, source_session_id ),
      us_actions ( id, composio_toolkit, status, executed_at )
    `)
    .not('account_value', 'is', null)
    .order('account_value', { ascending: false })
    .limit(200)

  return <AccountsClient findings={(findings ?? []) as unknown as Parameters<typeof AccountsClient>[0]['findings']} />
}
