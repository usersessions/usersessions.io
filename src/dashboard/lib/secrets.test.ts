import { describe, it, expect, afterEach } from 'vitest'
import { isPlaceholderSecret, getStrongSecret, constantTimeEqual } from './secrets'

const REAL = 'k9F3vQ2mZp8sT1xL7wRb4nYd6Hj0Cg5A'

describe('secrets', () => {
  afterEach(() => { delete process.env.TEST_SECRET })

  it('flags .env.example placeholders and short values', () => {
    expect(isPlaceholderSecret('generate-a-secure-random-string')).toBe(true)
    expect(isPlaceholderSecret('generate-another-secure-string')).toBe(true)
    expect(isPlaceholderSecret('dev-secret-change-me')).toBe(true)
    expect(isPlaceholderSecret('your-cron-secret-goes-here-ok')).toBe(true)
    expect(isPlaceholderSecret('short')).toBe(true)
    expect(isPlaceholderSecret('')).toBe(true)
    expect(isPlaceholderSecret(undefined)).toBe(true)
  })

  it('accepts real secrets', () => {
    expect(isPlaceholderSecret(REAL)).toBe(false)
  })

  it('getStrongSecret fails closed', () => {
    expect(getStrongSecret('TEST_SECRET')).toBeNull()
    process.env.TEST_SECRET = 'generate-a-secure-random-string'
    expect(getStrongSecret('TEST_SECRET')).toBeNull()
    process.env.TEST_SECRET = ` ${REAL} `
    expect(getStrongSecret('TEST_SECRET')).toBe(REAL)
  })

  it('constantTimeEqual compares strictly', () => {
    expect(constantTimeEqual(REAL, REAL)).toBe(true)
    expect(constantTimeEqual(REAL, REAL.slice(0, -1) + 'B')).toBe(false)
    expect(constantTimeEqual(REAL, REAL + 'x')).toBe(false)
  })
})
