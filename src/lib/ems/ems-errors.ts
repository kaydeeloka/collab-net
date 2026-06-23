import { supabase } from '../supabase'

export interface OriginalShipment {
  ems_number:         string
  application_number: string
  registered_date:    string
  status:             string
  last_update:        string
}

export interface EmsErrorRow {
  id:                  string
  name:                string
  email:               string | null
  email_sent:          boolean
  tracking:            string
  applicationNumber:   string
  sentDate:            string
  country:             string
  reason:              string
  status:              string
  carrierStatus:       string
  original:            OriginalShipment | null
}

export interface EmsTrackingSnapshot {
  id:                 string | null
  ems_number:         string | null
  registered_date:    string | null
  application_number: string | null
  last_update:        string | null
  email_sent:         boolean
  status:             string | null
}

export const ERROR_STATUS_OPTIONS = [
  '처리 대기',
  '처리 중',
  '확인 중',
  '재발송 예정',
  '재발송 완료',
] as const

export type ErrorStatus = typeof ERROR_STATUS_OPTIONS[number]

export const EMS_ERROR_STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  '처리 중':     { bg: '#fff3cd', text: '#856404' },
  '재발송 예정': { bg: '#cff4fc', text: '#055160' },
  '확인 중':     { bg: '#e2d9f3', text: '#4a2c8a' },
  '재발송 완료': { bg: '#d1e7dd', text: '#0f5132' },
  '처리 대기':   { bg: '#f8d7da', text: '#842029' },
}

export const RESHIP_NEEDED_STATUSES: ErrorStatus[] = ['처리 대기', '처리 중', '확인 중', '재발송 예정']

export function countReshipNeeded(rows: Pick<EmsErrorRow, 'status'>[]): number {
  return rows.filter(r => RESHIP_NEEDED_STATUSES.includes(r.status as ErrorStatus)).length
}

export function countReshipCompleted(rows: Pick<EmsErrorRow, 'status'>[]): number {
  return rows.filter(r => r.status === '재발송 완료').length
}

export type ReshipmentRef = { id: string; status: string; ems_number: string | null }

async function fetchConfirmedIdsForPhase(phaseId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('confirmed_influencers')
    .select('id')
    .eq('phase_id', phaseId)
  if (error) throw error
  return (data || []).map(r => r.id)
}

/** Load reshipments keyed by confirmed_influencer_id for the given phase. */
export async function fetchReshipmentMap(phaseId?: string | null): Promise<Map<string, ReshipmentRef>> {
  if (!phaseId) return new Map()

  const confirmedIds = await fetchConfirmedIdsForPhase(phaseId)
  if (confirmedIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from('ems_reshipments')
    .select('id, status, ems_number, confirmed_influencer_id')
    .in('confirmed_influencer_id', confirmedIds)

  if (error) throw error

  return new Map(
    (data || []).map(r => [r.confirmed_influencer_id, {
      id: r.id,
      status: r.status,
      ems_number: r.ems_number ?? null,
    }]),
  )
}

export async function fetchEmsErrors(phaseId?: string | null): Promise<EmsErrorRow[]> {
  if (!phaseId) return []

  const confirmedIds = await fetchConfirmedIdsForPhase(phaseId)
  if (confirmedIds.length === 0) return []

  const { data, error } = await supabase
    .from('ems_reshipments')
    .select(`
      id, ems_number, application_number, registered_date, error_reason, status, carrier_status, email_sent,
      original_tracking_id,
      confirmed_influencers(
        email,
        country,
        influencers(display_name, handle)
      )
    `)
    .in('confirmed_influencer_id', confirmedIds)
    .order('created_at', { ascending: false })

  const trackingIds = [...new Set(
    (data || []).map((r: any) => r.original_tracking_id).filter(Boolean),
  )]

  let trackingMap = new Map<string, OriginalShipment>()
  if (trackingIds.length > 0) {
    const { data: trackings, error: tErr } = await supabase
      .from('ems_tracking')
      .select('id, ems_number, application_number, registered_date, status, last_update')
      .in('id', trackingIds)
    if (tErr) throw tErr
    trackingMap = new Map((trackings || []).map(t => [t.id, {
      ems_number:         t.ems_number || '—',
      application_number: t.application_number || '—',
      registered_date:    t.registered_date || '—',
      status:             t.status || '—',
      last_update:        t.last_update || '—',
    }]))
  }

  return (data || []).map((row: any) => {
    const ci  = row.confirmed_influencers || {}
    const inf = ci.influencers || {}
    const original = row.original_tracking_id
      ? trackingMap.get(row.original_tracking_id) ?? null
      : null
    return {
      id:                row.id,
      name:              inf.display_name || inf.handle || '—',
      email:             ci.email || null,
      email_sent:        row.email_sent ?? false,
      tracking:          row.ems_number || '—',
      applicationNumber: row.application_number || '—',
      sentDate:          row.registered_date || '—',
      country:           ci.country || '—',
      reason:            row.error_reason || '—',
      status:            row.status || '처리 대기',
      carrierStatus:     row.carrier_status || 'Preparing',
      original,
    }
  })
}

/** Insert reship row from original ems_tracking snapshot (checkbox ON). */
export async function createEmsReship(
  confirmedInfluencerId: string,
  tracking: EmsTrackingSnapshot,
) {
  return supabase.from('ems_reshipments').insert({
    confirmed_influencer_id: confirmedInfluencerId,
    original_tracking_id:    tracking.id,
    email_sent:              tracking.email_sent ?? false,
    ems_number:              null,
    application_number:      null,
    registered_date:         null,
    carrier_status:          'Preparing',
    last_update:             null,
    error_reason:            null,
    status:                  '처리 대기',
  }).select('id').single()
}

export async function deleteEmsReship(confirmedInfluencerId: string) {
  return supabase.from('ems_reshipments').delete().eq('confirmed_influencer_id', confirmedInfluencerId)
}

export async function updateEmsReship(
  reshipId: string,
  payload: {
    status?:             string | null
    error_reason?:       string | null
    carrier_status?:     string | null
    ems_number?:         string | null
    registered_date?:    string | null
    application_number?: string | null
    last_update?:        string | null
    email_sent?:         boolean
  },
) {
  return supabase.from('ems_reshipments').update(payload).eq('id', reshipId)
}
