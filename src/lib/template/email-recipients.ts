import { supabase } from '@/lib/supabase'

export interface EmailRecipient {
  email: string
  name?: string | null
  selected: boolean
}

export async function fetchEmailRecipients(): Promise<EmailRecipient[]> {
  const { data } = await supabase
    .from('email_recipients')
    .select('email, name, selected')
    .order('name')
  return (data ?? []).map(row => ({
    email: row.email,
    name: row.name,
    selected: row.selected !== false,
  }))
}

export function selectedRecipientEmails(recipients: EmailRecipient[]): Set<string> {
  return new Set(recipients.filter(r => r.selected).map(r => r.email))
}

export function recipientInitial(recipient: Pick<EmailRecipient, 'name' | 'email'>): string {
  const source = recipient.name?.trim() || recipient.email.split('@')[0] || '?'
  return source.charAt(0).toUpperCase()
}

export async function setEmailRecipientSelected(email: string, selected: boolean) {
  await supabase.from('email_recipients').update({ selected }).eq('email', email)
}

export async function setAllEmailRecipientsSelected(selected: boolean) {
  await supabase.from('email_recipients').update({ selected }).neq('email', '')
}
