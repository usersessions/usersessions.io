import { describe, it, expect } from 'vitest'
import { matchesUrlPattern } from './url-pattern'

describe('matchesUrlPattern', () => {
  it('matches everything for null/empty/star', () => {
    expect(matchesUrlPattern(null, '/anything')).toBe(true)
    expect(matchesUrlPattern('', '/anything')).toBe(true)
    expect(matchesUrlPattern('*', '/anything')).toBe(true)
  })

  it('matches exact paths case-insensitively', () => {
    expect(matchesUrlPattern('/pricing', '/pricing')).toBe(true)
    expect(matchesUrlPattern('/pricing', '/Pricing')).toBe(true)
    expect(matchesUrlPattern('/pricing', '/pricing/enterprise')).toBe(false)
  })

  it('supports wildcards and escapes regex metacharacters', () => {
    expect(matchesUrlPattern('/docs/*', '/docs/getting-started')).toBe(true)
    expect(matchesUrlPattern('/docs/*', '/blog/docs')).toBe(false)
    expect(matchesUrlPattern('/a.b', '/axb')).toBe(false)
    expect(matchesUrlPattern('/users/*/edit', '/users/42/edit')).toBe(true)
  })
})
