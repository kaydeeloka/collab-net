import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ListFilter } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { PLATFORM_OPTIONS, defaultProfileUrl } from '../../../lib/content-platforms'
import { usePhase } from '../../../contexts/PhaseContext'
import { useToast } from '../../../contexts/ToastContext'
import Spinner from '../../../components/Spinner'
import Modal from '../../../components/Modal'

const GOOGLE_FORM_URL = ''

const EMS_STATUS_COLORS: Record<string, string> = {
  '접수완료'   : '#6366f1',
  'Preparing'  : '#94a3b8',
  'In Transit' : '#6a95a5',
  'Delivered'  : '#27ae60',
  'Exception'  : '#e74c3c',
}

type UploadStatus     = 'Pending' | 'Yes' | 'No' | 'all'
type ReviewLinkFilter = 'all' | 'has' | 'none'

interface InfluencerPlatform {
  id:          string | null
  platform:    string
  handle:      string
  followers:   number
  profile_url: string
}

interface MonitoringReview {
  id:          string
  review_link: string
  brand:       string | null
  date:        string | null
  content:     string | null
  platform:    string | null
}

interface InfluencerRef {
  platform:     string | null
  handle:       string | null
  display_name: string | null
  followers:    number | null
  profile_url:  string | null
}

interface ConfirmedRow {
  id:                   string
  seq:                  number | null
  email:                string | null
  upload_status:        string
  repost:               string | null
  review_links:         MonitoringReview[]
  notes:                string | null
  form_submitted:       boolean | null
  phone:                string | null
  address_line_1:       string | null
  address_line_2:       string | null
  city:                 string | null
  state:                string | null
  zip:                  string | null
  country:              string | null
  handle:               string | null
  display_name:         string | null
  ems_number:           string | null
  ems_status:           string | null
  influencer_platform: InfluencerPlatform[]
  influencers:          InfluencerRef | null
}

const INFLUENCER_TARGET = 50

const BRANDS = ['mimuse', 'aesthen', 'joodoc', 'nesh', 'varuza'] as const
const BRAND_COLORS: Record<(typeof BRANDS)[number], string> = {
  mimuse:  '#3b82f6',
  aesthen: '#8b5cf6',
  joodoc:  '#ec4899',
  nesh:    '#f59e0b',
  varuza:  '#10b981',
}

function emptyBrandCounts(): Record<(typeof BRANDS)[number], number> {
  return { mimuse: 0, aesthen: 0, joodoc: 0, nesh: 0, varuza: 0 }
}

function computeBrandCounts(data: { influencer_platform?: { monitoring?: { brand: string | null }[] }[] }[]): Record<(typeof BRANDS)[number], number> {
  const counts = emptyBrandCounts()
  for (const r of data) {
    for (const p of r.influencer_platform ?? []) {
      for (const m of p.monitoring ?? []) {
        const b = (m.brand || '').toLowerCase() as (typeof BRANDS)[number]
        if (b in counts) counts[b]++
      }
    }
  }
  return counts
}

const EMPTY_FORM = {
  phone: '', repost: '', notes: '',
  addr1: '', addr2: '', city: '', state: '', zip: '', country: '',
}

function isValidReviewLink(link: string | null | undefined): boolean {
  return !!link && link.startsWith('http')
}

function reviewLinkLabel(link: MonitoringReview, index: number): string {
  if (link.brand) return link.brand
  if (link.content) return link.content.length > 24 ? `${link.content.slice(0, 24)}…` : link.content
  return `리뷰 ${index + 1}`
}

function extractReviewLinks(
  platforms: { platform: string; monitoring?: { id: string; review_link: string | null; brand: string | null; date: string | null; content: string | null }[] }[],
  legacyLink?: string | null,
): MonitoringReview[] {
  const links: MonitoringReview[] = []
  for (const p of platforms) {
    for (const m of p.monitoring ?? []) {
      if (!isValidReviewLink(m.review_link)) continue
      links.push({
        id:          m.id,
        review_link: m.review_link!,
        brand:       m.brand,
        date:        m.date,
        content:     m.content,
        platform:    p.platform,
      })
    }
  }
  if (!links.length && isValidReviewLink(legacyLink)) {
    links.push({
      id:          'legacy',
      review_link: legacyLink!,
      brand:       null,
      date:        null,
      content:     null,
      platform:    null,
    })
  }
  return links.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
}

function rowHasPlatform(row: ConfirmedRow, key: string): boolean {
  const match = (platform: string | null | undefined) => platform?.toLowerCase().includes(key) ?? false
  if (row.influencer_platform.some(p => match(p.platform))) return true
  return match(row.influencers?.platform)
}

function effectiveUploadStatus(row: ConfirmedRow): 'Yes' | 'No' | 'Pending' {
  if (row.review_links.length > 0) return 'Yes'
  if (row.upload_status === 'No') return 'No'
  return 'Pending'
}

function fmtFollowers(n: number | null): string {
  if (!n) return '—'
  if (n >= 1_000_000) {
    const v = n / 1_000_000
    return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + 'M'
  }
  if (n >= 1_000) {
    const v = n / 1_000
    return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + 'K'
  }
  return String(n)
}

const PLATFORM_CFG: Record<string, { bg: string; color: string; label: string }> = {
  tiktok:    { bg: '#111',                                                            color: '#fff', label: 'TikTok' },
  instagram: { bg: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', color: '#fff', label: 'Instagram' },
  youtube:   { bg: '#ff0000',                                                          color: '#fff', label: 'YouTube' },
  facebook:  { bg: '#1877f2',                                                          color: '#fff', label: 'Facebook' },
  magazine:  { bg: '#6366f1',                                                          color: '#fff', label: 'Magazine' },
}

function PlatformBadge({ platform }: { platform: string | null }) {
  if (!platform) return <span style={{ color: 'var(--gray-4)', fontSize: 11 }}>—</span>
  const key = platform.toLowerCase()
  const cfg = Object.entries(PLATFORM_CFG).find(([k]) => key.includes(k))?.[1]
    ?? { bg: 'var(--gray-3)', color: 'var(--gray-6)', label: platform }
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 5,
      fontSize: 10, fontWeight: 700, letterSpacing: '.2px', lineHeight: '17px',
      background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap', flexShrink: 0,
    }}>{cfg.label}</span>
  )
}

