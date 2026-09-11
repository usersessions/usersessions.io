import { describe, it, expect } from 'vitest'
import { redactPayload, redactEndUserId, containsPII } from './pii-redactor'

describe('pii-redactor', () => {
  describe('redactPayload', () => {
    it('redacts explicit PII fields', () => {
      const payload = {
        email: 'test@example.com',
        phone: '+1 555-123-4567',
        name: 'John Doe',
        dob: '1990-01-01',
        ip: '192.168.1.1',
        age: 30, // not a PII key
        ssn_number: 123456789, // wait, PII key 'ssn' is matched exactly or contains? PII_FIELD_KEYS checks exact key match
      }
      // Actually, PII_FIELD_KEYS checks exactly: PII_FIELD_KEYS.has(key.toLowerCase())
      
      const result = redactPayload(payload) as Record<string, unknown>
      expect(result.email).toBe('[REDACTED]')
      expect(result.phone).toBe('[REDACTED]')
      expect(result.name).toBe('[REDACTED]')
      expect(result.dob).toBe('[REDACTED]')
      expect(result.ip).toBe('[REDACTED]')
      expect(result.age).toBe(30)
    })

    it('redacts PII field numeric values to 0', () => {
      const result = redactPayload({ card_number: 1234567812345678 }) as Record<string, unknown>
      expect(result.card_number).toBe(0)
    })

    it('leaves empty strings and nulls unchanged for PII fields', () => {
      const result = redactPayload({ email: '', phone: null, name: undefined }) as Record<string, unknown>
      expect(result.email).toBe('')
      expect(result.phone).toBe(null)
      expect(result.name).toBe(undefined)
    })

    it('redacts PII patterns inside arbitrary string values', () => {
      const payload = {
        message: 'My email is user@example.com and phone is 555-123-4567',
        ipv4: 'Server IP 192.168.0.1 was blocked',
        ssn_text: 'My SSN is 123-45-6789',
        card_text: 'Use card 4111 1111 1111 1111 for billing'
      }
      const result = redactPayload(payload) as Record<string, unknown>
      expect(result.message).toContain('[EMAIL]')
      expect(result.message).toContain('[PHONE]')
      expect(result.ipv4).toContain('[IP]')
      expect(result.ssn_text).toContain('[SSN]')
      expect(result.card_text).toContain('[CARD]')
    })

    it('handles nested objects and arrays up to depth 8', () => {
      const payload = {
        level1: {
          level2: [
            { email: 'deep@example.com', message: 'call 555-987-6543' }
          ]
        }
      }
      const result = redactPayload(payload) as Record<string, any>
      expect(result.level1.level2[0].email).toBe('[REDACTED]')
      expect(result.level1.level2[0].message).toContain('[PHONE]')
    })

    it('caps recursion at depth 8', () => {
      // Create an object 10 levels deep
      let obj: any = { email: 'depth10@example.com' }
      for (let i = 0; i < 9; i++) {
        obj = { nested: obj }
      }
      const result = redactPayload(obj) as any
      // The 10th level shouldn't be redacted
      let current = result
      for (let i = 0; i < 9; i++) {
        current = current.nested
      }
      // depth > 8 returns original object unmodified
      expect(current.email).toBe('depth10@example.com')
    })
  })

  describe('redactEndUserId', () => {
    it('redacts email-like IDs', () => {
      expect(redactEndUserId('user@example.com')).toBe('[REDACTED_EMAIL_ID]')
    })
    
    it('preserves opaque IDs', () => {
      expect(redactEndUserId('uuid-1234-5678')).toBe('uuid-1234-5678')
      expect(redactEndUserId('12345')).toBe('12345')
    })

    it('returns null for empty', () => {
      expect(redactEndUserId(null)).toBeNull()
    })
  })

  describe('containsPII', () => {
    it('returns true if PII pattern is present', () => {
      expect(containsPII({ msg: 'user@example.com' })).toBe(true)
      expect(containsPII({ msg: '123-45-6789' })).toBe(true) // ssn
      expect(containsPII({ msg: '4111222233334444' })).toBe(true) // card
    })

    it('returns true if PII field key is present', () => {
      expect(containsPII({ email: '' })).toBe(true)
      expect(containsPII({ pAssWOrd: 'secret' })).toBe(true)
    })

    it('returns false for clean payloads', () => {
      expect(containsPII({ message: 'hello world', count: 42, userId: 'abc-123' })).toBe(false)
    })
  })
})
