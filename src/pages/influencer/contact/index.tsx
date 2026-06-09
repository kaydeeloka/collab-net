import { useEffect, useState, useRef, useCallback } from 'react'
import { gasPost } from '../../../lib/api'
import { supabase } from '../../../lib/supabase'
import { usePhase } from '../../../contexts/PhaseContext'
import { fmtNum } from '../../../lib/utils'
import { useToast } from '../../../contexts/ToastContext'
import Spinner from '../../../components/Spinner'
import Pagination from '../../../components/Pagination'

// ─── Constants ────────────────────────────────────────────────────────────────
const TIERS = ['1순위', '2순위', '3순위', '4순위', '5순위']

const TIER_COLOR: Record<string, string> = {
  '1순위': '#6366f1',
  '2순위': '#3b82f6',
  '3순위': '#10b981',
  '4순위': '#f59e0b',
  '5순위': '#ec4899',
}

const STATUS_OPTIONS = [
  { value: '',          label: '미발송',   bg: '#f1f5f9', color: '#64748b' },
  { value: 'target',    label: '컨택예정', bg: '#ede9fe', color: '#7c3aed' },
  { value: 'yes',       label: '완료',     bg: '#dbeafe', color: '#1d4ed8' },
  { value: 'reply',     label: '답장',     bg: '#fef3c7', color: '#d97706' },
  { value: 'negotiate', label: '협의중',   bg: '#d1fae5', color: '#065f46' },
  { value: 'accept',    label: '확정',     bg: '#bbf7d0', color: '#14532d' },
  { value: 'reject',    label: '거절',     bg: '#fee2e2', color: '#991b1b' },
]
const STATUS_LABELS: Record<string, string> = Object.fromEntries(STATUS_OPTIONS.map(s => [s.value, s.label]))
const STATUS_STYLE:  Record<string, { bg: string; color: string }> = Object.fromEntries(STATUS_OPTIONS.map(s => [s.value, { bg: s.bg, color: s.color }]))

// ─── Types ────────────────────────────────────────────────────────────────────
interface Influencer {
  id: string
  handle: string
  display_name: string | null
  email: string | null
  followers: number
  following: number
  following_ratio: string | null
  video_count: number
  engagement_rate: number
  profile_url: string | null
  outreach: string
  tiers: { rank: string; label: string; category: string } | null
}

// ─── Templates ────────────────────────────────────────────────────────────────
const DEFAULT_TEMPLATES = [
  {
    id: 'temp_01',
    name: '[선물증정] 신제품 론칭 패키지 기프트 제안',
    subject: '[MiMuse] {{이름}}님, 미뮤즈 가을 시즌 신제품 VIP 기프트 증정 제안',
    body: `안녕하세요 {{이름}}님!
프리미엄 뷰티 브랜드 MiMuse(미뮤즈) 글로벌 커뮤니케이션 팀입니다.

평소 {{이름}}님의 TikTok 채널({{핸들}})을 통해 전달하시는 세련된 감성과 독창적인 리뷰 스타일에 깊은 인상을 받았습니다.

이번 론칭하는 수분 세럼 패키지를 맞이하여 기프팅 선물을 전달드리고자 메일 드립니다.

배송을 위해 성함, 연락처, 배송 정보를 회신 주시면 조속히 발송하겠습니다.

MiMuse 드림.`,
  },
  {
    id: 'temp_02',
    name: '[리마인더] 1차 기프트 제안 리마인더',
    subject: '[MiMuse] {{이름}}님, 이전 기프트 패키지 증정 관련 재문의',
    body: `안녕하세요 {{이름}}님, MiMuse 글로벌 팀입니다.

이전 메일을 통해 전달해 드렸던 신제품 선물 기프팅 제안에 대해 재문의 드립니다.

{{이름}}님 채널({{핸들}})이 저희 제품과 잘 어울릴 것 같아 특별히 연락드립니다.

배송 정보를 회신 주시면 즉시 절차를 진행하겠습니다.
감사합니다.`,
  },
]

