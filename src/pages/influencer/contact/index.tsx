import { useEffect, useState, useRef, useCallback } from 'react'
import { gasGet, gasPost } from '../../../lib/api'
import { fmtNum } from '../../../lib/utils'
import { useToast } from '../../../contexts/ToastContext'
import Spinner from '../../../components/Spinner'
import Pagination from '../../../components/Pagination'

// ─── Constants ────────────────────────────────────────────────────────────────
const TIERS = ['1순위', '2순위', '3순위', '4순위', '5순위']

const STATUS_OPTIONS = [
  { value: '',          label: '미발송',  bg: '#f1f5f9', color: '#64748b' },
  { value: 'target',    label: '컨택예정', bg: '#ede9fe', color: '#7c3aed' },
  { value: 'yes',       label: '완료',    bg: '#dbeafe', color: '#1d4ed8' },
  { value: 'reply',     label: '답장',    bg: '#fef3c7', color: '#d97706' },
  { value: 'negotiate', label: '협의중',  bg: '#d1fae5', color: '#065f46' },
  { value: 'accept',    label: '확정',    bg: '#bbf7d0', color: '#14532d' },
  { value: 'reject',    label: '거절',    bg: '#fee2e2', color: '#991b1b' },
]
const STATUS_LABELS: Record<string, string> = Object.fromEntries(STATUS_OPTIONS.map(s => [s.value, s.label]))
const STATUS_STYLE: Record<string, { bg: string; color: string }> = Object.fromEntries(STATUS_OPTIONS.map(s => [s.value, { bg: s.bg, color: s.color }]))

// ─── GAS types ────────────────────────────────────────────────────────────────
interface InfluencerRow {
  name: string; handle: string; email: string; followers: string; avgViews: string
  following: string; totalLikes: string; videoCount: string; engRate: string
  bio: string; profileUrl: string
  outreach: string; replyBody: string; replyDate: string
  sheetRow: number; sheetName: string; tierRank: string
}

interface OutreachData {
  error?: string
  [tier: string]: unknown
}