function ReviewLinksCell({ links }: { links: MonitoringReview[] }) {
  if (!links.length) return <span style={{ color: 'var(--gray-4)', fontSize: 11 }}>—</span>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {links.map((l, i) => (
        <a key={l.id} href={l.review_link} target="_blank" rel="noopener" className="video-link" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
          ↗ {reviewLinkLabel(l, i)}
        </a>
      ))}
    </div>
  )
}

function EmsShippingCell({
  addressLine1,
  addressLine2,
  city,
  state,
  zip,
  country,
  emsNumber,
  emsStatus,
}: {
  addressLine1: string | null
  addressLine2: string | null
  city:         string | null
  state:        string | null
  zip:          string | null
  country:      string | null
  emsNumber:    string | null
  emsStatus:    string | null
}) {
  const line1 = [addressLine1, addressLine2].filter(Boolean).join(', ')
  const line2 = [city, state && zip ? `${state} ${zip}` : (state || zip)].filter(Boolean).join(', ')
  const hasAddress = !!(line1 || line2 || country)
  const hasEms = !!(emsNumber || emsStatus)

  if (!hasAddress && !hasEms) {
    return <span style={{ fontSize: 11, color: 'var(--gray-4)' }}>—</span>
  }

  const badgeColor = EMS_STATUS_COLORS[emsStatus || ''] || '#94a3b8'
  return (
    <div>
      {hasAddress && (
        <div style={{ fontSize: 11, color: 'var(--gray-7)', lineHeight: 1.5, marginBottom: hasEms ? 8 : 0, whiteSpace: 'normal' }}>
          {line1 && <div>{line1}</div>}
          {(line2 || country) && <div style={{ color: 'var(--gray-5)' }}>{[line2, country].filter(Boolean).join(' · ')}</div>}
        </div>
      )}
      {emsNumber
        ? <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--gray-7)', fontWeight: 600, wordBreak: 'break-all' }}>{emsNumber}</span>
        : hasEms
          ? <span style={{ fontSize: 11, color: 'var(--gray-4)' }}>—</span>
          : null}
      {emsStatus && (
        <div style={{ marginTop: 4 }}>
          <span style={{ background: badgeColor, color: '#fff', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{emsStatus}</span>
        </div>
      )}
    </div>
  )
}

function ViewField({ label, children, span }: { label: string; children: React.ReactNode; span?: boolean }) {
  return (
    <div style={span ? { gridColumn: '1 / -1' } : undefined}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-4)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--gray-8)', fontWeight: 500 }}>{children}</div>
    </div>
  )
}

function ViewInfoBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--gray-1)', border: '1px solid var(--gray-2)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--gray-6)', lineHeight: 1.6 }}>{children}</div>
    </div>
  )
}

function PlatformAccountsCell({ accounts }: { accounts: InfluencerPlatform[] }) {
  if (!accounts.length) return <span style={{ color: 'var(--gray-4)', fontSize: 11 }}>—</span>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {accounts.map((a, i) => (
        <div key={`${a.id ?? i}`} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
          <PlatformBadge platform={a.platform} />
          {a.handle && <span style={{ fontSize: 11, color: 'var(--gray-6)', fontWeight: 500 }}>@{a.handle}</span>}
          {(a.followers ?? 0) > 0 && <span style={{ fontSize: 10, color: 'var(--gray-4)', fontWeight: 600 }}>{fmtFollowers(a.followers)}</span>}
        </div>
      ))}
    </div>
  )
}

function emptyPlatform(): InfluencerPlatform {
  return { id: null, platform: 'TikTok', handle: '', followers: 0, profile_url: '' }
}

