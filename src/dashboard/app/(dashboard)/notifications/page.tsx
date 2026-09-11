import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PiCheckBold, PiBellBold, PiBellRingingBold, PiArrowRightBold } from 'react-icons/pi'
import { revalidatePath } from 'next/cache'

export const metadata = {
  title: 'Notifications | UserSessions',
}

export const dynamic = 'force-dynamic'

/** The in-app notification log is us_notification_events, scoped by client. */
async function currentClientId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: client } = await supabase.from('us_clients').select('id').eq('profile_id', user.id).maybeSingle()
  return client?.id ?? null
}

/** Only allow same-origin relative links to avoid an open redirect. */
function safeInternalLink(link: string): string | null {
  return /^\/(?!\/)[^\s]*$/.test(link) ? link : null
}

async function markAllAsRead() {
  'use server'
  const clientId = await currentClientId()
  if (!clientId) return
  const supabase = await createClient()
  await supabase
    .from('us_notification_events')
    .update({ read_at: new Date().toISOString() })
    .eq('client_id', clientId)
    .is('read_at', null)
  revalidatePath('/notifications')
}

async function markAsReadAndRedirect(formData: FormData) {
  'use server'
  const id = String(formData.get('id') ?? '')
  const link = safeInternalLink(String(formData.get('link') ?? ''))
  const clientId = await currentClientId()
  if (clientId && /^[0-9a-f-]{36}$/i.test(id)) {
    const supabase = await createClient()
    await supabase
      .from('us_notification_events')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('client_id', clientId)
  }
  if (link) {
    redirect(link)
  } else {
    revalidatePath('/notifications')
  }
}

type NotificationRow = {
  id: string
  title: string | null
  body: string | null
  kind?: string | null
  read_at: string | null
  created_at: string
  link?: string | null
  href?: string | null
  url?: string | null
  metadata?: Record<string, unknown> | null
}

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clientId = await currentClientId()

  const { data: rows } = clientId
    ? await supabase
        .from('us_notification_events')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(50)
    : { data: [] as NotificationRow[] }

  const notifications = ((rows ?? []) as NotificationRow[]).map((n) => ({
    id: n.id,
    title: n.title ?? (n.kind ? n.kind.replace(/[_.]/g, ' ') : 'Notification'),
    body: n.body ?? '',
    read: n.read_at !== null,
    created_at: n.created_at,
    link: n.link ?? n.href ?? n.url ?? (typeof n.metadata?.link === 'string' ? (n.metadata.link as string) : null),
  }))

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', width: '100%', paddingBottom: 120 }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <p className="ds-section-label" style={{ marginBottom: 10 }}>Alerts</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="ds-page-title">Notifications</h1>
            {unreadCount > 0 && (
              <span style={{
                background: 'rgba(252,163,17,0.12)', color: 'var(--orange)',
                border: '1px solid rgba(252,163,17,0.25)', borderRadius: 99,
                padding: '3px 10px', fontSize: 12, fontWeight: 700,
              }}>{unreadCount} new</span>
            )}
          </div>
        </div>
        {unreadCount > 0 && (
          <form action={markAllAsRead}>
            <button type="submit" style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 10, border: '1px solid var(--border)',
              background: 'var(--bg-canvas)', color: 'var(--text-secondary)',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              transition: 'all 150ms ease',
            }}>
              <PiCheckBold size={14} />
              Mark all read
            </button>
          </form>
        )}
      </header>

      {/* List */}
      {(!notifications || notifications.length === 0) ? (
        <div className="ds-empty" style={{ border: '1px dashed var(--glass-border-heavy)', gap: 20 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'var(--bg-canvas)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <PiBellRingingBold size={24} color="var(--text-muted)" />
          </div>
          <div>
            <p className="ds-empty-title" style={{ marginBottom: 6 }}>No notifications yet</p>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
              You don't have any notifications right now.
            </p>
          </div>
        </div>
      ) : (
        <div className="ds-stat-card" style={{ padding: 0, overflow: 'hidden' }}>
          {notifications.map((n, i) => (
            <div
              key={n.id}
              style={{
                position: 'relative',
                borderBottom: i < notifications.length - 1 ? '1px solid var(--border)' : 'none',
                background: !n.read ? 'rgba(252,163,17,0.03)' : 'transparent',
              }}
            >
              {/* Unread accent bar */}
              {!n.read && (
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: 3, background: 'var(--orange)', borderRadius: '0 2px 2px 0',
                }} />
              )}

              <form action={markAsReadAndRedirect} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '16px 24px' }}>
                <input type="hidden" name="id" value={n.id} />
                <input type="hidden" name="link" value={n.link ?? ''} />

                {/* Bell icon */}
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0, marginTop: 2,
                  background: !n.read ? 'rgba(252,163,17,0.1)' : 'var(--bg-canvas)',
                  border: `1px solid ${!n.read ? 'rgba(252,163,17,0.2)' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <PiBellBold size={15} color={!n.read ? 'var(--orange)' : 'var(--text-muted)'} />
                </div>

                {/* Content */}
                <button type="submit" style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, marginBottom: 4 }}>
                    <h4 style={{
                      margin: 0, fontSize: '14px',
                      fontWeight: !n.read ? 700 : 600,
                      color: 'var(--text-primary)',
                    }}>{n.title}</h4>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {new Date(n.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {n.body}
                  </p>
                </button>

                {/* View details button */}
                {n.link && (
                  <button type="submit" style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '6px 12px', borderRadius: 8, flexShrink: 0,
                    border: '1px solid var(--border)', background: 'var(--bg-canvas)',
                    color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600,
                    cursor: 'pointer', transition: 'all 150ms ease',
                  }}>
                    View
                    <PiArrowRightBold size={11} />
                  </button>
                )}
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
