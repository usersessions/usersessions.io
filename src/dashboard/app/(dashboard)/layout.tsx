import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NotificationToaster } from '@/components/NotificationToaster'
import { DockNav } from '@/components/DockNav'
import { AvatarMenu } from '@/components/AvatarMenu'
import { CommandPalette } from '@/components/CommandPalette'
import { KeyboardShortcuts } from '@/components/KeyboardShortcuts'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { DashboardHeader } from '@/components/DashboardHeader'
import { PullToRefresh } from '@/components/PullToRefresh'
import { ACTION_STATUSES } from '@/types/constants'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: profile },
    { data: client },
    { count: unreadCount },
  ] = await Promise.all([
    supabase.from('profiles').select('role, full_name, email, plan').eq('id', user.id).single(),
    supabase.from('us_clients').select('id, credit_balance, connected_session_source, connected_composio_apps, client_domain, script_installed_at').eq('profile_id', user.id).maybeSingle(),
    supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('read', false),
  ])

  const [
    { count: pendingCount },
    { count: executingCount },
    { data: findings },
  ] = client?.id ? await Promise.all([
    supabase.from('us_actions').select('*', { count: 'exact', head: true }).eq('client_id', client.id).eq('status', ACTION_STATUSES.APPROVE_REQUIRED),
    supabase.from('us_actions').select('*', { count: 'exact', head: true }).eq('client_id', client.id).eq('status', ACTION_STATUSES.EXECUTING),
    supabase.from('us_findings').select('account_value').eq('client_id', client.id),
  ]) : [{ count: 0 }, { count: 0 }, { data: [] }]

  const onboardingFlags = [
    !!client?.connected_session_source,
  ]
  const onboarding = { done: onboardingFlags.filter(Boolean).length, total: onboardingFlags.length }

  const displayName = profile?.full_name ?? profile?.email ?? user.email ?? ''
  const email = profile?.email ?? user.email ?? ''
  const initial = displayName.trim().charAt(0).toUpperCase() || '·'
  const totalArr = (findings ?? []).reduce((sum, f) => sum + (Number(f.account_value) || 0), 0)
  const findingsCount = findings?.length ?? 0
  const isAdmin = profile?.role === 'admin'
  const apps = (client?.connected_composio_apps ?? []) as string[]
  const hasCrmConnected = apps.includes('HUBSPOT') || apps.includes('SALESFORCE')

  return (
    /**
     * data-theme="ink-light" activates the light dashboard token set from tokens.css.
     * The #E5E5E5 (alabaster) canvas is intentional — it makes the glass dock visible.
     */
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--bg-canvas)', color: 'var(--text-primary)' }}
      data-theme="ink-light"
    >
      <a href="#main" className="skip-link">Skip to main content</a>
      <NotificationToaster userId={user.id} />
      <CommandPalette />
      <KeyboardShortcuts />


      {/* ── Desktop: header bar (full-width, sticky top) ─────────────────── */}
      <div className="hidden md:block w-full sticky top-0 z-40" style={{ position: 'relative' }}>
        <DashboardHeader
          pendingCount={pendingCount ?? 0}
          executingCount={executingCount ?? 0}
          totalArr={totalArr}
          clientId={client?.id ?? null}
          clientDomain={client?.client_domain ?? null}
          scriptInstalled={!!(client as any)?.script_installed_at}
          userEmail={email}
        />
        {/* Avatar/user menu lives in the top "menu bar", separate from the dock */}
        <div
          className="hidden md:flex"
          style={{
            position: 'absolute',
            right: 24,
            top: '50%',
            transform: 'translateY(-50%)',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <AvatarMenu
            displayName={displayName}
            email={email}
            plan={profile?.plan ?? 'free'}
            initial={initial}
          />
        </div>
      </div>

      {/* ── Main content — no sidebar, scrolls behind the fixed dock ─────── */}
      <PullToRefresh>
        <main
          id="main"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            background: 'transparent',
          }}
        >
          <div style={{ 
            width: '100%', 
            maxWidth: 1280, 
            margin: '0 auto', 
            padding: 'var(--space-xl)',
            paddingBottom: 'calc(var(--space-xl) + 96px)',
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column' 
          }}>
            <Breadcrumbs />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}>
              {children}
            </div>
          </div>
        </main>
      </PullToRefresh>

      {/* ── Dock Navigation — fixed, bottom-center (desktop only) ────────── */}
      <div className="hidden md:block">
        <DockNav
          isAdmin={isAdmin}
          pendingCount={pendingCount ?? 0}
          findingsCount={findingsCount}
          notificationsCount={unreadCount ?? 0}
          hasCrmConnected={hasCrmConnected}
          clientId={client?.id ?? null}
        />
      </div>
    </div>
  )
}