export default function Confirmed() {
  const { selectedPhaseId } = usePhase()
  const { showToast }       = useToast()

  const [rows,    setRows]    = useState<ConfirmedRow[]>([])
  const [brandCounts, setBrandCounts] = useState(emptyBrandCounts())
  const [loading, setLoading] = useState(false)
  const [search,  setSearch]  = useState('')
  const [syncMsg, setSyncMsg] = useState('')

  const [uploadFilter,     setUploadFilter]     = useState<UploadStatus>('all')
  const [reviewLinkFilter, setReviewLinkFilter] = useState<ReviewLinkFilter>('all')
  const [platformFilter,   setPlatformFilter]   = useState('all')
  const [showUploadFilter,     setShowUploadFilter]     = useState(false)
  const [showReviewLinkFilter, setShowReviewLinkFilter] = useState(false)
  const [showPlatformFilter,   setShowPlatformFilter]   = useState(false)
  const uploadFilterRef     = useRef<HTMLDivElement>(null)
  const reviewLinkFilterRef = useRef<HTMLDivElement>(null)
  const platformFilterRef   = useRef<HTMLDivElement>(null)

  const [showView, setShowView] = useState(false)
  const [viewRow,  setViewRow]  = useState<ConfirmedRow | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  const [editId,       setEditId]       = useState('')
  const [editForm,     setEditForm]     = useState(EMPTY_FORM)
  const [editPlatforms, setEditPlatforms] = useState<InfluencerPlatform[]>([])
  const originalPlatformIds = useRef<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (selectedPhaseId) load() }, [selectedPhaseId])

  useEffect(() => {
    if (!showUploadFilter && !showReviewLinkFilter && !showPlatformFilter) return
    const handler = (e: MouseEvent) => {
      if (uploadFilterRef.current     && !uploadFilterRef.current.contains(e.target as Node))     setShowUploadFilter(false)
      if (reviewLinkFilterRef.current && !reviewLinkFilterRef.current.contains(e.target as Node)) setShowReviewLinkFilter(false)
      if (platformFilterRef.current   && !platformFilterRef.current.contains(e.target as Node))   setShowPlatformFilter(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showUploadFilter, showReviewLinkFilter, showPlatformFilter])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('confirmed_influencers')
      .select(`
        id, seq, email, upload_status, repost, review_link, notes, form_submitted,
        phone, address_line_1, address_line_2, city, state, zip, country,
        influencer_platform(
          id, platform, handle, followers, profile_url,
          monitoring(id, review_link, brand, date, content)
        ),
        influencers(platform, handle, display_name, followers, profile_url),
        ems_tracking(id, ems_number, status)
      `)
      .eq('phase_id', selectedPhaseId ?? '')
      .order('seq', { ascending: true, nullsFirst: false })

    if (error) { showToast(error.message, 'error'); setLoading(false); return }

    const mapped: ConfirmedRow[] = (data ?? []).map((r: any) => {
      const ems = (r.ems_tracking || [])[0] || {}
      return {
      id:             r.id,
      seq:            r.seq ?? null,
      email:          r.email,
      upload_status:  r.upload_status ?? 'Pending',
      repost:         r.repost,
      review_links:   extractReviewLinks(r.influencer_platform ?? [], r.review_link),
      notes:          r.notes,
      form_submitted: r.form_submitted,
      phone:          r.phone,
      address_line_1: r.address_line_1,
      address_line_2: r.address_line_2,
      city:           r.city,
      state:          r.state,
      zip:            r.zip,
      country:        r.country,
      handle:         r.influencers?.handle       ?? null,
      display_name:   r.influencers?.display_name ?? null,
      ems_number:     ems.ems_number ?? null,
      ems_status:     ems.status     ?? null,
      influencer_platform: (r.influencer_platform ?? []).map((p: any) => ({
        id:          p.id,
        platform:    p.platform,
        handle:      p.handle   ?? '',
        followers:   p.followers ?? 0,
        profile_url: p.profile_url ?? '',
      })),
      influencers: r.influencers ?? null,
      }
    })

    const idsToYes = mapped
      .filter(r => r.review_links.length > 0 && r.upload_status !== 'Yes')
      .map(r => r.id)
    const idsToPending = mapped
      .filter(r => r.review_links.length === 0 && r.upload_status === 'Yes')
      .map(r => r.id)

    if (idsToYes.length) {
      const { error: syncError } = await supabase
        .from('confirmed_influencers')
        .update({ upload_status: 'Yes' })
        .in('id', idsToYes)
      if (syncError) showToast(syncError.message, 'error')
      else {
        for (const row of mapped) {
          if (idsToYes.includes(row.id)) row.upload_status = 'Yes'
        }
      }
    }

    if (idsToPending.length) {
      const { error: syncError } = await supabase
        .from('confirmed_influencers')
        .update({ upload_status: 'Pending' })
        .in('id', idsToPending)
      if (syncError) showToast(syncError.message, 'error')
      else {
        for (const row of mapped) {
          if (idsToPending.includes(row.id)) row.upload_status = 'Pending'
        }
      }
    }

    setRows(mapped)
    setBrandCounts(computeBrandCounts(data ?? []))
    setSyncMsg(`마지막 동기화: ${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`)
    setLoading(false)
  }

  async function updateField(id: string, field: string, value: string) {
    const { error } = await supabase.from('confirmed_influencers').update({ [field]: value }).eq('id', id)
    if (error) showToast(error.message, 'error')
    else setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  function openEdit(r: ConfirmedRow) {
    setEditId(r.id)
    setEditForm({
      phone:       r.phone          || '',
      repost:      r.repost         || '',
      notes:       r.notes          || '',
      addr1:       r.address_line_1 || '',
      addr2:       r.address_line_2 || '',
      city:        r.city           || '',
      state:       r.state          || '',
      zip:         r.zip            || '',
      country:     r.country        || '',
    })
    const platforms = r.influencer_platform.length
      ? r.influencer_platform.map(p => ({ ...p }))
      : r.influencers
        ? [{ id: null, platform: r.influencers.platform || 'TikTok', handle: r.influencers.handle || '', followers: r.influencers.followers || 0, profile_url: r.influencers.profile_url || '' }]
        : [emptyPlatform()]
    setEditPlatforms(platforms)
    originalPlatformIds.current = r.influencer_platform.map(p => p.id!).filter(Boolean)
    setShowEdit(true)
  }

  function updateEditPlatform(index: number, patch: Partial<InfluencerPlatform>) {
    setEditPlatforms(prev => prev.map((a, i) => {
      if (i !== index) return a
      const updated = { ...a, ...patch }
      if ((patch.platform || patch.handle) && !updated.profile_url) {
        updated.profile_url = defaultProfileUrl(updated.platform, updated.handle)
      }
      return updated
    }))
  }

  async function saveEdit() {
    setSaving(true)
    try {
      const currentIds = new Set(editPlatforms.map(p => p.id).filter(Boolean) as string[])
      const deletedIds  = originalPlatformIds.current.filter(id => !currentIds.has(id))

      // UPDATE existing, INSERT new
      for (const p of editPlatforms) {
        const payload = {
          confirmed_influencer_id: editId,
          platform:    p.platform,
          handle:      p.handle      || null,
          followers:   p.followers   || 0,
          profile_url: p.profile_url || null,
        }
        if (p.id) {
          const { error } = await supabase.from('influencer_platform').update(payload).eq('id', p.id)
          if (error) throw error
        } else {
          const { error } = await supabase.from('influencer_platform').insert(payload)
          if (error) throw error
        }
      }

      // DELETE removed platforms (silently skip if monitoring FK blocks it)
      for (const id of deletedIds) {
        await supabase.from('influencer_platform').delete().eq('id', id)
      }

      // Save other fields
      const { error } = await supabase.from('confirmed_influencers').update({
        phone:          editForm.phone       || null,
        repost:         editForm.repost      || null,
        address_line_1: editForm.addr1       || null,
        address_line_2: editForm.addr2       || null,
        city:           editForm.city        || null,
        state:          editForm.state       || null,
        zip:            editForm.zip         || null,
        country:        editForm.country     || null,
        notes:          editForm.notes       || null,
      }).eq('id', editId)
      if (error) throw error

      showToast('저장 완료', 'success')
      setShowEdit(false)
      load()
    } catch (e: unknown) {
      showToast((e as Error).message, 'error')
    }
    setSaving(false)
  }

  const platforms = Array.from(new Set(
    rows.flatMap(r => r.influencer_platform.map(p => p.platform)).filter(Boolean),
  )) as string[]

  const filtered = rows.filter(r => {
    if (uploadFilter !== 'all' && effectiveUploadStatus(r) !== uploadFilter) return false
    if (reviewLinkFilter === 'has'  && !r.review_links.length) return false
    if (reviewLinkFilter === 'none' && r.review_links.length)  return false
    if (platformFilter !== 'all' && !r.influencer_platform.some(p => p.platform === platformFilter)) return false
    if (search) {
      const q    = search.toLowerCase()
      const text = [r.influencers?.display_name, r.influencers?.handle, r.display_name, r.handle, r.email,
        ...r.influencer_platform.map(p => p.handle)].join(' ').toLowerCase()
      if (!text.includes(q)) return false
    }
    return true
  })

  const total    = rows.length
  const uploaded = rows.filter(r => effectiveUploadStatus(r) === 'Yes').length
  const noUpload = rows.filter(r => effectiveUploadStatus(r) === 'No').length
  const targetPct = Math.min(Math.round(total / INFLUENCER_TARGET * 100), 100)
  const platformCounts = {
    tiktok:    rows.filter(r => rowHasPlatform(r, 'tiktok')).length,
    instagram: rows.filter(r => rowHasPlatform(r, 'instagram')).length,
    magazine:  rows.filter(r => rowHasPlatform(r, 'magazine')).length,
  }
  const delivered      = rows.filter(r => r.ems_status === 'Delivered').length
  const shippingErrors = rows.filter(r => r.ems_status === 'Exception').length

  function cycleUpload(id: string, current: string) {
    const next = current === 'Pending' ? 'Yes' : current === 'Yes' ? 'No' : 'Pending'
    updateField(id, 'upload_status', next)
  }

  async function toggleFormSubmitted(id: string, current: boolean | null) {
    const next = !current
    const { error } = await supabase.from('confirmed_influencers').update({ form_submitted: next }).eq('id', id)
    if (error) showToast(error.message, 'error')
    else setRows(prev => prev.map(r => r.id === id ? { ...r, form_submitted: next } : r))
  }

  const UPLOAD_OPTIONS = [
    { value: 'all',     label: '전체' },
    { value: 'Pending', label: '대기' },
    { value: 'Yes',     label: '완료' },
    { value: 'No',      label: '미업로드' },
  ]
  const REVIEW_LINK_OPTIONS = [
    { value: 'all',  label: '전체' },
    { value: 'has',  label: '링크 있음' },
    { value: 'none', label: '링크 없음' },
  ]

  const thBase: React.CSSProperties = {
    position: 'sticky', top: 0, zIndex: 1,
    background: '#f0f5f8',
    padding: '13px 18px',
    textAlign: 'left', fontSize: 11, fontWeight: 700,
    color: 'var(--teal-dk)', textTransform: 'uppercase', letterSpacing: '.8px',
    borderBottom: '2px solid var(--teal-lt)', whiteSpace: 'nowrap',
  }

  const seqTd: React.CSSProperties = {
    textAlign: 'center',
    fontSize: 11,
    color: 'var(--gray-5)',
    whiteSpace: 'normal',
    wordBreak: 'break-word',
    overflow: 'visible',
    textOverflow: 'clip',
    maxWidth: 'none',
    padding: '10px 6px',
    verticalAlign: 'middle',
  }

  const notesTd: React.CSSProperties = {
    padding: '8px 10px',
    whiteSpace: 'normal',
    verticalAlign: 'middle',
    maxWidth: 110,
    width: 110,
    overflow: 'hidden',
  }

  const field = (label: string, key: keyof typeof EMPTY_FORM, opts?: { type?: string; placeholder?: string }) => (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>{label}</label>
      <input type={opts?.type || 'text'} placeholder={opts?.placeholder}
        value={editForm[key]} onChange={e => setEditForm(prev => ({ ...prev, [key]: e.target.value }))}
        style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
    </div>
  )

  const selectField = (label: string, key: keyof typeof EMPTY_FORM, options: string[], placeholder = '선택') => (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>{label}</label>
      <select value={editForm[key]} onChange={e => setEditForm(prev => ({ ...prev, [key]: e.target.value }))}
        style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 12, outline: 'none', background: '#fff', fontFamily: 'inherit', cursor: 'pointer' }}>
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )

  return (
    <div className="page page--fill">
      <div className="page-banner">
        <div>
          <div className="page-banner-title">확정 인플루언서 관리</div>
          <div className="page-banner-desc">아웃리치에서 수락된 인플루언서 목록입니다. ✎ 버튼으로 상세 정보를 추가하세요.</div>
        </div>
        <div className="page-banner-actions">
          <Link to="/monitoring/reviews" className="page-banner-btn"
            style={{ textDecoration: 'none', background: 'var(--teal-dk)', color: '#fff', border: '1px solid var(--teal-dk)' }}>
            리뷰 모니터링으로 이동
          </Link>
          <Link to="/kit/ems" className="page-banner-btn"
            style={{ textDecoration: 'none', background: 'var(--teal)', color: '#fff', border: '1px solid var(--teal)' }}>
            배송 추적 보기
          </Link>
          {GOOGLE_FORM_URL && (
            <a href={GOOGLE_FORM_URL} target="_blank" rel="noopener"
              className="page-banner-btn page-banner-btn--secondary" style={{ textDecoration: 'none' }}>
              구글폼 보기
            </a>
          )}
          <button className="page-banner-btn page-banner-btn--secondary" onClick={load}>
            {loading ? <Spinner sm /> : <span style={{ color: 'var(--blue-dk)' }}>↻</span>} 새로고침
          </button>
        </div>
      </div>

      {loading && <div className="loader"><Spinner />데이터 불러오는 중...</div>}

      {!loading && (
        <>
          <div className="cards" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr)) minmax(320px, 1.75fr)' }}>
            <div className="card">
              <div className="card-label">총 확정 인플루언서</div>
              <div className="card-value">
                {targetPct}<span style={{ fontSize: 14, fontWeight: 500, color: 'var(--gray-5)' }}>%</span>
              </div>
              <div className="card-sub">{total} / {INFLUENCER_TARGET}명</div>
              <div style={{ marginTop: 6, height: 4, background: 'var(--gray-2)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${targetPct}%`, background: 'var(--teal-dk)', borderRadius: 99, transition: 'width .4s' }} />
              </div>
              <div style={{ fontSize: 11, marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '4px 0', lineHeight: 1.8 }}>
                {([
                  { key: 'tiktok',    label: 'TikTok',    count: platformCounts.tiktok,    color: '#111' },
                  { key: 'instagram', label: 'Instagram', count: platformCounts.instagram, color: '#dc2743' },
                  { key: 'magazine',  label: 'Magazine',  count: platformCounts.magazine,  color: '#6366f1' },
                ] as const).map((p, i) => (
                  <span key={p.key}>
                    {i > 0 && <span style={{ margin: '0 6px', color: 'var(--gray-3)' }}>·</span>}
                    <span style={{ color: p.color, fontWeight: 700 }}>{p.label}</span>
                    <strong style={{ color: 'var(--gray-7)', marginLeft: 4 }}>{p.count}</strong>
                  </span>
                ))}
              </div>
            </div>
            <div className="card highlight">
              <div className="card-label">콘텐츠 업로드</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'start', width: '100%' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6, justifyContent: 'center' }}>
                    <span style={{ fontSize: 36, fontWeight: 800, color: '#14532d', letterSpacing: '-1px' }}>{uploaded}</span>
                    <span style={{ fontSize: 13, color: 'var(--gray-5)', fontWeight: 500 }}>명</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, marginBottom: 4 }}>완료</div>
                  <div className="card-sub" style={{ marginTop: 0 }}>{total ? Math.round(uploaded / total * 100) : 0}% 완료율</div>
                </div>
                <div style={{ width: 1, height: 48, background: 'var(--gray-2)', marginTop: 4 }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6, justifyContent: 'center' }}>
                    <span style={{ fontSize: 36, fontWeight: 800, color: '#991b1b', letterSpacing: '-1px' }}>{noUpload}</span>
                    <span style={{ fontSize: 13, color: 'var(--gray-5)', fontWeight: 500 }}>명</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>미업로드</div>
                </div>
              </div>
            </div>
            <div className="card highlight">
              <div className="card-label">배송</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'start', width: '100%' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6, justifyContent: 'center' }}>
                    <span style={{ fontSize: 36, fontWeight: 800, color: '#14532d', letterSpacing: '-1px' }}>{delivered}</span>
                    <span style={{ fontSize: 13, color: 'var(--gray-5)', fontWeight: 500 }}>명</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, marginBottom: 4 }}>배송 완료</div>
                  <div className="card-sub" style={{ marginTop: 0 }}>{total ? Math.round(delivered / total * 100) : 0}% 완료율</div>
                </div>
                <div style={{ width: 1, height: 48, background: 'var(--gray-2)', marginTop: 4 }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6, justifyContent: 'center' }}>
                    <span style={{ fontSize: 36, fontWeight: 800, color: '#991b1b', letterSpacing: '-1px' }}>{shippingErrors}</span>
                    <span style={{ fontSize: 13, color: 'var(--gray-5)', fontWeight: 500 }}>명</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>배송 오류</div>
                </div>
              </div>
            </div>
            <div className="card highlight">
              <div className="card-label">브랜드 횟수</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', alignItems: 'start', width: '100%' }}>
                {BRANDS.map((brand, i) => {
                  const count = brandCounts[brand] ?? 0
                  return (
                    <div
                      key={brand}
                      style={{
                        textAlign: 'center',
                        minWidth: 0,
                        borderLeft: i > 0 ? '1px solid var(--gray-2)' : undefined,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6, justifyContent: 'center' }}>
                        <span style={{ fontSize: 36, fontWeight: 800, color: BRAND_COLORS[brand], letterSpacing: '-1px' }}>{count}</span>
                        <span style={{ fontSize: 13, color: 'var(--gray-5)', fontWeight: 500 }}>회</span>
                      </div>
                      <div style={{ fontSize: 11, color: BRAND_COLORS[brand], fontWeight: 600 }}>{brand}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="ems-toolbar" style={{ marginTop: 16 }}>
            <div className="section-title section-title--inline">확정 인플루언서 목록</div>
            <span className="ems-sync-msg">{syncMsg}</span>
          </div>

          <div className="filters" style={{ marginBottom: 16, marginTop: 12 }}>
            <input type="text" placeholder="이름, 이메일, 핸들로 검색..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, minWidth: 200, maxWidth: 360 }} />
          </div>

          <div className="table-wrap">
            <table style={{ tableLayout: 'fixed', width: '100%', marginBottom: 0 }}>
              <colgroup>
                <col style={{ width: 48 }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: 88 }} />
                <col style={{ width: 88 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: '24%' }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 52 }} />
              </colgroup>
              <thead>
                    <tr>
                      <th style={{ ...thBase, textAlign: 'center', width: 48, padding: '13px 6px', whiteSpace: 'normal' }}>No.</th>
                      <th style={thBase}>
                        <div ref={platformFilterRef} style={{ display: 'flex', alignItems: 'center', gap: 5, position: 'relative' }}>
                          <span>인플루언서</span>
                          <button onClick={() => { setShowPlatformFilter(p => !p); setShowUploadFilter(false); setShowReviewLinkFilter(false) }}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 4, border: 'none', background: platformFilter !== 'all' ? 'var(--teal-dk)' : 'transparent', color: platformFilter !== 'all' ? '#fff' : 'var(--teal-dk)', cursor: 'pointer', padding: 0, opacity: 0.8 }}>
                            <ListFilter size={13} />
                          </button>
                          {showPlatformFilter && (
                            <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: '#fff', border: '1px solid var(--gray-3)', borderRadius: 8, padding: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', minWidth: 130, marginTop: 4 }}>
                              {[{ value: 'all', label: '전체' }, ...platforms.map(p => ({ value: p, label: p }))].map(o => (
                                <button key={o.value} onClick={() => { setPlatformFilter(o.value); setShowPlatformFilter(false) }}
                                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', fontSize: 12, fontWeight: platformFilter === o.value ? 700 : 500, background: platformFilter === o.value ? '#d1fae5' : 'transparent', color: platformFilter === o.value ? '#065f46' : 'var(--gray-7)', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                                  {o.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </th>
                      <th style={thBase}>
                        <div ref={uploadFilterRef} style={{ display: 'flex', alignItems: 'center', gap: 5, position: 'relative' }}>
                          <span>리뷰 업로드</span>
                          <button onClick={() => { setShowUploadFilter(p => !p); setShowReviewLinkFilter(false) }}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 4, border: 'none', background: uploadFilter !== 'all' ? 'var(--teal-dk)' : 'transparent', color: uploadFilter !== 'all' ? '#fff' : 'var(--teal-dk)', cursor: 'pointer', padding: 0, opacity: 0.8 }}>
                            <ListFilter size={13} />
                          </button>
                          {showUploadFilter && (
                            <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: '#fff', border: '1px solid var(--gray-3)', borderRadius: 8, padding: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', minWidth: 130, marginTop: 4 }}>
                              {UPLOAD_OPTIONS.map(o => (
                                <button key={o.value} onClick={() => { setUploadFilter(o.value as UploadStatus); setShowUploadFilter(false) }}
                                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', fontSize: 12, fontWeight: uploadFilter === o.value ? 700 : 500, background: uploadFilter === o.value ? '#d1fae5' : 'transparent', color: uploadFilter === o.value ? '#065f46' : 'var(--gray-7)', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                                  {o.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </th>
                      <th style={{ ...thBase, textAlign: 'center' }}>구글폼 제출</th>
                      <th style={thBase}>
                        <div ref={reviewLinkFilterRef} style={{ display: 'flex', alignItems: 'center', gap: 5, position: 'relative' }}>
                          <span>리뷰 링크</span>
                          <button onClick={() => { setShowReviewLinkFilter(p => !p); setShowUploadFilter(false) }}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 4, border: 'none', background: reviewLinkFilter !== 'all' ? 'var(--teal-dk)' : 'transparent', color: reviewLinkFilter !== 'all' ? '#fff' : 'var(--teal-dk)', cursor: 'pointer', padding: 0, opacity: 0.8 }}>
                            <ListFilter size={13} />
                          </button>
                          {showReviewLinkFilter && (
                            <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: '#fff', border: '1px solid var(--gray-3)', borderRadius: 8, padding: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', minWidth: 130, marginTop: 4 }}>
                              {REVIEW_LINK_OPTIONS.map(o => (
                                <button key={o.value} onClick={() => { setReviewLinkFilter(o.value as ReviewLinkFilter); setShowReviewLinkFilter(false) }}
                                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', fontSize: 12, fontWeight: reviewLinkFilter === o.value ? 700 : 500, background: reviewLinkFilter === o.value ? '#dbeafe' : 'transparent', color: reviewLinkFilter === o.value ? '#1d4ed8' : 'var(--gray-7)', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                                  {o.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </th>
                      <th style={thBase}>배송</th>
                      <th style={{ ...thBase, width: 110, maxWidth: 110 }}>비고</th>
                      <th style={{ ...thBase, textAlign: 'center', width: 52, padding: '13px 6px' }}>편집</th>
                    </tr>
              </thead>
              <tbody>
                {filtered.length === 0
                  ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40, whiteSpace: 'normal' }}>
                        {rows.length === 0 ? '확정된 인플루언서가 없습니다.' : '검색 결과가 없습니다.'}
                      </td>
                    </tr>
                  )
                  : filtered.map((r) => {
                      const inf         = r.influencers
                      const platforms_  = r.influencer_platform
                      const firstP      = platforms_[0]
                      const handle      = firstP?.handle || inf?.handle || r.handle || ''
                      const displayName = inf?.display_name || r.display_name || ''
                      const profileUrl  = firstP?.profile_url || inf?.profile_url || ''
                      const hasReview    = r.review_links.length > 0
                      const uploadStatus = effectiveUploadStatus(r)
                      return (
                        <tr key={r.id} onClick={() => { setViewRow(r); setShowView(true) }} style={{ cursor: 'pointer' }}>
                          <td style={seqTd}>{r.seq ?? '—'}</td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--gray-8)' }}>
                                {displayName || handle || '—'}
                              </span>
                              {r.email && (
                                <a href={`mailto:${r.email}`} onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: 'var(--blue-dk)', wordBreak: 'break-all', textDecoration: 'none' }}>
                                  {r.email}
                                </a>
                              )}
                              {r.phone && (
                                <span style={{ fontSize: 11, color: 'var(--gray-5)', whiteSpace: 'nowrap' }}>{r.phone}</span>
                              )}
                              {platforms_.length > 0 && (
                                <div style={{ marginTop: 4 }} onClick={e => e.stopPropagation()}>
                                  <PlatformAccountsCell accounts={platforms_} />
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                            {(() => {
                              const s = uploadStatus
                              const cfg = s === 'Yes'
                                ? { label: '✓', bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' }
                                : s === 'No'
                                ? { label: '✕', bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' }
                                : { label: '—', bg: '#f1f5f9', color: '#94a3b8', border: '#e2e8f0' }
                              return (
                                <button onClick={() => !hasReview && cycleUpload(r.id, r.upload_status)}
                                  disabled={hasReview}
                                  style={{ width: 28, height: 28, borderRadius: '50%', border: `1.5px solid ${cfg.border}`, background: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: 13, cursor: hasReview ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {cfg.label}
                                </button>
                              )
                            })()}
                          </td>
                          <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                            <button onClick={() => toggleFormSubmitted(r.id, r.form_submitted)}
                              style={{ width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', border: `1.5px solid ${r.form_submitted ? '#6ee7b7' : '#e2e8f0'}`, background: r.form_submitted ? '#d1fae5' : '#f1f5f9', color: r.form_submitted ? '#065f46' : '#94a3b8', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                              {r.form_submitted ? '✓' : '—'}
                            </button>
                          </td>
                          <td onClick={e => e.stopPropagation()}>
                            <ReviewLinksCell links={r.review_links} />
                          </td>
                          <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'normal', overflow: 'visible', maxWidth: 'none' }}>
                            <EmsShippingCell
                              addressLine1={r.address_line_1}
                              addressLine2={r.address_line_2}
                              city={r.city}
                              state={r.state}
                              zip={r.zip}
                              country={r.country}
                              emsNumber={r.ems_number}
                              emsStatus={r.ems_status}
                            />
                          </td>
                          <td style={notesTd}>
                            <span style={{
                              fontSize: 11,
                              color: r.notes?.trim() ? 'var(--gray-7)' : 'var(--gray-4)',
                              lineHeight: 1.5,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              wordBreak: 'break-word',
                            }}>
                              {r.notes?.trim() || '—'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center', padding: '8px 6px', width: 52 }} onClick={e => e.stopPropagation()}>
                            <button onClick={() => openEdit(r)}
                              style={{ width: 28, height: 28, fontSize: 12, padding: 0, background: 'var(--blue-lt)', color: 'var(--blue-dk)', border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                              ✎
                            </button>
                          </td>
                        </tr>
                      )
                    })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── View Modal ── */}
      {viewRow && (() => {
        const r            = viewRow
        const inf          = r.influencers
        const vDisplayName = inf?.display_name || r.display_name || ''
        const vHandle      = r.influencer_platform[0]?.handle || inf?.handle || r.handle || ''
        const uploadStatus = effectiveUploadStatus(r)
        const uploadStyle  = uploadStatus === 'Yes'
          ? { bg: '#d1fae5', color: '#065f46', label: '완료' }
          : uploadStatus === 'No'
          ? { bg: '#fee2e2', color: '#991b1b', label: '미업로드' }
          : { bg: '#fef3c7', color: '#d97706', label: '대기중' }
        const addrParts = [r.address_line_1, r.address_line_2, r.city, [r.state, r.zip].filter(Boolean).join(' '), r.country].filter(Boolean) as string[]
        return (
          <Modal open={showView} onClose={() => setShowView(false)} title={vDisplayName || vHandle || '인플루언서 정보'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--gray-2)' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--gray-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                {(vDisplayName || vHandle || '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--gray-8)', marginBottom: 4 }}>{vDisplayName || vHandle || '—'}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {r.influencer_platform.length
                    ? r.influencer_platform.map((p, idx) => (
                      <div key={p.id ?? idx} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <PlatformBadge platform={p.platform} />
                        {p.handle && (
                          <a href={p.profile_url || '#'} target="_blank" rel="noopener"
                            style={{ fontSize: 13, color: 'var(--blue-dk)', textDecoration: 'none', fontWeight: 600 }}>
                            @{p.handle}
                          </a>
                        )}
                        <span style={{ fontSize: 12, color: 'var(--gray-5)' }}>{fmtFollowers(p.followers)} followers</span>
                      </div>
                    ))
                    : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <PlatformBadge platform={inf?.platform ?? null} />
                        {inf?.handle && <a href={inf.profile_url || '#'} target="_blank" rel="noopener" style={{ fontSize: 13, color: 'var(--blue-dk)', textDecoration: 'none', fontWeight: 600 }}>@{inf.handle}</a>}
                        {inf?.followers && <span style={{ fontSize: 12, color: 'var(--gray-5)' }}>{fmtFollowers(inf.followers)} followers</span>}
                      </div>
                    )}
                </div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: uploadStyle.bg, color: uploadStyle.color, flexShrink: 0 }}>
                리뷰 {uploadStyle.label}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', marginBottom: 16 }}>
              <ViewField label="No.">{r.seq ?? '—'}</ViewField>
              <ViewField label="리뷰 업로드">{uploadStyle.label}</ViewField>
              <ViewField label="E-mail">
                {r.email ? <a href={`mailto:${r.email}`} style={{ color: 'var(--blue-dk)', textDecoration: 'none' }}>{r.email}</a> : '—'}
              </ViewField>
              <ViewField label="Phone">{r.phone || '—'}</ViewField>
              <ViewField label="구글폼 제출">{r.form_submitted ? '✓ 제출 완료' : '—'}</ViewField>
              <ViewField label="Repost">{r.repost || '—'}</ViewField>
              <ViewField label={`리뷰 링크${r.review_links.length > 0 ? ` (${r.review_links.length})` : ''}`} span>
                {r.review_links.length
                  ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {r.review_links.map((l, i) => (
                        <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <a href={l.review_link} target="_blank" rel="noopener" className="video-link" style={{ fontSize: 13 }}>
                            ↗ {reviewLinkLabel(l, i)}
                          </a>
                          {l.platform && <PlatformBadge platform={l.platform} />}
                          {l.brand && <span style={{ fontSize: 11, color: 'var(--gray-5)' }}>{l.brand}</span>}
                          {l.date && <span style={{ fontSize: 11, color: 'var(--gray-5)' }}>{l.date}</span>}
                        </div>
                      ))}
                    </div>
                  )
                  : '—'}
              </ViewField>
              <ViewField label="비고" span>
                {r.notes?.trim() ? r.notes : '—'}
              </ViewField>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div style={{ background: 'var(--gray-1)', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-4)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>배송 주소</div>
                <div style={{ fontSize: 13, color: 'var(--gray-8)', lineHeight: 1.7 }}>
                  {addrParts.length
                    ? addrParts.map((line, i) => <div key={i}>{line}</div>)
                    : '—'}
                </div>
              </div>

              <ViewInfoBox title="등기번호 / 배송 상태">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-4)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>등기번호</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>
                      {r.ems_number
                        ? <span style={{ fontFamily: 'monospace', color: 'var(--gray-8)', fontWeight: 600, wordBreak: 'break-all' }}>{r.ems_number}</span>
                        : <span style={{ color: 'var(--gray-5)' }}>—</span>}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-4)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>배송 상태</div>
                    <div>
                      {r.ems_status
                        ? <span style={{ background: EMS_STATUS_COLORS[r.ems_status] || '#94a3b8', color: '#fff', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{r.ems_status}</span>
                        : <span style={{ fontSize: 13, color: 'var(--gray-5)' }}>—</span>}
                    </div>
                  </div>
                </div>
              </ViewInfoBox>
            </div>

            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button className="modal-btn-cancel" onClick={() => setShowView(false)}>닫기</button>
              <button className="modal-btn-confirm" onClick={() => { setShowView(false); openEdit(r) }}>✎ 편집</button>
            </div>
          </Modal>
        )
      })()}

      {/* ── Edit Modal ── */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="인플루언서 정보 입력">
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', margin: '4px 0 10px' }}>플랫폼 계정</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {editPlatforms.map((a, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 90px 1fr auto', gap: 8, alignItems: 'end', padding: 10, background: 'var(--gray-1)', borderRadius: 8 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-5)', display: 'block', marginBottom: 4 }}>플랫폼</label>
                <select value={a.platform} onChange={e => updateEditPlatform(i, { platform: e.target.value })}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 12 }}>
                  {PLATFORM_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-5)', display: 'block', marginBottom: 4 }}>핸들</label>
                <input value={a.handle} onChange={e => updateEditPlatform(i, { handle: e.target.value })}
                  placeholder="username"
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 12 }} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-5)', display: 'block', marginBottom: 4 }}>팔로워</label>
                <input type="number" min={0} value={a.followers || ''}
                  onChange={e => updateEditPlatform(i, { followers: Number(e.target.value) || 0 })}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 12 }} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-5)', display: 'block', marginBottom: 4 }}>프로필 URL</label>
                <input value={a.profile_url} onChange={e => updateEditPlatform(i, { profile_url: e.target.value })}
                  placeholder="https://..."
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 12 }} />
              </div>
              <button type="button" onClick={() => setEditPlatforms(prev => prev.filter((_, idx) => idx !== i))}
                disabled={editPlatforms.length <= 1}
                style={{ fontSize: 11, padding: '6px 8px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff', color: '#dc2626', cursor: editPlatforms.length <= 1 ? 'not-allowed' : 'pointer' }}>
                삭제
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setEditPlatforms(prev => [...prev, emptyPlatform()])}
            style={{ alignSelf: 'flex-start', fontSize: 12, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--gray-3)', background: '#fff', cursor: 'pointer' }}>
            + 플랫폼 추가
          </button>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', margin: '4px 0 10px' }}>연락처</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          {field('Phone', 'phone', { placeholder: '+1 310-555-0000' })}
          {selectField('Repost', 'repost', ['O', '▲', 'X'], '선택')}
        </div>
        <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 10, background: 'var(--gray-1)', border: '1px solid var(--gray-2)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>리뷰 링크</div>
          <div style={{ fontSize: 12, color: 'var(--gray-6)', lineHeight: 1.6 }}>
            리뷰 링크는 <Link to="/monitoring/reviews" style={{ color: 'var(--blue-dk)', fontWeight: 600 }}>리뷰 모니터링</Link> 페이지에서 관리합니다.
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>비고</label>
          <textarea
            value={editForm.notes}
            onChange={e => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="메모..."
            rows={3}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 12, outline: 'none', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5 }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16, alignItems: 'start' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', margin: '0 0 10px' }}>배송 주소</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {field('Address Line 1', 'addr1', { placeholder: 'Street address' })}
              {field('Address Line 2', 'addr2', { placeholder: 'Apartment, suite, unit (optional)' })}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {field('City', 'city', { placeholder: 'Los Angeles' })}
                {field('State / Province', 'state', { placeholder: 'CA' })}
                {field('ZIP / Postal Code', 'zip', { placeholder: '90001' })}
                {field('Country', 'country', { placeholder: 'United States' })}
              </div>
            </div>
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--gray-1)', border: '1px solid var(--gray-2)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>등기번호 / 배송 상태</div>
            <div style={{ fontSize: 12, color: 'var(--gray-6)', lineHeight: 1.6 }}>
              등기번호 및 배송 상태는 <Link to="/kit/ems" style={{ color: 'var(--blue-dk)', fontWeight: 600 }}>EMS 배송 추적</Link> 페이지에서 관리합니다.
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="modal-btn-cancel" onClick={() => setShowEdit(false)}>취소</button>
          <button className="modal-btn-confirm" onClick={saveEdit} disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
