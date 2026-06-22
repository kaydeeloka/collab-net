import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, MapPin, Phone, TrendingUp, User, Info } from 'lucide-react'
import { ReportCard, ReportStat } from '@/components/ReportCard'
import { supabase } from '@/lib/supabase'
import { dedupeConfirmedPhaseViaDb, uniquePlatformAccounts } from '@/lib/confirm-influencer'
import HeaderFilterMenu from '@/components/HeaderFilterMenu'
import { formatKstSyncLabel } from '@/lib/kst-time'
import { PLATFORM_DISPLAY, PLATFORM_OPTIONS, defaultProfileUrl, platformBadgeClass, platformBadgeStyle } from '@/lib/content-platforms'
import { usePhase } from '@/contexts/PhaseContext'
import { useToast } from '@/contexts/ToastContext'
import Spinner from '@/components/Spinner'
import Modal from '@/components/Modal'
import { StatCard, StatCards } from '@/components/ui'
import { getEmsStatusColor, isEmsDelivered, isEmsException } from '@/lib/ems-tracking-status'

const GOOGLE_FORM_URL = ''

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
  avatar_url:   string | null
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

function PlatformBadge({ platform }: { platform: string | null }) {
  if (!platform) return <span style={{ color: 'var(--gray-4)', fontSize: 11 }}>—</span>
  const { label, style } = platformBadgeStyle(platform)
  return <span className={platformBadgeClass(platform)} style={style}>{label}</span>
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

  const badgeColor = getEmsStatusColor(emsStatus)
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

function InfluencerAvatar({ url, label, size = 56 }: { url?: string | null; label?: string | null; size?: number }) {
  const fallback = (label || '?').replace(/^@/, '').slice(0, 1).toUpperCase() || '?'
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
      background: 'var(--gray-2)', border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,.08)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.38), fontWeight: 700, color: 'var(--gray-5)',
    }}>
      {url
        ? <img src={url} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : fallback}
    </div>
  )
}

function formatShippingAddress(row: Pick<ConfirmedRow, 'address_line_1' | 'address_line_2' | 'city' | 'state' | 'zip' | 'country'>): string {
  return [
    row.address_line_1,
    row.address_line_2,
    row.city,
    row.state && row.zip ? `${row.state} ${row.zip}` : (row.state || row.zip),
    row.country,
  ].filter(Boolean).join(', ')
}

function SeqBadge({ seq, size = 'sm' }: { seq: number; size?: 'sm' | 'md' }) {
  const md = size === 'md'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: md ? 26 : 28,
      height: md ? 26 : 22,
      padding: md ? '0 7px' : '0 8px',
      borderRadius: md ? 7 : 999,
      background: md ? 'var(--table-head-bg)' : 'var(--blue-lt)',
      color: md ? '#fff' : 'var(--blue-dk)',
      border: md ? '1px solid var(--table-head-border)' : undefined,
      fontSize: md ? 13 : 11,
      fontWeight: 800,
      flexShrink: 0,
      lineHeight: 1,
      fontVariantNumeric: 'tabular-nums',
    }}>
      {seq}
    </span>
  )
}

function reviewStatusLabel(status: 'Yes' | 'No' | 'Pending'): string {
  if (status === 'Yes') return '리뷰 업로드 완료'
  return '리뷰 미업로드'
}

function reviewStatusBadgeStyle(status: 'Yes' | 'No' | 'Pending') {
  if (status === 'Yes') return { bg: '#d1fae5', color: '#065f46', label: '완료' }
  if (status === 'No') return { bg: '#fee2e2', color: '#991b1b', label: '미업로드' }
  return { bg: '#fef3c7', color: '#d97706', label: '대기중' }
}