interface TierData {
  stats?: { total?: number; sent?: number; replied?: number; accepted?: number }
  rows?: string[][]; rowNums?: number[]; sheetNames?: string[]
  colIdx?: Record<string, number>
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
function applyPlaceholders(text: string, inf: InfluencerRow | null) {
  if (!inf) return text
  return text
    .replace(/\{\{이름\}\}/g, inf.name)
    .replace(/\{\{핸들\}\}/g, '@' + inf.handle)
    .replace(/\{\{이메일\}\}/g, inf.email)
    .replace(/\{\{팔로워\}\}/g, fmtNum(inf.followers))
    .replace(/\{\{조회수\}\}/g, fmtNum(inf.avgViews))
}

// ─── Tab types ────────────────────────────────────────────────────────────────
type ContactTab = 'pending' | 'sent' | 'accepted'
const TABS: { key: ContactTab; label: string }[] = [
  { key: 'pending',  label: '컨택 예정' },
  { key: 'sent',     label: '컨택 완료' },
  { key: 'accepted', label: '확정 인플루언서' },
]

const PAGE_SIZE = 25
function paginate<T>(items: T[], page: number) {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safe = Math.min(page, totalPages)
  const startIdx = (safe - 1) * PAGE_SIZE
  return { pageItems: items.slice(startIdx, startIdx + PAGE_SIZE), total, totalPages, page: safe, startIdx, endIdx: Math.min(startIdx + PAGE_SIZE, total) }
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function Outreach() {
  const { showToast } = useToast()

  // ── Tab ──
  const [contactTab, setContactTab] = useState<ContactTab>('pending')

  // ── GAS data ──
  const [outreachData,    setOutreachData]    = useState<OutreachData | null>(null)
  const [loading,         setLoading]         = useState(true)
  const [confirmedCount,  setConfirmedCount]  = useState<number | null>(null)

  // ── 컨택 예정: tier table state ──
  const [activeTier,      setActiveTier]      = useState('1순위')
  const [selectedIdx,     setSelectedIdx]     = useState<number | null>(null)
  const [checkedIdxs,     setCheckedIdxs]     = useState<Set<number>>(new Set())
  const [bulkTplIdx,      setBulkTplIdx]      = useState(0)
  const [bulkSending,     setBulkSending]     = useState(false)
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({})

  // ── Template & draft ──
  const [templates,       setTemplates]       = useState(loadTemplates)
  const [selectedTplIdx,  setSelectedTplIdx]  = useState(0)
  const [tplName,         setTplName]         = useState('')
  const [tplSubject,      setTplSubject]       = useState('')
  const [tplBody,         setTplBody]         = useState('')
  const [draftSubject,    setDraftSubject]     = useState('')
  const [draftBody,       setDraftBody]       = useState('')
  const [sendingEmail,    setSendingEmail]     = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  // ── Pagination ──
  const [sentPage,     setSentPage]     = useState(1)
  const [acceptedPage, setAcceptedPage] = useState(1)

  // ── Load ──
  useEffect(() => { loadOutreach() }, [])

  useEffect(() => {
    const tpl = templates[selectedTplIdx]
    if (tpl) { setTplName(tpl.name); setTplSubject(tpl.subject); setTplBody(tpl.body) }
  }, [selectedTplIdx, templates])

  async function loadOutreach() {
    setLoading(true)
    try {
      const [data, confirmed] = await Promise.all([
        gasGet<OutreachData>('getOutreachData'),
        gasGet<{ rows?: unknown[] }>('getConfirmedInfluencers'),
      ])
      setOutreachData(data)
      setConfirmedCount((confirmed.rows || []).length)
    } catch (e: unknown) {
      setOutreachData({ error: (e as Error).message })
    }
    setLoading(false)
  }

  async function syncReplies() {
    try {
      const res: { synced?: number; error?: string } = await gasPost({ action: 'syncOutlookReplies' })
      if (res.error) { showToast(res.error, 'error') } else {
        showToast(`${res.synced || 0}개 답장 동기화 완료`, 'success')
        loadOutreach()
      }
    } catch (e: unknown) { showToast((e as Error).message, 'error') }
  }

  // ── Row helpers ──
  function getRows(): InfluencerRow[] {
    if (!outreachData) return []
    const td = outreachData[activeTier] as TierData
    if (!td) return []
    const C = td.colIdx || {}
    return (td.rows || []).map((r, i) => ({
      name:       r[C.name]       || r[C.displayName] || r[3]  || '',
      handle:     r[C.handle]     || r[2]  || '',
      email:      r[C.email]      || r[4]  || '',
      followers:  r[C.followers]  || r[C.follower] || r[5]  || '',
      following:  r[C.following]  || r[6]  || '',
      totalLikes: r[C.totalLikes] || r[7]  || '',
      videoCount: r[C.videoCount] || r[8]  || '',
      engRate:    r[C.engRate]    || r[9]  || '',
      bio:        r[C.bio]        || r[10] || '',
      profileUrl: r[C.profileUrl] || r[11] || '',
      avgViews:   r[C.avgView]    || r[12] || '',
      outreach:   r[C.outreach]   || r[C.sent] || r[13] || '',
      replyBody:  r[C.replyBody]  || r[15] || '',
      replyDate:  r[C.replyDate]  || r[16] || '',
      sheetRow:   (td.rowNums    || [])[i],
      sheetName:  (td.sheetNames || [])[i] || '',
      tierRank: activeTier,
    }))
  }

  function flattenAll(): InfluencerRow[] {
    if (!outreachData) return []
    return TIERS.flatMap(tier => {
      const td = outreachData[tier] as TierData | undefined
      if (!td) return []
      const C = td.colIdx || {}
      return (td.rows || []).map((r, i) => ({
        name:       r[C.name]       || r[C.displayName] || r[3]  || '',
        handle:     r[C.handle]     || r[2]  || '',
        email:      r[C.email]      || r[4]  || '',
        followers:  r[C.followers]  || r[C.follower] || r[5]  || '',
        following:  r[C.following]  || r[6]  || '',
        totalLikes: r[C.totalLikes] || r[7]  || '',
        videoCount: r[C.videoCount] || r[8]  || '',
        engRate:    r[C.engRate]    || r[9]  || '',
        bio:        r[C.bio]        || r[10] || '',
        profileUrl: r[C.profileUrl] || r[11] || '',
        avgViews:   r[C.avgView]    || r[12] || '',
        outreach:   r[C.outreach]   || r[C.sent] || r[13] || '',
        replyBody:  r[C.replyBody]  || r[15] || '',
        replyDate:  r[C.replyDate]  || r[16] || '',
        sheetRow:   (td.rowNums    || [])[i],
        sheetName:  (td.sheetNames || [])[i] || '',
        tierRank: tier,
      }))
    })
  }

  // ── Draft ──
  function selectInfluencer(idx: number) {
    setSelectedIdx(idx)
    const rows = getRows()
    const inf = rows[idx]
    const tpl = templates[selectedTplIdx]
    if (!tpl || !inf) return
    setDraftSubject(applyPlaceholders(tpl.subject, inf))
    setDraftBody(applyPlaceholders(tpl.body, inf))
  }

  async function sendEmailDirectly() {
    const rows = getRows()
    const inf = selectedIdx !== null ? rows[selectedIdx] : null
    if (!inf || !inf.email) { showToast('이메일 주소가 없습니다.', 'error'); return }
    setSendingEmail(true)
    try {
      const res: { ok?: boolean; error?: string } = await gasPost({
        action: 'sendOutreachEmail', to: inf.email, subject: draftSubject, body: draftBody,
        sheetRow: inf.sheetRow, sheetName: inf.sheetName,
      })
      if (res.error) { showToast(res.error, 'error') } else {
        showToast('발송 완료!', 'success'); loadOutreach()
      }
    } catch (e: unknown) { showToast((e as Error).message, 'error') }
    setSendingEmail(false)
  }

  async function markAsSent() {
    const rows = getRows()
    const inf = selectedIdx !== null ? rows[selectedIdx] : null
    if (!inf) return
    try {
      await gasPost({ action: 'markOutreachState', sheetRow: inf.sheetRow, sheetName: inf.sheetName, value: 'yes' })
      showToast('발송 완료 처리됨', 'success'); loadOutreach()
    } catch (e: unknown) { showToast((e as Error).message, 'error') }
  }

  async function updateState(value: string) {
    const rows = getRows()
    const inf = selectedIdx !== null ? rows[selectedIdx] : null
    if (!inf) return
    try {
      await gasPost({ action: 'markOutreachState', sheetRow: inf.sheetRow, sheetName: inf.sheetName, value })
      showToast('상태 업데이트됨', 'success'); loadOutreach()
    } catch (e: unknown) { showToast((e as Error).message, 'error') }
  }

  async function updateRowState(inf: InfluencerRow, value: string) {
    const key = `${inf.sheetName}_${inf.sheetRow}`
    setStatusOverrides(prev => ({ ...prev, [key]: value }))
    try {
      const res: { ok?: boolean; error?: string } = await gasPost({ action: 'markOutreachState', sheetRow: inf.sheetRow, sheetName: inf.sheetName, value })
      if (res.error) {
        showToast(res.error, 'error')
        setStatusOverrides(prev => { const n = { ...prev }; delete n[key]; return n })
      }
    } catch (e: unknown) {
      showToast((e as Error).message, 'error')
      setStatusOverrides(prev => { const n = { ...prev }; delete n[key]; return n })
    }
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

  // ── Derived data ──
  const rows    = getRows()
  const allRows = flattenAll()
  const tierData   = outreachData ? (outreachData[activeTier] as TierData) : null
  const stats      = tierData?.stats || {}
  const selected   = selectedIdx !== null ? rows[selectedIdx] : null

  const allStats = TIERS.reduce((acc, t) => {
    const s = outreachData ? ((outreachData[t] as TierData)?.stats || {}) : {}
    acc.total += s.total || 0; acc.sent += s.sent || 0; acc.replied += (s.replied || 0)
    return acc
  }, { total: 0, sent: 0, replied: 0 })

  const tierBreakdown = TIERS.map(t => {
    const s = outreachData ? ((outreachData[t] as TierData)?.stats || {}) : {}
    return { tier: t.replace('순위', ''), sent: s.sent || 0, total: s.total || 0 }
  })

  const sentRows     = allRows.filter(r => ['yes', 'reply', 'negotiate'].includes(r.outreach.toLowerCase()))
  const acceptedRows = allRows.filter(r => r.outreach.toLowerCase() === 'accept')
  const sp = paginate(sentRows, sentPage)
  const ap = paginate(acceptedRows, acceptedPage)

  const countMap: Record<ContactTab, number> = {
    pending:  rows.length,
    sent:     sentRows.length,
    accepted: acceptedRows.length,
  }

  // ── Shared styles ──
  const thStyle: React.CSSProperties = {
    padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700,
    color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px',
    background: 'var(--gray-1)', position: 'sticky', top: 0, zIndex: 1,
  }

  // ── Simple table for 컨택 완료 ──
  function renderSimpleTable(pg: ReturnType<typeof paginate<InfluencerRow>>, allForTab: InfluencerRow[], actions: (r: InfluencerRow) => React.ReactNode, onPrev: () => void, onNext: () => void) {
    if (loading) return (
      <div style={{ padding: '60px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <Spinner /><span style={{ fontSize: 13, color: 'var(--gray-5)' }}>데이터 불러오는 중...</span>
      </div>
    )
    if (allForTab.length === 0) return <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--gray-5)', fontSize: 13 }}>데이터가 없습니다.</div>
    return (
      <>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--gray-3)' }}>
                <th style={thStyle}>이름</th>
                <th style={thStyle}>핸들</th>
                <th style={thStyle}>이메일</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>팔로워</th>
                <th style={thStyle}>순위</th>
                <th style={thStyle}>상태</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>액션</th>
              </tr>
            </thead>
            <tbody>
              {pg.pageItems.map((r, i) => {
                const sk = r.outreach.toLowerCase()
                const s = STATUS_STYLE[sk] || STATUS_STYLE['']
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--gray-2)' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13 }}>{r.name || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12 }}>
                      <a href={`https://www.tiktok.com/@${r.handle}`} target="_blank" rel="noopener"
                        style={{ color: 'var(--blue-dk)', textDecoration: 'none', fontWeight: 500 }}>@{r.handle}</a>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--gray-6)' }}>{r.email || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600, textAlign: 'right', color: 'var(--gray-7)' }}>{r.followers ? fmtNum(r.followers) : '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--gray-5)' }}>{r.tierRank}</td>
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
            <button onClick={syncReplies} style={{ padding: '8px 16px', background: '#fef9c3', color: '#92400e', fontWeight: 700, fontSize: 12, borderRadius: 10, border: '1px solid #fde68a', cursor: 'pointer' }}>답장 동기화</button>
            <button onClick={() => { setStatusOverrides({}); loadOutreach() }} style={{ padding: '8px 16px', background: '#fff', color: '#334', fontWeight: 700, fontSize: 12, borderRadius: 10, border: '1px solid var(--gray-3)', cursor: 'pointer' }}>↻ 새로고침</button>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      {loading && <div className="loader"><Spinner /></div>}
      {!loading && outreachData && !outreachData.error && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 28 }}>
          <div style={{ background: 'var(--gray-0)', borderRadius: 14, border: '1px solid var(--gray-2)', padding: '20px 24px', boxShadow: 'var(--shadow)' }}>
            <div style={{ fontSize: 12, color: 'var(--gray-5)', marginBottom: 8 }}>전체 타겟 리스트</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--gray-8)', letterSpacing: '-1px' }}>{allStats.total}</span>
              <span style={{ fontSize: 14, color: 'var(--gray-5)' }}>명</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--gray-5)' }}>
              {tierBreakdown.map((t, i) => (
                <span key={t.tier}>
                  {i > 0 && <span style={{ margin: '0 4px', opacity: 0.4 }}>·</span>}
                  <span>{t.tier}순위 <strong style={{ color: 'var(--gray-7)' }}>{t.sent}/{t.total}</strong></span>
                </span>
              ))}
            </div>
          </div>
          <div style={{ background: 'var(--gray-0)', borderRadius: 14, border: '1px solid var(--gray-2)', padding: '20px 24px', boxShadow: 'var(--shadow)' }}>
            <div style={{ fontSize: 12, color: 'var(--gray-5)', marginBottom: 8 }}>발송 성과율</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--gray-8)', letterSpacing: '-1px' }}>{allStats.sent}</span>
              <span style={{ fontSize: 13, color: 'var(--gray-5)', fontWeight: 500 }}>/ {allStats.total} 발송됨</span>
            </div>
            <div style={{ height: 4, background: 'var(--gray-2)', borderRadius: 99, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ height: '100%', width: `${allStats.total > 0 ? Math.min(allStats.sent / allStats.total * 100, 100) : 0}%`, background: 'var(--teal-dk)', borderRadius: 99, transition: 'width .4s' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--gray-5)' }}>{allStats.total > 0 ? Math.round(allStats.sent / allStats.total * 100) : 0}% 완료</div>
          </div>
          <div style={{ background: 'var(--gray-0)', borderRadius: 14, border: '1px solid var(--yellow-md)', padding: '20px 24px', boxShadow: 'var(--shadow)' }}>
            <div style={{ fontSize: 12, color: 'var(--gray-5)', marginBottom: 8 }}>답장 수신 통계</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: '#d97706', letterSpacing: '-1px' }}>{allStats.replied}</span>
              <span style={{ fontSize: 13, color: 'var(--gray-5)', fontWeight: 500 }}>명 답장</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--gray-5)' }}>
              {allStats.sent > 0 ? Math.round(allStats.replied / allStats.sent * 100) : 0}% 회신율
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

      {/* ══ 컨택 예정 — full original outreach system ══ */}
      {contactTab === 'pending' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

          {/* Left: influencer table */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--gray-3)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-2)' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-8)' }}>아웃리치 대상 명단</div>
              <div style={{ fontSize: 12, color: 'var(--gray-5)', marginTop: 4 }}>대상을 클릭해 초안을 편집하고 발송하세요.</div>
            </div>

            {/* Tier tabs */}
            <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--gray-2)', background: 'var(--gray-1)', display: 'flex', gap: 6, overflowX: 'auto' }}>
              {TIERS.map(t => (
                <button key={t} onClick={() => { setActiveTier(t); setSelectedIdx(null) }}
                  style={{
                    padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
                    background: activeTier === t ? 'var(--blue-dk)' : 'transparent',
                    color: activeTier === t ? '#fff' : 'var(--gray-5)',
                  }}>
                  {t}
                </button>
              ))}
            </div>

            {/* Bulk actions */}
            {checkedIdxs.size > 0 && (
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--blue-lt)', background: '#eef3ff', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{checkedIdxs.size}명 선택됨</span>
                <select value={bulkTplIdx} onChange={e => setBulkTplIdx(+e.target.value)}
                  style={{ flex: 1, minWidth: 160, fontSize: 12, border: '1px solid var(--blue)', borderRadius: 8, padding: '6px 10px', background: '#fff', outline: 'none', fontFamily: 'inherit' }}>
                  {templates.map((t: any, i: number) => <option key={t.id} value={i}>{t.name}</option>)}
                </select>
                <button disabled={bulkSending}
                  onClick={async () => {
                    const tpl = templates[bulkTplIdx]
                    if (!tpl) return
                    setBulkSending(true)
                    for (const idx of Array.from(checkedIdxs)) {
                      const inf = rows[idx]
                      if (!inf || !inf.email) continue
                      await gasPost({ action: 'sendOutreachEmail', to: inf.email, subject: applyPlaceholders(tpl.subject, inf), body: applyPlaceholders(tpl.body, inf), sheetRow: inf.sheetRow, sheetName: inf.sheetName })
                    }
                    setBulkSending(false); setCheckedIdxs(new Set())
                    showToast(`${checkedIdxs.size}명에게 발송 완료`, 'success'); loadOutreach()
                  }}
                  style={{ padding: '6px 14px', background: 'var(--blue-dk)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                  {bulkSending ? '발송 중...' : '일괄 발송'}
                </button>
                <button onClick={() => setCheckedIdxs(new Set())}
                  style={{ padding: '6px 10px', background: 'transparent', color: 'var(--gray-5)', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>취소</button>
              </div>
            )}

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: 36 }} /><col /><col style={{ width: 110 }} /><col style={{ width: 68 }} /><col style={{ width: 100 }} /><col style={{ width: 180 }} />
                </colgroup>
                <thead>
                  <tr style={{ background: 'var(--gray-1)', fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '2px solid var(--gray-3)' }}>
                    <th style={{ padding: '10px 8px', textAlign: 'center' }}>
                      <input type="checkbox" onChange={e => setCheckedIdxs(e.target.checked ? new Set(rows.map((_, i) => i)) : new Set())} />
                    </th>
                    <th style={{ padding: '10px 14px' }}>이름</th>
                    <th style={{ padding: '10px 12px' }}>핸들</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>팔로워</th>
                    <th style={{ padding: '10px 10px' }}>상태</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>초안 / 액션</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center' }}><Spinner /></td></tr>}
                  {!loading && rows.length === 0 && <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--gray-5)' }}>데이터가 없습니다</td></tr>}
                  {rows.map((inf, i) => {
                    const overrideKey = `${inf.sheetName}_${inf.sheetRow}`
                    const statusKey = (statusOverrides[overrideKey] !== undefined ? statusOverrides[overrideKey] : (inf.outreach || '')).toLowerCase()
                    const isSelected = selectedIdx === i
                    const s = STATUS_STYLE[statusKey] || STATUS_STYLE['']
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--gray-2)', cursor: 'pointer', background: isSelected ? 'var(--blue-lt)' : undefined, transition: 'background .1s' }}
                        onClick={() => selectInfluencer(i)}>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={checkedIdxs.has(i)} onChange={e => {
                            const next = new Set(checkedIdxs); e.target.checked ? next.add(i) : next.delete(i); setCheckedIdxs(next)
                          }} />
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--gray-8)' }}>{inf.name || '—'}</div>
                          {inf.email && <div style={{ fontSize: 11, color: 'var(--gray-4)', marginTop: 2 }}>{inf.email}</div>}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 12 }}>
                          {inf.handle ? (
                            <a href={`https://www.tiktok.com/@${inf.handle}`} target="_blank" rel="noopener"
                              style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--blue-dk)', textDecoration: 'none', fontWeight: 500 }}
                              onClick={e => e.stopPropagation()}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 80 }}>{inf.handle}</span>
                            </a>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '10px 8px', fontSize: 12, fontWeight: 600, textAlign: 'right', color: 'var(--gray-7)' }}>
                          {inf.followers ? fmtNum(inf.followers) : '—'}
                        </td>
                        <td style={{ padding: '10px 10px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          <select value={statusKey} onChange={e => updateRowState(inf, e.target.value)}
                            style={{ fontSize: 11, fontWeight: 600, border: '1px solid var(--gray-3)', borderRadius: 6, padding: '4px 6px', background: '#fff', color: s.color, outline: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' }}>
                            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', alignItems: 'center' }}>
                            {statusKey === 'negotiate' ? (
                              <>
                                <button onClick={() => { setSelectedIdx(i); updateState('accept') }}
                                  style={{ padding: '4px 10px', background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✓ 수락</button>
                                <button onClick={() => { setSelectedIdx(i); updateState('reject') }}
                                  style={{ padding: '4px 10px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✗ 거절</button>
                              </>
                            ) : statusKey === 'reply' ? (
                              <button onClick={() => selectInfluencer(i)}
                                style={{ padding: '4px 10px', background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✏ 답장</button>
                            ) : (
                              <>
                                <button onClick={() => selectInfluencer(i)}
                                  style={{ padding: '4px 10px', background: 'var(--yellow)', color: 'var(--yellow-text)', border: '1px solid var(--yellow-md)', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✏ 초안</button>
                                {statusKey === '' && (
                                  <button onClick={() => updateRowState(inf, 'yes')} title="발송완료"
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
            {selected && selected.outreach === 'reply' && selected.replyBody && (
              <div style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#92400e', marginBottom: 10 }}>✉ 인플루언서 회신 메일 내용 도착!</div>
                <div style={{ fontSize: 12, background: '#fff', padding: 12, borderRadius: 8, border: '1px solid #fde68a', color: '#555', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{selected.replyBody}</div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 10 }}>
                  <button onClick={() => updateState('negotiate')} style={{ padding: '5px 12px', background: '#fff', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>협의중 마킹</button>
                </div>
              </div>
            )}

            {/* Negotiate card */}
            {selected && selected.outreach === 'negotiate' && (
              <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#166534', marginBottom: 8 }}>🤝 협의 진행 중</div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                  <button onClick={() => updateState('reject')} style={{ padding: '6px 14px', background: '#fff0f0', color: '#c00', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>거절 처리</button>
                  <button onClick={() => updateState('accept')} style={{ padding: '6px 14px', background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>수락 확정</button>
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
                {selected && <span style={{ fontSize: 12, fontWeight: 600, background: 'var(--blue-lt)', color: 'var(--blue-dk)', padding: '4px 10px', borderRadius: 999 }}>{selected.name} 대상</span>}
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
                      {['{{이름}}', '{{핸들}}', '{{이메일}}', '{{팔로워}}', '{{조회수}}'].map(p => (
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
            <div style={{ fontSize: 12, color: 'var(--gray-5)', marginTop: 4 }}>아웃리치 시트의 완료·답장·협의중 상태 기준으로 표시됩니다.</div>
          </div>
          {renderSimpleTable(sp, sentRows, r => (
            <>
              <button onClick={() => updateRowState(r, 'accept')}
                style={{ padding: '4px 10px', background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✓ 수락</button>
              <button onClick={() => updateRowState(r, 'reject')}
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
          {loading
            ? <div style={{ padding: '60px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}><Spinner /><span style={{ fontSize: 13, color: 'var(--gray-5)' }}>데이터 불러오는 중...</span></div>
            : acceptedRows.length === 0
              ? <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--gray-5)', fontSize: 13 }}>확정된 인플루언서가 없습니다.</div>
              : <>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--gray-3)' }}>
                          {['Handle','Display Name','Email','Followers','Following','Following Ratio (%)','Total Likes','Video Count','Engagement Rate (%)','Bio','Profile URL'].map(h => (
                            <th key={h} style={thStyle}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ap.pageItems.map((r, i) => {
                          const fRaw = parseFloat(r.followers.replace(/,/g,''))
                          const gRaw = parseFloat(r.following.replace(/,/g,''))
                          const ratio = fRaw > 0 && gRaw >= 0 ? ((gRaw / fRaw) * 100).toFixed(1) + '%' : '—'
                          const lRaw  = parseFloat(r.totalLikes.replace(/,/g,''))
                          const vRaw  = parseFloat(r.videoCount.replace(/,/g,''))
                          const er    = fRaw > 0 && lRaw >= 0 && vRaw > 0
                            ? (((lRaw / vRaw) / fRaw) * 100).toFixed(2) + '%'
                            : r.engRate ? r.engRate + '%' : '—'
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid var(--gray-2)' }}>
                              <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600 }}>
                                <a href={`https://www.tiktok.com/@${r.handle}`} target="_blank" rel="noopener" style={{ color: 'var(--blue-dk)', textDecoration: 'none' }}>@{r.handle}</a>
                              </td>
                              <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700 }}>{r.name || '—'}</td>
                              <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--gray-6)' }}>{r.email || '—'}</td>
                              <td style={{ padding: '10px 14px', fontSize: 12, textAlign: 'right', fontWeight: 600 }}>{r.followers ? fmtNum(r.followers) : '—'}</td>
                              <td style={{ padding: '10px 14px', fontSize: 12, textAlign: 'right' }}>{r.following ? fmtNum(r.following) : '—'}</td>
                              <td style={{ padding: '10px 14px', fontSize: 12, textAlign: 'right' }}>{ratio}</td>
                              <td style={{ padding: '10px 14px', fontSize: 12, textAlign: 'right' }}>{r.totalLikes ? fmtNum(r.totalLikes) : '—'}</td>
                              <td style={{ padding: '10px 14px', fontSize: 12, textAlign: 'right' }}>{r.videoCount || '—'}</td>
                              <td style={{ padding: '10px 14px', fontSize: 12, textAlign: 'right' }}>{er}</td>
                              <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--gray-6)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.bio || '—'}</td>
                              <td style={{ padding: '10px 14px', fontSize: 12 }}>
                                {r.profileUrl ? <a href={r.profileUrl} target="_blank" rel="noopener" style={{ color: 'var(--blue-dk)', textDecoration: 'none' }}>↗ 프로필</a> : '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <Pagination page={ap.page} totalPages={ap.totalPages} total={ap.total}
                    startIdx={ap.startIdx} endIdx={ap.endIdx}
                    onPrev={() => setAcceptedPage(p => Math.max(1, p - 1))}
                    onNext={() => setAcceptedPage(p => Math.min(ap.totalPages, p + 1))} />
                </>
          }
        </div>
      )}
    </div>
  )
}
