import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updateProfile, deleteAccount } from './actions'
import PolicyRules from '@/components/settings/PolicyRules'
import { getPlanConfig } from '@/lib/tiers'
import { getFeatureAccess } from '@/hooks/useFeatureAccess'
import { PiUserBold, PiWebhooksLogoBold, PiShieldBold, PiCreditCardBold, PiFileBold, PiTrashBold, PiHardDrivesBold, PiKeyBold, PiLockKeyBold, PiHeadsetBold, PiShareNetworkBold } from 'react-icons/pi'
import { ApiKeysManager } from '@/components/settings/ApiKeysManager'
import { ConnectedSitePanel } from '@/components/settings/ConnectedSitePanel'

const APP_LABELS: Record<string, string> = {
  slack: 'Slack',
  jira: 'Jira',
  linear: 'Linear',
  github: 'GitHub',
  hubspot: 'HubSpot',
  salesforce: 'Salesforce',
  intercom: 'Intercom',
  zendesk: 'Zendesk',
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; notif_saved?: string; cancelled?: string; cancel_error?: string; error?: string; test?: string; removed?: string; delete_error?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: profile },
    { data: client },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('us_clients').select('id, credit_balance, client_domain, script_installed_at, capture_public_key, audit_status, connected_session_source, connected_composio_apps, slack_alert_channel').eq('profile_id', user.id).maybeSingle()
  ])

  const planId = profile?.plan ?? 'free'
  const planConfig = getPlanConfig(planId)
  const access = getFeatureAccess(planId)

  const rawApps = (client as any)?.connected_composio_apps
  const connectedApps: string[] = Array.isArray(rawApps)
    ? rawApps.map(String)
    : rawApps && typeof rawApps === 'object'
      ? Object.keys(rawApps)
      : []
  const slackChannel: string | null = (client as any)?.slack_alert_channel ?? null
  const sessionSource: string | null = (client as any)?.connected_session_source ?? null

  const { data: mcpTokens } = client 
    ? await supabase.from('us_mcp_tokens').select('id, name, created_at, last_used_at').eq('client_id', client.id).order('created_at', { ascending: false })
    : { data: [] }

  const banner = (color: string, text: string) => (
    <div style={{
      border: `1px solid ${color === 'green' ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
      borderRadius: '8px',
      padding: '12px 16px',
      background: color === 'green' ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
      color: color === 'green' ? 'rgba(52,211,153,0.9)' : '#f87171',
      fontSize: '13px',
      fontWeight: 600
    }}>
      {text}
    </div>
  )


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 48, maxWidth: 880, margin: '0 auto', width: '100%', paddingBottom: 120 }}>
      <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'var(--glass-bg-hover)', border: '1px solid var(--glass-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
        }}>
          <PiUserBold size={18} color="var(--orange)" />
        </div>
        <h1 className="ds-page-title" style={{ margin: 0 }}>Settings</h1>
      </div>

      {params.saved && banner('green', '✓ Settings saved')}
      {params.notif_saved && banner('green', '✓ Notification preferences saved')}
      {params.removed && banner('green', '✓ Webhook removed')}
      {params.test === 'ok' && banner('green', '✓ Test notification delivered')}
      {params.test === 'fail' && banner('red', 'Test notification failed — check the webhook URL and try again')}
      {params.error === 'invalid_url' && banner('red', 'That does not look like a valid webhook URL')}
      {params.error === 'use_connect_flow' && banner('red', 'Integrations are managed from the Connect page')}

      {/* Account Info */}
      <section className="ds-stat-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(59,130,246,0.07)',
            border: '1px solid rgba(59,130,246,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <PiUserBold size={16} color="var(--blue)" />
          </div>
          <h2 className="ds-section-label" style={{ margin: 0 }}>Account details</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{profile?.email}</span>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
            Sign-in is passwordless — magic links go to this address. To change it, contact support.
          </p>
        </div>
      </section>

      {/* Profile */}
      <section className="ds-stat-card" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <h2 className="ds-section-label">Profile</h2>
        <form action={updateProfile} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }} htmlFor="full_name">
              Full name
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              autoComplete="name"
              placeholder="Ada Lovelace"
              maxLength={120}
              defaultValue={profile?.full_name ?? ''}
              className="ds-input"
              style={{ maxWidth: 400 }}
            />
          </div>
          <div>
            <button className="ds-btn-approve" type="submit" style={{ padding: '10px 20px', fontSize: '13px' }}>
              Save changes
            </button>
          </div>
        </form>
      </section>

      {/* Policies */}
      <PolicyRules />

      {/* Custom Workflows */}
      <section className="ds-stat-card" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(6,182,212,0.08)',
            border: '1px solid rgba(6,182,212,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <PiShareNetworkBold size={16} color="#06b6d4" />
          </div>
          <h2 className="ds-section-label" style={{ margin: 0 }}>Custom Remediation Workflows</h2>
        </div>

        {!access.canCustomWorkflows ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start', opacity: 0.6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
              <PiLockKeyBold size={14} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>Locked on {access.planLabel}</span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6, maxWidth: 500 }}>
              Custom workflows are available on the Business plan and above. Build flows to run actions automatically based on specific triggers.
            </p>
            <Link href="/billing" className="ds-btn-outline" style={{ padding: '8px 16px', fontSize: '12px', textDecoration: 'none' }}>
              Upgrade to Business
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
              Set up rules to run actions automatically when specific events occur.
            </p>
            <div>
              <button className="ds-btn-approve" style={{ padding: '8px 16px', fontSize: '12px' }}>
                Create Workflow
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Connected Site Panel */}
      <ConnectedSitePanel client={client} />

      {/* Integrations */}
      <section className="ds-stat-card" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(252,163,17,0.08)',
            border: '1px solid rgba(252,163,17,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <PiWebhooksLogoBold size={16} color="var(--orange)" />
          </div>
          <h2 className="ds-section-label" style={{ margin: 0 }}>Integrations</h2>
        </div>
        
        <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Session source</div>
            {sessionSource ? <span className="ds-status ds-status--approved">{sessionSource}</span> : <span className="ds-status ds-status--dismissed">Not connected</span>}
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
            Where sessions are ingested from (first-party script, Datadog RUM, FullStory or PostHog).
          </p>
        </div>

        <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Slack alerts</div>
            {slackChannel ? <span className="ds-status ds-status--approved">#{slackChannel.replace(/^#/, '')}</span> : <span className="ds-status ds-status--dismissed">Off</span>}
          </div>
          {!access.canSlackAlerts ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, background: 'rgba(239,68,68,0.03)', border: '1px dashed rgba(239,68,68,0.2)', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
                <PiLockKeyBold size={14} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>Locked on {access.planLabel}</span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                Real-time alerting is available on the <strong>Pro</strong> plan.
              </p>
              <div>
                <Link href="/billing" className="ds-btn-approve" style={{ padding: '8px 16px', fontSize: '12px', textDecoration: 'none' }}>
                  Upgrade to Pro
                </Link>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
              Critical findings are posted to your Slack channel once Slack is connected through Composio.
            </p>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Action destinations</div>
          {connectedApps.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
              No destinations connected yet. Connect Slack, Jira, Linear or GitHub so approved findings can be turned into messages, tickets and PRs.
            </p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {connectedApps.map((app) => (
                <span key={app} className="ds-status ds-status--approved">{APP_LABELS[app.toLowerCase()] ?? app}</span>
              ))}
            </div>
          )}
          <div>
            <Link href="/connect" className="ds-btn-approve" style={{ padding: '8px 16px', fontSize: '12px', textDecoration: 'none' }}>
              Manage integrations
            </Link>
          </div>
        </div>
      </section>

      {/* MCP Server Access */}
      <section className="ds-stat-card" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(139,92,246,0.07)',
            border: '1px solid rgba(139,92,246,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <PiHardDrivesBold size={16} color="#8b5cf6" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 className="ds-section-label" style={{ margin: 0 }}>MCP Server Access</h2>
            <span style={{ 
              background: access.mcpAccess === 'read-write' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              color: access.mcpAccess === 'read-write' ? 'var(--green)' : '#ef4444',
              padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em'
            }}>
              {access.mcpAccess === 'read-write' ? 'Read / Write' : 'Read-only'}
            </span>
          </div>
        </div>
        
        {access.mcpAccess === 'read-only' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, background: 'rgba(239,68,68,0.03)', border: '1px dashed rgba(239,68,68,0.2)', borderRadius: 12 }}>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
              You are on the <strong>Starter</strong> plan, which includes read-only MCP access. Autonomous UI mutations and active actions are disabled.
            </p>
            <div>
              <Link href="/billing" className="ds-btn-approve" style={{ padding: '8px 16px', fontSize: '12px', textDecoration: 'none' }}>
                Upgrade to Pro
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6, marginBottom: 12 }}>
              Your plan includes full read/write access for your local MCP server. Agent actions can actively mutate UI states. Manage your local server access keys below.
            </p>
            <ApiKeysManager keys={mcpTokens ?? []} />
          </div>
        )}
      </section>

      {/* SSO & RBAC */}
      <section className="ds-stat-card" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(59,130,246,0.07)',
            border: '1px solid rgba(59,130,246,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <PiKeyBold size={16} color="var(--blue)" />
          </div>
          <h2 className="ds-section-label" style={{ margin: 0 }}>SSO &amp; RBAC</h2>
        </div>

        {!access.hasSSO ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start', opacity: 0.6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
              <PiLockKeyBold size={14} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>Locked</span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6, maxWidth: 400 }}>
              SAML/SSO (Okta, Entra ID) and advanced role-based access control are available on the Enterprise plan.
            </p>
            <Link href="/contact" className="ds-btn-outline" style={{ padding: '8px 16px', fontSize: '12px', textDecoration: 'none' }}>
              Contact Sales
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
              Configure your SAML identity provider to enforce secure access.
            </p>
            <div>
              <button className="ds-btn-approve" style={{ padding: '8px 16px', fontSize: '12px' }}>
                Configure Identity Provider
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Priority Support */}
      <section className="ds-stat-card" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(236,72,153,0.07)',
            border: '1px solid rgba(236,72,153,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <PiHeadsetBold size={16} color="#ec4899" />
          </div>
          <h2 className="ds-section-label" style={{ margin: 0 }}>Priority Support</h2>
        </div>

        {!access.isAtLeastBusiness ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start', opacity: 0.6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
              <PiLockKeyBold size={14} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>Locked</span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6, maxWidth: 400 }}>
              Dedicated account management, custom SLA, and priority support routing are available on the Business plan and above.
            </p>
            <Link href="/billing" className="ds-btn-outline" style={{ padding: '8px 16px', fontSize: '12px', textDecoration: 'none' }}>
              Upgrade to Business
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
              You have access to priority support and a dedicated account manager.
              {access.isEnterprise && " As an Enterprise customer, you also have a dedicated shared Slack channel."}
            </p>
            <div>
              <a href="mailto:info@usersessions.io?subject=Priority%20Support%20Request" className="ds-btn-approve" style={{ display: 'inline-block', padding: '8px 16px', fontSize: '12px', textDecoration: 'none' }}>
                Contact Support
              </a>
            </div>
          </div>
        )}
      </section>

      {/* Security Documents */}
      <section className="ds-stat-card" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(16,185,129,0.07)',
            border: '1px solid rgba(16,185,129,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <PiShieldBold size={16} color="var(--green)" />
          </div>
          <h2 className="ds-section-label" style={{ margin: 0 }}>Security &amp; Compliance</h2>
        </div>
        {!access.isEnterprise ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start', opacity: 0.6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
              <PiLockKeyBold size={14} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>Locked on {access.planLabel}</span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6, maxWidth: 400 }}>
              Custom SLA, compliance documents (SOC2, DPA), and independent audit reports are available on the Enterprise plan.
            </p>
            <Link href="/contact" className="ds-btn-outline" style={{ padding: '8px 16px', fontSize: '12px', textDecoration: 'none' }}>
              Contact Sales
            </Link>
          </div>
        ) : (
          <>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
              Our security posture is documented and independently audited. You can download the latest documents here.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { id: 'soc2', label: 'SOC 2 Type II Report' },
                { id: 'dpa', label: 'Data Processing Agreement (DPA)' },
                { id: 'faq', label: 'Security Architecture FAQ' },
              ].map(doc => (
                <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <PiFileBold size={14} color="var(--text-muted)" />
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{doc.label}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <a 
                      href={`/api/documents/security-bundle?type=${doc.id}`}
                      target="_blank" 
                      className="ds-btn-approve" 
                      style={{ textDecoration: 'none', padding: '6px 12px', fontSize: '12px' }}
                    >
                      Download PDF
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {params.delete_error === 'confirm_mismatch' && banner('red', 'Type DELETE exactly to confirm account deletion')}

      {/* ── Danger Zone ─────────────────────────────────── */}
      <section style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        padding: '28px 32px',
        borderRadius: 12,
        border: '1px solid rgba(239,68,68,0.25)',
        background: 'rgba(239,68,68,0.03)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <PiTrashBold size={16} color="#ef4444" />
          </div>
          <h2 className="ds-section-label" style={{ margin: 0, color: '#ef4444' }}>Danger Zone</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Delete account &amp; all data</p>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
            This will permanently delete your account, all session data, heatmaps, and configuration. <strong style={{ color: 'var(--text-primary)' }}>This cannot be undone.</strong>
          </p>
        </div>

        <form action={deleteAccount} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label
              htmlFor="confirm_delete"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#ef4444' }}
            >
              Type <span style={{ background: 'rgba(239,68,68,0.1)', padding: '1px 5px', borderRadius: 3, letterSpacing: 0 }}>DELETE</span> to confirm
            </label>
            <input
              id="confirm_delete"
              name="confirm"
              type="text"
              placeholder="DELETE"
              autoComplete="off"
              className="ds-input"
              style={{ maxWidth: 280, borderColor: 'rgba(239,68,68,0.3)' }}
            />
          </div>
          <div>
            <button
              type="submit"
              className="ds-btn-dismiss"
              style={{ padding: '10px 20px', fontSize: '13px', color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.06)' }}
            >
              Permanently delete my account
            </button>
          </div>
        </form>
      </section>

    </div>
  )
}
