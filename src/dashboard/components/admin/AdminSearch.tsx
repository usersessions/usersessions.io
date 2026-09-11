'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

type Result = { category: string; id: string; label: string; href: string }

// Global admin search: '/' to focus, 300ms debounce, categorized dropdown.
export default function AdminSearch() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (e.key === '/' && target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`)
        if (!res.ok) return
        const body = (await res.json()) as { results?: Result[] }
        setResults(body.results ?? [])
        setOpen(true)
      } catch {
        // leave previous results
      }
    }, 300)
    return () => clearTimeout(id)
  }, [q])

  const grouped = results.reduce<Record<string, Result[]>>((acc, r) => {
    ;(acc[r.category] ??= []).push(r)
    return acc
  }, {})

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search…  ( / )"
        aria-label="Search users, campaigns, platforms"
        className="font-mono-micro"
        style={{
          width: '100%',
          background: '#ffffff',
          border: '1px solid var(--border)',
          borderRadius: 'var(--rounded-sm)',
          color: 'var(--text-primary)',
          padding: 'var(--space-sm)',
        }}
      />
      {open && results.length > 0 ? (
        <div
          className="ds-stat-card"
          style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4, maxHeight: 320, overflowY: 'auto', padding: '8px' }}
        >
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <p className="font-mono-micro" style={{ color: 'var(--muted)', padding: 'var(--space-sm) 0 0' }}>{category}</p>
              {items.map((r) => (
                <Link
                  key={`${category}-${r.id}`}
                  href={r.href}
                  className="font-sans-label"
                  onClick={() => setOpen(false)}
                  style={{ display: 'block', color: 'var(--text-primary)', textDecoration: 'none', padding: 'var(--space-sm) 0' }}
                >
                  {r.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
