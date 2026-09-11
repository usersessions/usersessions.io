import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TeamManagementView } from '@/components/team/TeamManagementView'

export default async function TeamPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex justify-center p-6 lg:p-10 w-full min-h-[calc(100vh-var(--header-height))]">
      <TeamManagementView plan={profile?.plan ?? 'free'} />
    </div>
  )
}
