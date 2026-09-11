import { requireAdmin } from '@/lib/admin'
import AdminSidebar from '@/components/admin/AdminSidebar'
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requireAdmin() // hard redirect for non-admins, every route

  return (
    <div 
      className="flex min-h-screen" 
      style={{ background: 'var(--bg-canvas)', color: 'var(--text-primary)' }}
      data-theme="ink-light"
    >
      <AdminSidebar email={email} />

      <main className="flex-1" style={{ padding: 'var(--space-xl)', background: 'transparent' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>{children}</div>
      </main>
    </div>
  )
}
