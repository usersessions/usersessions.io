/**
 * In-app notification channel.
 *
 * Inserts into the `notifications` table (the in-app bell).
 * Every notification that goes out via Slack or email is also logged here,
 * so nothing is ever only visible in an inbox someone doesn't check.
 */

import { createClient } from '@/lib/supabase/server'
import type { DispatchPayload, NotifDeliveryStatus } from './types'

export interface InAppNotification {
  user_id: string
  type: string
  title: string
  body: string
  link?: string
  source_type?: string
  source_id?: string
  read?: boolean
}

/**
 * Log a notification to the in-app bell.
 * Returns 'sent' on success, 'failed' on error.
 */
export async function sendInAppNotification(
  payload: DispatchPayload,
  title: string,
  body: string,
  link?: string
): Promise<NotifDeliveryStatus> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('notifications').insert({
      user_id: payload.recipient_user_id,
      type: payload.event_type,
      title,
      body,
      link: link ?? null,
      source_type: payload.source_type ?? null,
      source_id: payload.source_id ?? null,
      read: false,
    })
    if (error) {
      console.error('[notify:inapp] insert failed:', error.message)
      return 'failed'
    }
    return 'sent'
  } catch (err) {
    console.error('[notify:inapp] unexpected error:', err)
    return 'failed'
  }
}

/**
 * Mark an in-app notification as read (used when user actions from any channel).
 */
export async function markInAppRead(
  eventType: string,
  sourceId: string,
  userId: string
): Promise<void> {
  try {
    const supabase = await createClient()
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('type', eventType)
      .eq('source_id', sourceId)
  } catch (err) {
    console.error('[notify:inapp] markRead failed:', err)
  }
}