function loadTemplates() {
  try { const v = localStorage.getItem('mm_email_templates'); return v ? JSON.parse(v) : DEFAULT_TEMPLATES } catch { return DEFAULT_TEMPLATES }
}
function saveTemplates(t: typeof DEFAULT_TEMPLATES) {
  localStorage.setItem('mm_email_templates', JSON.stringify(t))
}
function applyPlaceholders(text: string, inf: Influencer | null) {
  if (!inf) return text
  return text
    .replace(/\{\{이름\}\}/g, inf.display_name || inf.handle)
    .replace(/\{\{핸들\}\}/g,  '@' + inf.handle)
    .replace(/\{\{이메일\}\}/g, inf.email || '')
    .replace(/\{\{팔로워\}\}/g, fmtNum(String(inf.followers)))
    .replace(/\{\{조회수\}\}/g,  '—')
}

// ─── Tab ──────────────────────────────────────────────────────────────────────
type ContactTab = 'pending' | 'sent' | 'accepted'
const TABS: { key: ContactTab; label: string }[] = [
  { key: 'pending',  label: '컨택 예정' },
  { key: 'sent',     label: '컨택 완료' },
  { key: 'accepted', label: '확정 인플루언서' },
]

const PAGE_SIZE = 25
function paginate<T>(items: T[], page: number) {
  const total      = items.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safe       = Math.min(page, totalPages)
  const startIdx   = (safe - 1) * PAGE_SIZE
  return { pageItems: items.slice(startIdx, startIdx + PAGE_SIZE), total, totalPages, page: safe, startIdx, endIdx: Math.min(startIdx + PAGE_SIZE, total) }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Outreach() {
  const { showToast }    = useToast()
  const { activePhaseId } = usePhase()

  // ── Tab ──
  const [contactTab, setContactTab] = useState<ContactTab>('pending')

  // ── Supabase data ──
  const [influencers, setInfluencers] = useState<Influencer[]>([])
  const [loading,     setLoading]     = useState(true)

  // ── 컨택 예정 ──
  const [activeTier,   setActiveTier]   = useState('1순위')
  const [selectedId,   setSelectedId]   = useState<string | null>(null)
  const [checkedIds,   setCheckedIds]   = useState<Set<string>>(new Set())
  const [bulkTplIdx,   setBulkTplIdx]   = useState(0)
  const [bulkSending,  setBulkSending]  = useState(false)

  // ── Template & draft ──
  const [templates,      setTemplates]      = useState(loadTemplates)
  const [selectedTplIdx, setSelectedTplIdx] = useState(0)
  const [tplName,        setTplName]        = useState('')
  const [tplSubject,     setTplSubject]     = useState('')
  const [tplBody,        setTplBody]        = useState('')
  const [draftSubject,   setDraftSubject]   = useState('')
  const [draftBody,      setDraftBody]      = useState('')
  const [sendingEmail,   setSendingEmail]   = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  // ── Pagination ──
  const [sentPage,     setSentPage]     = useState(1)
  const [acceptedPage, setAcceptedPage] = useState(1)

  // ── Load ──
  const loadInfluencers = useCallback(async () => {
    if (!activePhaseId) return
    setLoading(true)
    const { data } = await supabase
      .from('influencers')
      .select('id, handle, display_name, email, followers, following, following_ratio, video_count, engagement_rate, profile_url, outreach, tiers(rank, label, category)')
      .eq('phase_id', activePhaseId)
      .order('created_at', { ascending: false })
    setInfluencers((data ?? []) as unknown as Influencer[])
    setLoading(false)
  }, [activePhaseId])

  useEffect(() => { loadInfluencers() }, [loadInfluencers])

  useEffect(() => {
    const tpl = templates[selectedTplIdx]
    if (tpl) { setTplName(tpl.name); setTplSubject(tpl.subject); setTplBody(tpl.body) }
  }, [selectedTplIdx, templates])

  // ── Status update via Supabase ──
  const updateStatus = useCallback(async (id: string, value: string) => {
    const { error } = await supabase.from('influencers').update({ outreach: value }).eq('id', id)
    if (error) { showToast(error.message, 'error'); return }
    setInfluencers(prev => prev.map(r => r.id === id ? { ...r, outreach: value } : r))
    if (value === 'accept') {
      const inf = influencers.find(r => r.id === id)
      await supabase.from('confirmed_influencers').upsert(
        { influencer_id: id, phase_id: activePhaseId, email: inf?.email ?? null, upload_status: 'Pending' },
        { onConflict: 'influencer_id', ignoreDuplicates: true }
      )
    }
    if (value === 'accept' || value === 'reject') setSelectedId(null)
  }, [showToast, influencers, activePhaseId])

  // ── Draft ──
  function selectInfluencer(inf: Influencer) {
    setSelectedId(inf.id)
    const tpl = templates[selectedTplIdx]
    if (!tpl) return
    setDraftSubject(applyPlaceholders(tpl.subject, inf))
    setDraftBody(applyPlaceholders(tpl.body, inf))
  }

  async function sendEmailDirectly() {
    if (!selected || !selected.email) { showToast('이메일 주소가 없습니다.', 'error'); return }
    setSendingEmail(true)
    try {
      const res: { ok?: boolean; error?: string } = await gasPost({
        action: 'sendOutreachEmail', to: selected.email, subject: draftSubject, body: draftBody,
      })
      if (res.error) { showToast(res.error, 'error') } else {
        await updateStatus(selected.id, 'yes')
        showToast('발송 완료!', 'success')
      }
    } catch (e: unknown) { showToast((e as Error).message, 'error') }
    setSendingEmail(false)
  }

  async function markAsSent() {
    if (!selected) return
    await updateStatus(selected.id, 'yes')
    showToast('발송 완료 처리됨', 'success')
  }

  function insertPlaceholder(ph: string) {
    const ta = bodyRef.current
    if (!ta) { setDraftBody(prev => prev + ph); return }
    const s = ta.selectionStart, e = ta.selectionEnd
    setDraftBody(draftBody.slice(0, s) + ph + draftBody.slice(e))
    setTimeout(() => { ta.selectionStart = ta.selectionEnd = s + ph.length; ta.focus() }, 0)
  }

  function saveTplState() {
    const updated = templates.map((t: any, i: number) => i === selectedTplIdx ? { ...t, name: tplName, subject: tplSubject, body: tplBody } : t)
    setTemplates(updated); saveTemplates(updated)
  }
  function createNewTemplate() {
    const next = [...templates, { id: 'temp_' + Date.now(), name: '새 템플릿', subject: '', body: '' }]
    setTemplates(next); saveTemplates(next); setSelectedTplIdx(next.length - 1)
  }
  function deleteTemplate() {
    if (templates.length <= 1) { showToast('마지막 템플릿은 삭제할 수 없습니다.', 'info'); return }
    const next = templates.filter((_: any, i: number) => i !== selectedTplIdx)
    setTemplates(next); saveTemplates(next); setSelectedTplIdx(0)
  }

  // ── Derived ──
  const pendingRows  = influencers.filter(r => r.outreach === 'target')
  const sentRows     = influencers.filter(r => ['yes', 'reply', 'negotiate'].includes(r.outreach))
  const acceptedRows = influencers.filter(r => r.outreach === 'accept')
  const tierRows     = pendingRows.filter(r => r.tiers?.rank === activeTier)
  const selected     = selectedId ? influencers.find(r => r.id === selectedId) ?? null : null

  const sp = paginate(sentRows, sentPage)
  const ap = paginate(acceptedRows, acceptedPage)

  const sentCount     = influencers.filter(r => ['yes','reply','negotiate','accept','reject'].includes(r.outreach)).length
  const repliedCount  = influencers.filter(r => ['reply','negotiate'].includes(r.outreach)).length
  const tierBreakdown = TIERS.map(t => {
    const all  = influencers.filter(r => r.tiers?.rank === t)
    const sent = all.filter(r => ['yes','reply','negotiate','accept','reject'].includes(r.outreach)).length
    return { tier: t.replace('순위', ''), sent, total: all.length }
  })

  const countMap: Record<ContactTab, number> = {
    pending:  pendingRows.length,
    sent:     sentRows.length,
    accepted: acceptedRows.length,
  }

  const thStyle: React.CSSProperties = {
    padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700,
    color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px',
    background: 'var(--gray-1)', position: 'sticky', top: 0, zIndex: 1,
  }

  // ── Simple table (컨택 완료 / 확정) ──
  function renderSimpleTable(
    pg: ReturnType<typeof paginate<Influencer>>,
    allForTab: Influencer[],
    actions: (r: Influencer) => React.ReactNode,
    onPrev: () => void,
    onNext: () => void,
  ) {
    if (loading) return (
      <div style={{ padding: '60px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <Spinner /><span style={{ fontSize: 13, color: 'var(--gray-5)' }}>데이터 불러오는 중...</span>
      </div>
    )
    if (allForTab.length === 0) return <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--gray-5)', fontSize: 13 }}>데이터가 없습니다.</div>
    return (
      <>
        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 600 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--gray-3)' }}>
                <th style={{ ...thStyle, position: 'sticky', top: 0, zIndex: 1 }}>이름</th>
                <th style={{ ...thStyle, position: 'sticky', top: 0, zIndex: 1 }}>핸들</th>
                <th style={{ ...thStyle, position: 'sticky', top: 0, zIndex: 1 }}>이메일</th>
                <th style={{ ...thStyle, textAlign: 'right', position: 'sticky', top: 0, zIndex: 1 }}>팔로워</th>
                <th style={{ ...thStyle, position: 'sticky', top: 0, zIndex: 1 }}>순위</th>
                <th style={{ ...thStyle, position: 'sticky', top: 0, zIndex: 1 }}>상태</th>
                <th style={{ ...thStyle, textAlign: 'right', position: 'sticky', top: 0, zIndex: 1 }}>액션</th>
              </tr>
            </thead>
            <tbody>
              {pg.pageItems.map(r => {
                const sk = r.outreach || ''
                const s  = STATUS_STYLE[sk] || STATUS_STYLE['']
                const tc = r.tiers?.rank ? TIER_COLOR[r.tiers.rank] : undefined
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--gray-2)', borderLeft: tc ? `3px solid ${tc}` : undefined }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13 }}>{r.display_name || r.handle || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12 }}>
                      <a href={`https://www.tiktok.com/@${r.handle}`} target="_blank" rel="noopener"
                        style={{ color: 'var(--blue-dk)', textDecoration: 'none', fontWeight: 500 }}>@{r.handle}</a>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--gray-6)' }}>{r.email || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600, textAlign: 'right', color: 'var(--gray-7)' }}>{fmtNum(String(r.followers))}</td>
                    <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--gray-5)' }}>{r.tiers?.rank || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: s.bg, color: s.color, border: `1px solid ${s.color}44` }}>
                        {STATUS_LABELS[sk] || sk}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>{actions(r)}</div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={pg.page} totalPages={pg.totalPages} total={pg.total}
          startIdx={pg.startIdx} endIdx={pg.endIdx} onPrev={onPrev} onNext={onNext} />
      </>
    )
  }

  return (
    <div className="page page--fill" style={{ paddingLeft: 28, paddingRight: 28 }}>

      {/* ── Hero Banner ── */}
      <div style={{ background: 'var(--blue-lt)', border: '1px solid rgba(159,186,197,.4)', borderRadius: 14, padding: '22px 24px', marginBottom: 28, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 96, opacity: .06, pointerEvents: 'none' }}>✉</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--blue-dk)', marginBottom: 6 }}>스마트 이메일 아웃리치 &amp; 답장 추적 시스템</h1>
            <p style={{ fontSize: 13, color: '#555', maxWidth: 620 }}>실시간 템플릿 메일 빌더와 지능형 답장 동기화(Sync) 기능을 제공합니다.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setSelectedId(null); loadInfluencers() }}
              style={{ padding: '8px 16px', background: '#fff', color: '#334', fontWeight: 700, fontSize: 12, borderRadius: 10, border: '1px solid var(--gray-3)', cursor: 'pointer' }}>
              ↻ 새로고침
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      {loading && <div className="loader"><Spinner /></div>}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16, marginBottom: 28 }}>
          <div style={{ background: 'var(--gray-0)', borderRadius: 14, border: '1px solid var(--gray-2)', padding: '20px 24px', boxShadow: 'var(--shadow)' }}>
            <div style={{ fontSize: 12, color: 'var(--gray-5)', marginBottom: 8 }}>전체 타겟 리스트</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--gray-8)', letterSpacing: '-1px' }}>{influencers.length}</span>
              <span style={{ fontSize: 14, color: 'var(--gray-5)' }}>명</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--gray-5)' }}>
              {tierBreakdown.map((t, i) => {
                const color = TIER_COLOR[t.tier + '순위']
                return (
                  <span key={t.tier}>
                    {i > 0 && <span style={{ margin: '0 4px', opacity: 0.4 }}>·</span>}
                    <span style={{ color }}>{t.tier}순위 <strong>{t.sent}/{t.total}</strong></span>
                  </span>
                )
              })}
            </div>
          </div>
          <div style={{ background: 'var(--gray-0)', borderRadius: 14, border: '1px solid var(--gray-2)', padding: '20px 24px', boxShadow: 'var(--shadow)' }}>
            <div style={{ fontSize: 12, color: 'var(--gray-5)', marginBottom: 8 }}>발송 성과율</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--gray-8)', letterSpacing: '-1px' }}>{sentCount}</span>
              <span style={{ fontSize: 13, color: 'var(--gray-5)', fontWeight: 500 }}>/ {influencers.length} 발송됨</span>
            </div>
            <div style={{ height: 4, background: 'var(--gray-2)', borderRadius: 99, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ height: '100%', width: `${influencers.length > 0 ? Math.min(sentCount / influencers.length * 100, 100) : 0}%`, background: 'var(--teal-dk)', borderRadius: 99, transition: 'width .4s' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--gray-5)' }}>{influencers.length > 0 ? Math.round(sentCount / influencers.length * 100) : 0}% 완료</div>
          </div>
          <div style={{ background: 'var(--gray-0)', borderRadius: 14, border: '1px solid var(--yellow-md)', padding: '20px 24px', boxShadow: 'var(--shadow)' }}>
            <div style={{ fontSize: 12, color: 'var(--gray-5)', marginBottom: 8 }}>답장 수신 통계</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: '#d97706', letterSpacing: '-1px' }}>{repliedCount}</span>
              <span style={{ fontSize: 13, color: 'var(--gray-5)', fontWeight: 500 }}>명 답장</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--gray-5)' }}>
              {sentCount > 0 ? Math.round(repliedCount / sentCount * 100) : 0}% 회신율
            </div>
          </div>
        </div>
      )}

      {/* ── Tab bar ── */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--gray-2)', marginBottom: 24 }}>
        {TABS.map(tab => {
          const count  = countMap[tab.key]
          const active = contactTab === tab.key
          return (
            <button key={tab.key} onClick={() => setContactTab(tab.key)}
              style={{
                padding: '10px 24px', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
                background: 'transparent',
                color: active ? 'var(--blue-dk)' : 'var(--gray-5)',
                borderBottom: active ? '2px solid var(--blue-dk)' : '2px solid transparent',
                marginBottom: -2, display: 'flex', alignItems: 'center', gap: 6,
              }}>
              {tab.label}
              {count > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 20,
                  background: active ? 'var(--blue-dk)' : 'var(--gray-2)',
                  color: active ? '#fff' : 'var(--gray-5)',
                }}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* ══ 컨택 예정 ══ */}
      {contactTab === 'pending' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>

          {/* Left: influencer table */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--gray-3)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-2)' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-8)' }}>아웃리치 대상 명단</div>
              <div style={{ fontSize: 12, color: 'var(--gray-5)', marginTop: 4 }}>대상을 클릭해 초안을 편집하고 발송하세요.</div>
            </div>

            {/* Tier tabs */}
            <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--gray-2)', background: 'var(--gray-1)', display: 'flex', gap: 6, overflowX: 'auto' }}>
              {TIERS.map(t => {
                const tc = TIER_COLOR[t]
                const isActive = activeTier === t
                return (
                <button key={t} onClick={() => { setActiveTier(t); setSelectedId(null) }}
                  style={{
                    padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    border: isActive ? `2px solid ${tc}` : '2px solid transparent',
                    background: isActive ? tc : 'var(--gray-1)',
                    color: isActive ? '#fff' : 'var(--gray-5)',
                  }}>
                  {t}
                  <span style={{ marginLeft: 5, opacity: 0.7 }}>
                    {pendingRows.filter(r => r.tiers?.rank === t).length}
                  </span>
                </button>
                )
              })}
            </div>

            {/* Bulk actions */}
            {checkedIds.size > 0 && (
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--blue-lt)', background: '#eef3ff', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{checkedIds.size}명 선택됨</span>
                <select value={bulkTplIdx} onChange={e => setBulkTplIdx(+e.target.value)}
                  style={{ flex: 1, minWidth: 160, fontSize: 12, border: '1px solid var(--blue)', borderRadius: 8, padding: '6px 10px', background: '#fff', outline: 'none', fontFamily: 'inherit' }}>
                  {templates.map((t: any, i: number) => <option key={t.id} value={i}>{t.name}</option>)}
                </select>
                <button disabled={bulkSending}
                  onClick={async () => {
                    const tpl = templates[bulkTplIdx]
                    if (!tpl) return
                    setBulkSending(true)
                    for (const id of Array.from(checkedIds)) {
                      const inf = tierRows.find(r => r.id === id)
                      if (!inf || !inf.email) continue
                      await gasPost({ action: 'sendOutreachEmail', to: inf.email, subject: applyPlaceholders(tpl.subject, inf), body: applyPlaceholders(tpl.body, inf) })
                      await updateStatus(id, 'yes')
                    }
                    setBulkSending(false); setCheckedIds(new Set())
                    showToast(`${checkedIds.size}명에게 발송 완료`, 'success')
                  }}
                  style={{ padding: '6px 14px', background: 'var(--blue-dk)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                  {bulkSending ? '발송 중...' : '일괄 발송'}
                </button>
                <button onClick={() => setCheckedIds(new Set())}
                  style={{ padding: '6px 10px', background: 'transparent', color: 'var(--gray-5)', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>취소</button>
              </div>
            )}

            <div style={{ overflowY: 'auto', maxHeight: 600, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: 36 }} /><col style={{ width: 200 }} /><col style={{ width: 150 }} /><col style={{ width: 68 }} /><col style={{ width: 100 }} /><col style={{ width: 120 }} />
                </colgroup>
                <thead>
                  <tr>
                    {([
                      { style: { padding: '10px 8px', textAlign: 'center' as const }, content: <input type="checkbox" onChange={e => setCheckedIds(e.target.checked ? new Set(tierRows.map(r => r.id)) : new Set())} /> },
                      { style: { padding: '10px 14px' }, content: '이름' },
                      { style: { padding: '10px 12px' }, content: '핸들' },
                      { style: { padding: '10px 8px', textAlign: 'right' as const }, content: '팔로워' },
                      { style: { padding: '10px 10px' }, content: '상태' },
                      { style: { padding: '10px 14px', textAlign: 'right' as const }, content: '초안 / 액션' },
                    ].map((col, i) => (
                      <th key={i} style={{ ...col.style, background: 'var(--gray-1)', fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '2px solid var(--gray-3)', position: 'sticky', top: 0, zIndex: 1 }}>
                        {col.content}
                      </th>
                    )))}
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center' }}><Spinner /></td></tr>}
                  {!loading && tierRows.length === 0 && <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--gray-5)' }}>데이터가 없습니다</td></tr>}
                  {tierRows.map(inf => {
                    const statusKey = inf.outreach || ''
                    const isSelected = selectedId === inf.id
                    const s = STATUS_STYLE[statusKey] || STATUS_STYLE['']
                    const tc = inf.tiers?.rank ? TIER_COLOR[inf.tiers.rank] : undefined
                    return (
                      <tr key={inf.id}
                        style={{ borderBottom: '1px solid var(--gray-2)', borderLeft: tc ? `3px solid ${tc}` : undefined, cursor: 'pointer', background: isSelected ? 'var(--blue-lt)' : undefined, transition: 'background .1s' }}
                        onClick={() => selectInfluencer(inf)}>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={checkedIds.has(inf.id)} onChange={e => {
                            const next = new Set(checkedIds); e.target.checked ? next.add(inf.id) : next.delete(inf.id); setCheckedIds(next)
                          }} />
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--gray-8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inf.display_name || inf.handle}</div>
                          {inf.email && <div style={{ fontSize: 11, color: 'var(--gray-4)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inf.email}</div>}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 12 }}>
                          {inf.handle ? (
                            <a href={`https://www.tiktok.com/@${inf.handle}`} target="_blank" rel="noopener"
                              style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--blue-dk)', textDecoration: 'none', fontWeight: 500 }}
                              onClick={e => e.stopPropagation()}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inf.handle}</span>
                            </a>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '10px 8px', fontSize: 12, fontWeight: 600, textAlign: 'right', color: 'var(--gray-7)' }}>
                          {fmtNum(String(inf.followers))}
                        </td>
                        <td style={{ padding: '10px 10px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          <select value={statusKey} onChange={e => updateStatus(inf.id, e.target.value)}
                            style={{ fontSize: 11, fontWeight: 600, border: '1px solid var(--gray-3)', borderRadius: 6, padding: '4px 6px', background: '#fff', color: s.color, outline: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' }}>
                            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', alignItems: 'center' }}>
                            {statusKey === 'negotiate' ? (
                              <>
                                <button onClick={() => updateStatus(inf.id, 'accept')}
                                  style={{ padding: '4px 10px', background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✓ 수락</button>
                                <button onClick={() => updateStatus(inf.id, 'reject')}
                                  style={{ padding: '4px 10px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✗ 거절</button>
                              </>
                            ) : statusKey === 'reply' ? (
                              <button onClick={() => selectInfluencer(inf)}
                                style={{ padding: '4px 10px', background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✏ 답장</button>
                            ) : (
                              <>
                                <button onClick={() => selectInfluencer(inf)}
                                  style={{ padding: '4px 10px', background: 'var(--yellow)', color: 'var(--yellow-text)', border: '1px solid var(--yellow-md)', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✏ 초안</button>
                                {statusKey === 'target' && (
                                  <button onClick={() => updateStatus(inf.id, 'yes')} title="발송완료"
                                    style={{ padding: '4px 8px', background: '#fff', border: '1px solid var(--gray-3)', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: 'var(--gray-5)' }}>✓</button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: draft builder */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Reply card */}
            {selected && selected.outreach === 'reply' && (
              <div style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#92400e', marginBottom: 10 }}>✉ 인플루언서 회신 메일이 도착했습니다!</div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 10 }}>
                  <button onClick={() => updateStatus(selected.id, 'negotiate')} style={{ padding: '5px 12px', background: '#fff', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>협의중 마킹</button>
                </div>
              </div>
            )}

            {/* Negotiate card */}
            {selected && selected.outreach === 'negotiate' && (
              <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#166534', marginBottom: 8 }}>🤝 협의 진행 중</div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                  <button onClick={() => updateStatus(selected.id, 'reject')} style={{ padding: '6px 14px', background: '#fff0f0', color: '#c00', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>거절 처리</button>
                  <button onClick={() => updateStatus(selected.id, 'accept')} style={{ padding: '6px 14px', background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>수락 확정</button>
                </div>
              </div>
            )}

            {/* Draft builder */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--gray-3)', boxShadow: 'var(--shadow)', padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--gray-2)', paddingBottom: 12, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--yellow-md)', display: 'inline-block' }}></span>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>개인 맞춤형 초안 빌더 <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--blue-dk)' }}>(Live)</span></span>
                </div>
                {selected && <span style={{ fontSize: 12, fontWeight: 600, background: 'var(--blue-lt)', color: 'var(--blue-dk)', padding: '4px 10px', borderRadius: 999 }}>{selected.display_name || selected.handle} 대상</span>}
              </div>

              {!selected
                ? <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--gray-5)', fontSize: 13 }}>인플루언서 목록에서 대상을 클릭하세요.</div>
                : <div>
                    {/* Template selector */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--blue-dk)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>템플릿 선택</div>
                      <select value={selectedTplIdx}
                        onChange={e => {
                          const idx = +e.target.value; setSelectedTplIdx(idx)
                          const tpl = templates[idx]
                          if (!tpl || !selected) return
                          setDraftSubject(applyPlaceholders(tpl.subject, selected))
                          setDraftBody(applyPlaceholders(tpl.body, selected))
                        }}
                        style={{ width: '100%', fontSize: 12, border: '1px solid var(--gray-3)', borderRadius: 8, padding: '8px 12px', background: '#fff', outline: 'none', fontFamily: 'inherit', cursor: 'pointer' }}>
                        {templates.map((t: any, i: number) => <option key={t.id} value={i}>{t.name}</option>)}
                      </select>
                    </div>

                    {/* Subject */}
                    <div style={{ marginBottom: 12, border: '1px solid var(--gray-3)', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--gray-1)', borderBottom: '1px solid var(--gray-2)' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--blue-dk)', textTransform: 'uppercase', letterSpacing: '.5px' }}>치환 완료된 메일 제목</span>
                        <button onClick={() => navigator.clipboard.writeText(draftSubject).then(() => showToast('제목 복사됨', 'success'))}
                          style={{ fontSize: 11, padding: '2px 8px', background: '#fff', border: '1px solid var(--gray-3)', borderRadius: 6, cursor: 'pointer', color: 'var(--gray-6)', fontWeight: 600 }}>📋 복사</button>
                      </div>
                      <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--gray-8)', lineHeight: 1.5, wordBreak: 'break-all' }}>
                        {draftSubject || <span style={{ color: 'var(--gray-4)' }}>—</span>}
                      </div>
                    </div>

                    {/* Body */}
                    <div style={{ marginBottom: 12, border: '1px solid var(--yellow-md)', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: '#fffbeb', borderBottom: '1px solid var(--yellow-md)' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--yellow-text)', textTransform: 'uppercase', letterSpacing: '.5px' }}>실시간 치환된 본문 (수정 가능)</span>
                        <button onClick={() => navigator.clipboard.writeText(draftBody).then(() => showToast('본문 복사됨', 'success'))}
                          style={{ fontSize: 11, padding: '2px 8px', background: '#fff', border: '1px solid var(--yellow-md)', borderRadius: 6, cursor: 'pointer', color: 'var(--yellow-text)', fontWeight: 600 }}>📋 복사</button>
                      </div>
                      <textarea ref={bodyRef} value={draftBody} onChange={e => setDraftBody(e.target.value)} rows={8}
                        style={{ width: '100%', padding: '10px 12px', border: 'none', fontSize: 12, fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.6, display: 'block' }} />
                    </div>

                    {/* Placeholder chips */}
                    <div style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {['{{이름}}', '{{핸들}}', '{{이메일}}', '{{팔로워}}'].map(p => (
                        <button key={p} onClick={() => insertPlaceholder(p)}
                          style={{ fontSize: 11, padding: '3px 9px', background: 'var(--gray-1)', border: '1px solid var(--gray-3)', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}>{p}</button>
                      ))}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <button onClick={sendEmailDirectly} disabled={sendingEmail}
                        style={{ padding: '10px', background: 'var(--yellow)', color: 'var(--yellow-text)', border: '1px solid var(--yellow-md)', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        {sendingEmail ? '발송 중...' : '이메일 즉시 전송'}
                      </button>
                      <button onClick={markAsSent}
                        style={{ padding: '10px', background: 'var(--blue-dk)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        발송 완료로 확정
                      </button>
                    </div>
                  </div>
              }
            </div>
          </div>
        </div>
      )}

      {/* ══ 컨택 완료 ══ */}
      {contactTab === 'sent' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--gray-3)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-2)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-8)' }}>컨택 완료 인플루언서</div>
            <div style={{ fontSize: 12, color: 'var(--gray-5)', marginTop: 4 }}>완료·답장·협의중 상태의 인플루언서 명단입니다.</div>
          </div>
          {renderSimpleTable(sp, sentRows, r => (
            <>
              <button onClick={() => updateStatus(r.id, 'accept')}
                style={{ padding: '4px 10px', background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✓ 수락</button>
              <button onClick={() => updateStatus(r.id, 'reject')}
                style={{ padding: '4px 10px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✗ 거절</button>
            </>
          ),
          () => setSentPage(p => Math.max(1, p - 1)),
          () => setSentPage(p => Math.min(sp.totalPages, p + 1)))}
        </div>
      )}

      {/* ══ 확정 인플루언서 ══ */}
      {contactTab === 'accepted' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--gray-3)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-2)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-8)' }}>확정 인플루언서</div>
            <div style={{ fontSize: 12, color: 'var(--gray-5)', marginTop: 4 }}>협업이 확정된 인플루언서 명단입니다.</div>
          </div>
          {renderSimpleTable(ap, acceptedRows, r => (
            <button onClick={() => updateStatus(r.id, 'negotiate')}
              style={{ padding: '4px 10px', background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>↩ 협의중</button>
          ),
          () => setAcceptedPage(p => Math.max(1, p - 1)),
          () => setAcceptedPage(p => Math.min(ap.totalPages, p + 1)))}
        </div>
      )}
    </div>
  )
}
