import { supabase } from './supabase'

/** Optional audit log when user clicks 발송 (outbound only). Failures are non-blocking. */
export async function logOutboundOutreach(params: {
  influencer_id: string
  subject: string
  body: string
  template_name?: string
  template_id?: string
  sent_at?: string
}): Promise<void> {
  const { error } = await supabase.from('outreach_messages').insert({
    influencer_id: params.influencer_id,
    direction: 'outbound',
    subject: params.subject,
    body: params.body,
    template_name: params.template_name ?? null,
    template_id: params.template_id ?? null,
    sent_at: params.sent_at ?? new Date().toISOString(),
  })
  if (error) console.warn('outreach_messages log failed:', error.message)
}
