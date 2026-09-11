import { describe, it, expect } from 'vitest'
import {
  normalizeAction,
  isReversibleAction,
  neverAuto,
  toolkitSupportsAction,
  composioSlugFor,
  toolkitsFor,
} from './action-catalog'

describe('action-catalog', () => {
  it('normalises legacy and free-form names onto the canonical vocabulary', () => {
    expect(normalizeAction('CREATE_TICKET')).toBe('create_issue')
    expect(normalizeAction('SLACK_SEND_MESSAGE')).toBe('post_message')
    expect(normalizeAction('code_pr')).toBe('create_pr')
    expect(normalizeAction('ui-patch')).toBe('create_ui_patch')
    expect(normalizeAction('  Flag Account ')).toBe('flag_account')
    expect(normalizeAction('launch_nukes')).toBeNull()
    expect(normalizeAction(42)).toBeNull()
  })

  it('marks only Slack/issue/CRM actions as reversible', () => {
    expect(isReversibleAction('post_message')).toBe(true)
    expect(isReversibleAction('CREATE_TICKET')).toBe(true)
    expect(isReversibleAction('flag_account')).toBe(true)
    expect(isReversibleAction('create_ui_patch')).toBe(false)
    expect(isReversibleAction('create_pr')).toBe(false)
    expect(isReversibleAction('unknown')).toBe(false)
  })

  it('never auto-executes UI patches or code PRs', () => {
    expect(neverAuto('create_ui_patch')).toBe(true)
    expect(neverAuto('code_pr')).toBe(true)
    expect(neverAuto('post_message')).toBe(false)
  })

  it('binds actions to compatible toolkits only', () => {
    expect(toolkitSupportsAction('SLACK', 'post_message')).toBe(true)
    expect(toolkitSupportsAction('slack', 'create_issue')).toBe(false)
    expect(toolkitSupportsAction('JIRA', 'create_issue')).toBe(true)
    expect(toolkitSupportsAction('UIPATCH', 'create_ui_patch')).toBe(true)
    expect(toolkitSupportsAction('GITHUB', 'create_pr')).toBe(true)
  })

  it('resolves Composio slugs and returns null for unmapped pairs', () => {
    expect(composioSlugFor('SLACK', 'post_message')).toBe('SLACK_SEND_MESSAGE')
    expect(composioSlugFor('jira', 'CREATE_TICKET')).toBe('JIRA_CREATE_ISSUE')
    expect(composioSlugFor('SLACK', 'create_issue')).toBeNull()
    expect(composioSlugFor('UIPATCH', 'create_ui_patch')).toBeNull()
  })

  it('lists connected toolkits able to carry an action, in preference order', () => {
    expect(toolkitsFor('create_issue', ['slack', 'linear', 'jira'])).toEqual(['JIRA', 'LINEAR'])
    expect(toolkitsFor('create_issue', ['slack'])).toEqual([])
  })
})
