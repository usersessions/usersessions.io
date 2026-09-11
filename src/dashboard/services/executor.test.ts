import { describe, it, expect } from 'vitest'
import { deriveFindingStatus, buildIdempotencyKey, type ExecutionResult } from './executor'

function r(status: ExecutionResult['status'], actionId = 'a1'): ExecutionResult {
  return { actionId, toolkit: 'SLACK', composioAction: 'post_message', status, result: status === 'executed' ? 'success' : status === 'failed' ? 'failed' : null }
}

describe('deriveFindingStatus', () => {
  it('executed only when every action succeeded', () => {
    expect(deriveFindingStatus([r('executed'), r('executed')])).toBe('executed')
  })
  it('all failed is NOT executed', () => {
    expect(deriveFindingStatus([r('failed'), r('failed')])).toBe('pending')
  })
  it('mixed success/failure is partially executed', () => {
    expect(deriveFindingStatus([r('executed'), r('failed')])).toBe('partially_executed')
  })
  it('anything awaiting approval is partially executed', () => {
    expect(deriveFindingStatus([r('executed'), r('skipped')])).toBe('partially_executed')
    expect(deriveFindingStatus([r('skipped')])).toBe('partially_executed')
  })
  it('a skipped result without an action row counts as failed', () => {
    expect(deriveFindingStatus([r('skipped', '')])).toBe('pending')
  })
})

describe('buildIdempotencyKey', () => {
  it('collapses aliases of the same action', () => {
    expect(buildIdempotencyKey('f1', 'JIRA', 'CREATE_TICKET')).toBe(buildIdempotencyKey('f1', 'jira', 'create_issue'))
  })
  it('separates toolkits and findings', () => {
    expect(buildIdempotencyKey('f1', 'JIRA', 'create_issue')).not.toBe(buildIdempotencyKey('f1', 'LINEAR', 'create_issue'))
    expect(buildIdempotencyKey('f1', 'JIRA', 'create_issue')).not.toBe(buildIdempotencyKey('f2', 'JIRA', 'create_issue'))
  })
})
