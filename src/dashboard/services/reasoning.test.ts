import { describe, it, expect } from 'vitest'
import { sanitizeRecommendedActions } from './reasoning'

describe('sanitizeRecommendedActions', () => {
  const connected = ['SLACK', 'JIRA', 'UIPATCH']

  it('keeps valid actions on connected toolkits and normalises names', () => {
    const out = sanitizeRecommendedActions([
      { toolkit: 'slack', action: 'send_message', params: { text: 'hi' } },
      { toolkit: 'JIRA', action: 'CREATE_TICKET', params: {} },
    ], connected)
    expect(out).toEqual([
      { toolkit: 'SLACK', action: 'post_message', params: { text: 'hi' } },
      { toolkit: 'JIRA', action: 'create_issue', params: {} },
    ])
  })

  it('drops toolkits the client has not connected', () => {
    const out = sanitizeRecommendedActions([{ toolkit: 'HUBSPOT', action: 'flag_account', params: {} }], connected)
    expect(out).toEqual([])
  })

  it('drops actions the toolkit cannot carry and unknown actions', () => {
    const out = sanitizeRecommendedActions([
      { toolkit: 'SLACK', action: 'create_issue', params: {} },
      { toolkit: 'JIRA', action: 'delete_everything', params: {} },
    ], connected)
    expect(out).toEqual([])
  })

  it('allows UIPATCH only when listed, and dedupes', () => {
    const out = sanitizeRecommendedActions([
      { toolkit: 'UIPATCH', action: 'create_ui_patch', params: { target_selector: '#a' } },
      { toolkit: 'UIPATCH', action: 'ui_patch', params: { target_selector: '#b' } },
    ], connected)
    expect(out).toHaveLength(1)
    expect(sanitizeRecommendedActions([{ toolkit: 'UIPATCH', action: 'create_ui_patch', params: {} }], ['SLACK'])).toEqual([])
  })

  it('tolerates garbage input', () => {
    expect(sanitizeRecommendedActions(null, connected)).toEqual([])
    expect(sanitizeRecommendedActions([null, 1, 'x', { toolkit: 'SLACK' }], connected)).toEqual([])
    expect(sanitizeRecommendedActions([{ toolkit: 'SLACK', action: 'post_message', params: [1, 2] }], connected)[0].params).toEqual({})
  })
})
