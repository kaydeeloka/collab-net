/** Keep in sync with api/17-track.gs TRACK17_STATUS */
export const TRACK17_STATUS = {
  NotFound:           { label: 'Not Found',            color: '#9e9e9e' },
  InfoReceived:       { label: 'Info Received',         color: '#00bcd4' },
  InTransit:          { label: 'In Transit',            color: '#1e88e5' },
  Expired:            { label: 'Expired',               color: '#b71c1c' },
  AvailableForPickup: { label: 'Available for Pickup',  color: '#8e24aa' },
  OutForDelivery:     { label: 'Out for Delivery',      color: '#42a5f5' },
  DeliveryFailure:    { label: 'Delivery Failure',      color: '#fb8c00' },
  Delivered:          { label: 'Delivered',             color: '#43a047' },
  Exception:          { label: 'Exception',             color: '#e53935' },
} as const

/** Manual pre-carrier status (not from 17track) */
export const MANUAL_RECEIVED_STATUS = '접수완료'

const TRACK17_LABELS = Object.values(TRACK17_STATUS).map(s => s.label)

/** Dropdown + filter options */
export const EMS_STATUS_OPTIONS = [MANUAL_RECEIVED_STATUS, ...TRACK17_LABELS] as const

/** Badge colors keyed by stored status label */
export const EMS_STATUS_COLORS: Record<string, string> = {
  [MANUAL_RECEIVED_STATUS]: '#6366f1',
  ...Object.fromEntries(TRACK17_LABELS.map(label => {
    const entry = Object.values(TRACK17_STATUS).find(s => s.label === label)
    return [label, entry?.color ?? '#94a3b8']
  })),
  // Legacy values still in Supabase from older 17track sync mapping
  Preparing: TRACK17_STATUS.InfoReceived.color,
}

export const EMS_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: '전체' },
  ...EMS_STATUS_OPTIONS.map(status => ({ value: status, label: status })),
]

export function getEmsStatusColor(status: string | null | undefined): string {
  if (!status) return '#94a3b8'
  return EMS_STATUS_COLORS[status] ?? '#94a3b8'
}

/** Compact select width from visible label (avoids sizing to longest option). */
export function emsStatusSelectWidth(status: string): string {
  // Hand-tuned: short labels need extra room; Delivered needs a touch more before chevron
  const widthRem: Record<string, number> = {
    [MANUAL_RECEIVED_STATUS]: 8,
    'Not Found':              7.6,
    'Expired':                7.1,
    'Exception':              7.6,
    'Delivered':              7.3,
  }
  if (widthRem[status] != null) return `${widthRem[status]}rem`

  const units = [...status].reduce(
    (n, c) => n + (c.charCodeAt(0) > 127 ? 0.95 : 0.58),
    0,
  )
  return `calc(${units.toFixed(2)}em + 1.25rem)`
}

const IN_TRANSIT = new Set<string>([
  'Preparing',
  TRACK17_STATUS.InfoReceived.label,
  TRACK17_STATUS.InTransit.label,
  TRACK17_STATUS.OutForDelivery.label,
  TRACK17_STATUS.AvailableForPickup.label,
])

const EXCEPTION = new Set<string>([
  TRACK17_STATUS.Exception.label,
  TRACK17_STATUS.DeliveryFailure.label,
  TRACK17_STATUS.Expired.label,
  TRACK17_STATUS.NotFound.label,
])

export function isEmsInTransit(status: string | null | undefined): boolean {
  return !!status && IN_TRANSIT.has(status)
}

export function isEmsDelivered(status: string | null | undefined): boolean {
  return status === TRACK17_STATUS.Delivered.label
}

export function isEmsException(status: string | null | undefined): boolean {
  return !!status && EXCEPTION.has(status)
}
