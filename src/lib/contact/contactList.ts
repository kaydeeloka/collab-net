export interface ContactInfluencer {
  id: string
  name: string
  handle: string
  email: string
  followers: string
  avgViews: string
  status: 'pending' | 'sent' | 'accepted'
  addedAt: string
}

const KEY = 'mm_contact_list'

export function loadContactList(): ContactInfluencer[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}

export function saveContactList(list: ContactInfluencer[]) {
  localStorage.setItem(KEY, JSON.stringify(list))
}

export function addToContactList(inf: Omit<ContactInfluencer, 'id' | 'status' | 'addedAt'>): boolean {
  const list = loadContactList()
  if (list.some(x => x.handle === inf.handle)) return false
  const next = [...list, {
    ...inf,
    id: `${inf.handle}_${Date.now()}`,
    status: 'pending' as const,
    addedAt: new Date().toISOString(),
  }]
  saveContactList(next)
  return true
}
