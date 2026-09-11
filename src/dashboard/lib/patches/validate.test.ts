import { describe, it, expect } from 'vitest'
import { validatePatchPayload } from './validate'

describe('validatePatchPayload', () => {
  it('accepts plain css styles', () => {
    expect(validatePatchPayload('css', { styles: { display: 'none', marginTop: 4 } }).ok).toBe(true)
  })

  it('rejects css values that can execute or fetch', () => {
    expect(validatePatchPayload('css', { styles: { width: 'expression(alert(1))' } }).ok).toBe(false)
    expect(validatePatchPayload('css', { styles: { background: 'url(javascript:alert(1))' } }).ok).toBe(false)
    expect(validatePatchPayload('css', { styles: { behavior: 'url(x.htc)' } }).ok).toBe(false)
  })

  it('accepts bounded text', () => {
    expect(validatePatchPayload('text', { text: 'Continue to checkout' }).ok).toBe(true)
    expect(validatePatchPayload('text', { text: 'x'.repeat(5000) }).ok).toBe(false)
    expect(validatePatchPayload('text', { text: 42 }).ok).toBe(false)
  })

  it('only allows attributes on the allow-list', () => {
    expect(validatePatchPayload('attribute', { attr: 'aria-label', val: 'Buy now' }).ok).toBe(true)
    expect(validatePatchPayload('attribute', { attr: 'disabled', action: 'remove' }).ok).toBe(true)
    expect(validatePatchPayload('attribute', { attr: 'onclick', val: 'alert(1)' }).ok).toBe(false)
    expect(validatePatchPayload('attribute', { attr: 'srcdoc', val: '<script>' }).ok).toBe(false)
    expect(validatePatchPayload('attribute', { attr: 'style', val: 'color:red' }).ok).toBe(false)
  })

  it('blocks javascript:/data: hrefs on attribute and redirect patches', () => {
    expect(validatePatchPayload('attribute', { attr: 'href', val: 'javascript:alert(1)' }).ok).toBe(false)
    expect(validatePatchPayload('attribute', { attr: 'href', val: ' JAVASCRIPT:alert(1)' }).ok).toBe(false)
    expect(validatePatchPayload('attribute', { attr: 'href', val: '/pricing' }).ok).toBe(true)
    expect(validatePatchPayload('redirect', { href: 'data:text/html,hi' }).ok).toBe(false)
    expect(validatePatchPayload('redirect', { href: 'https://example.com/help' }).ok).toBe(true)
    expect(validatePatchPayload('redirect', { href: 'ftp://x' }).ok).toBe(false)
  })

  it('rejects unknown patch types and malformed payloads', () => {
    expect(validatePatchPayload('script', { src: 'x' }).ok).toBe(false)
    expect(validatePatchPayload('css', null).ok).toBe(false)
    expect(validatePatchPayload('css', { styles: [] }).ok).toBe(false)
  })
})