function ReviewStatusBadge({ status }: { status: 'Yes' | 'No' | 'Pending' }) {
  const s = reviewStatusBadgeStyle(status)
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
      background: s.bg, color: s.color, flexShrink: 0, whiteSpace: 'nowrap',
    }}>
      리뷰 {s.label}
    </span>
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
  const { viewPhaseId } = usePhase()
  const { showToast, showConfirm } = useToast()

  const [rows,    setRows]    = useState<ConfirmedRow[]>([])
  const [brandCounts, setBrandCounts] = useState(emptyBrandCounts())
  const [loading, setLoading] = useState(false)
  const [search,  setSearch]  = useState('')
  const [syncMsg, setSyncMsg] = useState('')

  const [uploadFilter,     setUploadFilter]     = useState<UploadStatus>('all')
  const [reviewLinkFilter, setReviewLinkFilter] = useState<ReviewLinkFilter>('all')
  const [platformFilter,   setPlatformFilter]   = useState('all')
  const [openFilter,       setOpenFilter]       = useState<'platform' | 'upload' | 'reviewLink' | null>(null)

  const [showView, setShowView] = useState(false)
  const [viewRow,  setViewRow]  = useState<ConfirmedRow | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  const [editId,       setEditId]       = useState('')
  const [editForm,     setEditForm]     = useState(EMPTY_FORM)
  const [editPlatforms, setEditPlatforms] = useState<InfluencerPlatform[]>([])
  const originalPlatformIds = useRef<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (viewPhaseId) load() }, [viewPhaseId])

  async function fetchConfirmedRows() {
    const { data, error } = await supabase
      .from('confirmed_influencers')
      .select(`
        id, seq, email, upload_status, repost, review_link, notes, form_submitted,
        phone, address_line_1, address_line_2, city, state, zip, country,
        influencer_platform(
          id, platform, handle, followers, profile_url,
          monitoring(id, review_link, brand, date, content)
        ),
        influencers(platform, handle, display_name, followers, profile_url, avatar_url),
        ems_tracking(id, ems_number, status)
      `)
      .eq('phase_id', viewPhaseId ?? '')
      .order('seq', { ascending: true, nullsFirst: false })

    if (error) {
      showToast(error.message, 'error')
      return null
    }

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
        influencer_platform: uniquePlatformAccounts((r.influencer_platform ?? []).map((p: any) => ({
          id:          p.id,
          platform:    p.platform,
          handle:      p.handle   ?? '',
          followers:   p.followers ?? 0,
          profile_url: p.profile_url ?? '',
        }))),
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

    return { mapped, raw: data ?? [] }
  }

  async function load() {
    setLoading(true)
    const result = await fetchConfirmedRows()
    if (!result) {
      setLoading(false)
      return
    }

    setRows(result.mapped)
    setBrandCounts(computeBrandCounts(result.raw))
    setSyncMsg(formatKstSyncLabel())
    setLoading(false)

    if (!viewPhaseId) return

    // Background dedupe in Supabase (single RPC) — refresh only if something changed
    void dedupeConfirmedPhaseViaDb(viewPhaseId).then(async dedupe => {
      if (dedupe.error) {
        showToast(dedupe.error, 'error')
        return
      }
      if (dedupe.confirmedRemoved === 0 && dedupe.platformsRemoved === 0 && !dedupe.seqRenumbered) return

      if (dedupe.confirmedRemoved > 0 || dedupe.platformsRemoved > 0) {
        const parts = [
          dedupe.confirmedRemoved > 0 ? `확정 ${dedupe.confirmedRemoved}건` : '',
          dedupe.platformsRemoved > 0 ? `플랫폼 ${dedupe.platformsRemoved}건` : '',
        ].filter(Boolean)
        showToast(`중복 ${parts.join(', ')} 정리됨`, 'success')
      }

      const refreshed = await fetchConfirmedRows()
      if (refreshed) {
        setRows(refreshed.mapped)
        setBrandCounts(computeBrandCounts(refreshed.raw))
        setSyncMsg(formatKstSyncLabel())
      }
    })
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
  const platformFilterOptions = [{ value: 'all', label: '전체' }, ...platforms.map(p => ({ value: p, label: p }))]

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
  const delivered      = rows.filter(r => isEmsDelivered(r.ems_status)).length
  const shippingErrors = rows.filter(r => isEmsException(r.ems_status)).length

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
    background: 'var(--table-head-bg)',
    padding: '13px 18px',
    textAlign: 'left', fontSize: 11, fontWeight: 700,
    color: 'var(--table-head-fg)', textTransform: 'uppercase', letterSpacing: '.8px',
    borderBottom: '2px solid var(--table-head-border)', whiteSpace: 'nowrap',
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
    cursor: 'default',
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
          <Link to="/influencer/monitoring" className="page-banner-btn"
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
          <StatCards columns="repeat(3, minmax(0, 1fr)) minmax(320px, 1.75fr)">
            <StatCard
              label="총 확정 인플루언서"
              variant="progress"
              value={targetPct}
              unit="%"
              sub={`${total} / ${INFLUENCER_TARGET}명`}
              progress={targetPct}
              tags={[
                { label: 'TikTok',    count: platformCounts.tiktok,    color: '#111' },
                { label: 'Instagram', count: platformCounts.instagram, color: '#dc2743' },
                { label: 'Magazine',  count: platformCounts.magazine,  color: PLATFORM_DISPLAY.magazine.statColor },
              ]}
            />
            <StatCard
              highlight
              label="콘텐츠 업로드"
              variant="split"
              columns={[
                { value: uploaded, unit: '명', valueColor: '#14532d', label: '완료', labelColor: '#16a34a', sub: `${total ? Math.round(uploaded / total * 100) : 0}% 완료율` },
                { value: noUpload, unit: '명', valueColor: '#991b1b', label: '미업로드', labelColor: '#dc2626' },
              ]}
            />
            <StatCard
              highlight
              label="배송"
              variant="split"
              columns={[
                { value: delivered, unit: '명', valueColor: '#14532d', label: '배송 완료', labelColor: '#16a34a', sub: `${total ? Math.round(delivered / total * 100) : 0}% 완료율` },
                { value: shippingErrors, unit: '명', valueColor: '#991b1b', label: '배송 오류', labelColor: '#dc2626' },
              ]}
            />
            <StatCard
              highlight
              label="브랜드 횟수"
              variant="grid"
              columns={BRANDS.map(brand => ({
                value: brandCounts[brand] ?? 0,
                label: brand,
                color: BRAND_COLORS[brand],
              }))}
            />
          </StatCards>

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
                        <HeaderFilterMenu
                          label="인플루언서"
                          value={platformFilter}
                          options={platformFilterOptions}
                          onChange={setPlatformFilter}
                          open={openFilter === 'platform'}
                          onOpenChange={open => setOpenFilter(open ? 'platform' : null)}
                        />
                      </th>
                      <th style={thBase}>
                        <HeaderFilterMenu
                          label="리뷰 업로드"
                          value={uploadFilter}
                          options={UPLOAD_OPTIONS}
                          onChange={value => setUploadFilter(value as UploadStatus)}
                          open={openFilter === 'upload'}
                          onOpenChange={open => setOpenFilter(open ? 'upload' : null)}
                        />
                      </th>
                      <th style={{ ...thBase, textAlign: 'center' }}>구글폼 제출</th>
                      <th style={thBase}>
                        <HeaderFilterMenu
                          label="리뷰 링크"
                          value={reviewLinkFilter}
                          options={REVIEW_LINK_OPTIONS}
                          onChange={value => setReviewLinkFilter(value as ReviewLinkFilter)}
                          open={openFilter === 'reviewLink'}
                          onOpenChange={open => setOpenFilter(open ? 'reviewLink' : null)}
                        />
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
                      const avatarUrl   = inf?.avatar_url ?? null
                      const hasReview    = r.review_links.length > 0
                      const uploadStatus = effectiveUploadStatus(r)
                      return (
                        <tr key={r.id} onClick={() => { setViewRow(r); setShowView(true) }} style={{ cursor: 'pointer' }}>
                          <td style={seqTd}>{r.seq ?? '—'}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                              <InfluencerAvatar url={avatarUrl} label={displayName || handle} size={36} />
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--gray-8)' }}>
                                  {displayName || handle || '—'}
                                </span>
                                {r.email && (
                                  <span onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: 'var(--gray-6)', wordBreak: 'break-all' }}>
                                    {r.email}
                                  </span>
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
                          <td style={{ cursor: 'default' }} onClick={e => e.stopPropagation()}>
                            <ReviewLinksCell links={r.review_links} />
                          </td>
                          <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'normal', overflow: 'visible', maxWidth: 'none', cursor: 'default' }}>
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
        const primaryP     = r.influencer_platform[0]
        const vDisplayName = inf?.display_name || r.display_name || ''
        const vHandle      = (primaryP?.handle || inf?.handle || r.handle || '').replace(/^@/, '')
        const vAvatar      = inf?.avatar_url ?? null
        const uploadStatus = effectiveUploadStatus(r)
        const shippingAddress = formatShippingAddress(r)
        const platformAccounts = r.influencer_platform.length
          ? r.influencer_platform
          : inf?.platform || inf?.handle
            ? [{ id: null, platform: inf.platform || 'TikTok', handle: inf.handle || '', followers: inf.followers ?? 0, profile_url: inf.profile_url || '' }]
            : []

        return (
          <Modal
            open={showView}
            onClose={() => setShowView(false)}
            title={`인플루언서 정보 · ${vDisplayName || (vHandle ? `@${vHandle}` : '') || '인플루언서'}`}
            titlePrefix={r.seq != null ? (
              <span className="modal-title-prefix">
                <SeqBadge seq={r.seq} size="md" />
                <span className="modal-title-sep" aria-hidden="true">·</span>
              </span>
            ) : undefined}
            size="lg"
          >
            <div style={{ background: 'var(--gray-0)', margin: '-4px -4px 0', padding: '4px 4px 0', borderRadius: '0 0 12px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--gray-2)' }}>
                <InfluencerAvatar url={vAvatar} label={vDisplayName || vHandle} size={64} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--gray-8)', marginBottom: 6 }}>
                    {vDisplayName || (vHandle ? `@${vHandle}` : '') || '—'}
                  </div>
                  <PlatformAccountsCell accounts={platformAccounts} />
                </div>
                <ReviewStatusBadge status={uploadStatus} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <ReportCard icon={<User size={18} />} title="연락처 정보">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--gray-7)' }}>
                      <Mail size={15} style={{ color: 'var(--gray-4)', flexShrink: 0 }} />
                      {r.email
                        ? <a href={`mailto:${r.email}`} style={{ color: 'var(--blue-dk)', textDecoration: 'none', wordBreak: 'break-all' }}>{r.email}</a>
                        : '—'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--gray-7)' }}>
                      <Phone size={15} style={{ color: 'var(--gray-4)', flexShrink: 0 }} />
                      {r.phone || '—'}
                    </div>
                  </div>
                </ReportCard>

                <ReportCard icon={<MapPin size={18} />} title="배송 정보">
                  <div style={{ fontSize: 13, color: 'var(--gray-7)', lineHeight: 1.65, wordBreak: 'break-word' }}>
                    {shippingAddress || '—'}
                  </div>
                  {(r.ems_number || r.ems_status) && (
                    <div style={{ marginTop: 10 }}>
                      {r.ems_number && (
                        <div style={{ fontSize: 12, color: 'var(--gray-6)', marginBottom: r.ems_status ? 6 : 0 }}>
                          운송장:{' '}
                          <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--gray-8)', wordBreak: 'break-all' }}>
                            {r.ems_number}
                          </span>
                        </div>
                      )}
                      {r.ems_status && (
                        <span style={{
                          background: getEmsStatusColor(r.ems_status),
                          color: '#fff',
                          padding: '2px 10px',
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                        }}>
                          {r.ems_status}
                        </span>
                      )}
                    </div>
                  )}
                </ReportCard>
              </div>

              <ReportCard icon={<TrendingUp size={18} />} title="활동 상태 및 리뷰 현황">
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 0.95fr) minmax(0, 0.45fr) minmax(0, 1.75fr)',
                  gap: 16,
                  padding: '4px 0',
                }}>
                  <ReportStat label="리뷰 상태" value={reviewStatusLabel(uploadStatus)} />
                  <ReportStat label="구글폼 제출" value={r.form_submitted ? '제출 완료' : '—'} />
                  <ReportStat label="리포스트" value={r.repost || '0'} />
                  <ReportStat
                    label="리뷰 링크"
                    value={r.review_links.length
                      ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {r.review_links.map((l, i) => (
                            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <a href={l.review_link} target="_blank" rel="noopener" className="video-link" style={{ fontSize: 12, fontWeight: 600 }}>
                                ↗ {reviewLinkLabel(l, i)}
                              </a>
                              {l.platform && <PlatformBadge platform={l.platform} />}
                              {l.date && <span style={{ fontSize: 11, color: 'var(--gray-5)' }}>{l.date}</span>}
                            </div>
                          ))}
                        </div>
                      )
                      : '—'}
                  />
                </div>
              </ReportCard>

              <div style={{ marginTop: 14 }}>
                <ReportCard icon={<Info size={18} />} title="비고">
                  <div style={{
                    fontSize: 13,
                    color: r.notes?.trim() ? 'var(--gray-7)' : 'var(--gray-4)',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>
                    {r.notes?.trim() || '—'}
                  </div>
                </ReportCard>
              </div>

              <div className="modal-actions" style={{ marginTop: 20, paddingBottom: 4 }}>
                <button className="modal-btn-cancel" onClick={() => setShowView(false)}>닫기</button>
                <button className="modal-btn-confirm" onClick={() => { setShowView(false); openEdit(r) }}>✎ 편집</button>
              </div>
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
              <button
                type="button"
                disabled={editPlatforms.length <= 1}
                onClick={() => showConfirm(
                  `${a.platform || '플랫폼'} 항목을 삭제하시겠습니까?`,
                  () => setEditPlatforms(prev => prev.filter((_, idx) => idx !== i)),
                )}
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
            리뷰 링크는 <Link to="/influencer/monitoring" style={{ color: 'var(--blue-dk)', fontWeight: 600 }}>리뷰 모니터링</Link> 페이지에서 관리합니다.
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
