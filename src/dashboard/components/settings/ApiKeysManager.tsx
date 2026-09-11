'use client'

import { useState } from 'react'
import { generateApiKey, revokeApiKey } from '@/app/(dashboard)/settings/actions'
import { Plus, Trash2, Key, Check } from 'lucide-react'

export function ApiKeysManager({ keys }: { keys: any[] }) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleGenerate(formData: FormData) {
    setIsGenerating(true)
    setNewKey(null)
    const result = await generateApiKey(formData)
    if (result?.rawKey) {
      setNewKey(result.rawKey)
    }
    setIsGenerating(false)
  }

  function handleCopy() {
    if (newKey) {
      navigator.clipboard.writeText(newKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {keys.length === 0 ? (
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            You haven't generated any API keys yet.
          </p>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            {keys.map((k, i) => (
              <div key={k.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: i < keys.length - 1 ? '1px solid var(--border)' : 'none',
                background: 'var(--bg-canvas)'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Key size={12} color="var(--text-muted)" />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{k.name}</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    Created {new Date(k.created_at).toLocaleDateString()}
                  </span>
                </div>
                <form action={revokeApiKey}>
                  <input type="hidden" name="id" value={k.id} />
                  <button type="submit" className="ds-btn-dismiss" style={{ padding: '6px 12px', fontSize: 12, color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }}>
                    Revoke
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>

      {newKey && (
        <div style={{
          padding: 16, borderRadius: 10, border: '1px solid rgba(16,185,129,0.3)',
          background: 'rgba(16,185,129,0.05)', display: 'flex', flexDirection: 'column', gap: 12
        }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--green)' }}>
            API Key generated successfully
          </p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Please copy this key now. For your security, you will not be able to see it again.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <code style={{ flex: 1, padding: '10px 14px', background: 'var(--bg-canvas)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, wordBreak: 'break-all' }}>
              {newKey}
            </code>
            <button onClick={handleCopy} className="ds-btn-approve" style={{ padding: '10px 16px', fontSize: 13, flexShrink: 0, display: 'flex', gap: 6, alignItems: 'center' }}>
              {copied ? <Check size={14} /> : null}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {!newKey && (
        <form action={handleGenerate} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input
            name="name"
            type="text"
            placeholder="Key name (e.g., Production MCP)"
            required
            className="ds-input"
            style={{ maxWidth: 240 }}
          />
          <button type="submit" className="ds-btn-approve" style={{ padding: '10px 20px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }} disabled={isGenerating}>
            <Plus size={14} />
            {isGenerating ? 'Generating...' : 'Generate new key'}
          </button>
        </form>
      )}
    </div>
  )
}
