// Single source of truth for admin navigation (sidebar drawer + mobile bottom bar).
export const ADMIN_NAV = [
  { label: 'System', href: '/admin' },
  { label: 'Users', href: '/admin/users' },
  { label: 'Billing', href: '/admin/billing' },
  { label: 'Support', href: '/admin/support' },
  { label: 'Data quality', href: '/admin/data-quality' },
  { label: 'Flags', href: '/admin/flags' },
  { label: 'Compliance', href: '/admin/compliance' },
  { label: 'Audit log', href: '/admin/audit' },
  { label: 'Learning worker', href: '/admin/worker' },
  { label: 'Research notes', href: '/admin/research' },
  { label: 'Usage', href: '/admin/usage' },
  { label: 'Settings', href: '/admin/settings' },
] as const
