import { useEffect, useState, useRef } from 'react'
import { gasGet, gasPost } from '../../../lib/api'
import { fmtNum } from '../../../lib/utils'
import { useToast } from '../../../contexts/ToastContext'
import Spinner from '../../../components/Spinner'
import Pagination from '../../../components/Pagination'

// ─── GAS outreach types ────────────────────────────────────────────────────────
const TIERS = ['1순위', '2순위', '3순위', '4순위', '5순위']

interface TierData {
  rows?: string[][]
  rowNums?: number[]
  sheetNames?: string[]
  colIdx?: Record<string, number>
}
interface OutreachData {
  error?: string
  [tier: string]: unknown
}
interface GasRow {
  name: string
  handle: string
  email: string
  followers: string
  avgViews: string
  outreach: string
  sheetRow: number
  sheetName: string
  tier: string
}

function flattenOutreach(data: OutreachData): GasRow[] {
  return TIERS.flatMap(tier => {
    const td = data[tier] as TierData | undefined
    if (!td) return []
    const C = td.colIdx || {}
    return (td.rows || []).map((r, i) => ({
      name:      r[C.name]      || r[C.displayName] || r[3] || '',
      handle:    r[C.handle]    || r[2] || '',
      email:     r[C.email]     || r[4] || '',
      followers: r[C.followers] || r[5] || '',
      avgViews:  r[C.avgView]   || r[10] || '',
      outreach:  (r[C.outreach] || r[C.sent] || r[13] || '').toLowerCase(),
      sheetRow:  (td.rowNums    || [])[i],
      sheetName: (td.sheetNames || [])[i] || '',
      tier,
    }))
  })
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
function applyPlaceholders(text: string, inf: GasRow | null) {
  if (!inf) return text
  return text
    .replace(/\{\{이름\}\}/g, inf.name)
    .replace(/\{\{핸들\}\}/g, '@' + inf.handle)
    .replace(/\{\{이메일\}\}/g, inf.email)
    .replace(/\{\{팔로워\}\}/g, fmtNum(inf.followers))
    .replace(/\{\{조회수\}\}/g, fmtNum(inf.avgViews))
}

// ─── Tab config ────────────────────────────────────────────────────────────────
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

// ─── Component ─────────────────────────────────────────────────────────────────
export default function Outreach() {
  const { showToast } = useToast()

  const [contactTab, setContactTab] = useState<ContactTab>('pending')

  // GAS data — single load for all tabs
  const [outreachData, setOutreachData] = useState<OutreachData | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [gasError,     setGasError]     = useState('')

  // Email draft (컨택 예정)
  const [selectedRow,    setSelectedRow]    = useState<GasRow | null>(null)
  const [templates,      setTemplates]      = useState(loadTemplates)
  const [selectedTplIdx, setSelectedTplIdx] = useState(0)
  const [draftSubject,   setDraftSubject]   = useState('')
  const [draftBody,      setDraftBody]      = useState('')
  const [sendingEmail,   setSendingEmail]   = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  // Pagination
  const [pendingPage,  setPendingPage]  = useState(1)
  const [sentPage,     setSentPage]     = useState(1)
  const [acceptedPage, setAcceptedPage] = useState(1)

  useEffect(() => { loadOutreach() }, [])

  async function loadOutreach() {
    setLoading(true)
    setGasError('')
    try {
      const d = await gasGet<OutreachData>('getOutreachData')
      setOutreachData(d)
    } catch (e: unknown) {
      setGasError((e as Error).message)
    }
    setLoading(false)
  }

  // Derive rows by outreach column value
  const allRows      = outreachData ? flattenOutreach(outreachData) : []
  const pendingRows  = allRows.filter(r => r.outreach === 'target')
  const sentRows     = allRows.filter(r => ['yes', 'reply', 'negotiate'].includes(r.outreach))
  const acceptedRows = allRows.filter(r => r.outreach === 'accept')

  const countMap: Record<ContactTab, number> = {
    pending:  pendingRows.length,
    sent:     sentRows.length,
    accepted: acceptedRows.length,
  }

  // Reset pages when tab changes
  useEffect(() => { setPendingPage(1) },  [pendingRows.length])
  useEffect(() => { setSentPage(1) },     [sentRows.length])
  useEffect(() => { setAcceptedPage(1) }, [acceptedRows.length])

  const pp = paginate(pendingRows,  pendingPage)
  const sp = paginate(sentRows,     sentPage)
  const ap = paginate(acceptedRows, acceptedPage)

  // ── Draft builder helpers ──
  useEffect(() => {
    if (!selectedRow) return
    const tpl = templates[selectedTplIdx]
    if (!tpl) return
    setDraftSubject(applyPlaceholders(tpl.subject, selectedRow))
    setDraftBody(applyPlaceholders(tpl.body, selectedRow))
  }, [selectedTplIdx, selectedRow])

  function selectRow(row: GasRow) {
    setSelectedRow(row)
    const tpl = templates[selectedTplIdx]
    if (tpl) {
      setDraftSubject(applyPlaceholders(tpl.subject, row))
      setDraftBody(applyPlaceholders(tpl.body, row))
    }
  }

  async function gasUpdateStatus(row: GasRow, value: string) {
    try {
      const res: { ok?: boolean; error?: string } = await gasPost({
        action: 'markOutreachState',
        sheetRow: row.sheetRow,
        sheetName: row.sheetName,
        value,
      })
      if (res.error) { showToast(res.error, 'error'); return }
      showToast('상태 업데이트됨', 'success')
      if (selectedRow?.sheetRow === row.sheetRow) setSelectedRow(null)
      loadOutreach()
    } catch (e: unknown) { showToast((e as Error).message, 'error') }
  }

  async function sendEmail() {
    if (!selectedRow?.email) { showToast('이메일 주소가 없습니다.', 'error'); return }
    setSendingEmail(true)
    try {
      const res: { ok?: boolean; error?: string } = await gasPost({
        action: 'sendOutreachEmail',
        to: selectedRow.email,
        subject: draftSubject,
        body: draftBody,
        sheetRow: selectedRow.sheetRow,
        sheetName: selectedRow.sheetName,
      })
      if (res.error) { showToast(res.error, 'error') } else {
        showToast('발송 완료!', 'success')
        // mark as 'yes' on sheet
        await gasPost({ action: 'markOutreachState', sheetRow: selectedRow.sheetRow, sheetName: selectedRow.sheetName, value: 'yes' })
        setSelectedRow(null)
        loadOutreach()
      }
    } catch (e: unknown) { showToast((e as Error).message, 'error') }
    setSendingEmail(false)
  }

  function insertPlaceholder(ph: string) {
    const ta = bodyRef.current
    if (!ta) { setDraftBody(prev => prev + ph); return }
    const s = ta.selectionStart, e = ta.selectionEnd
    setDraftBody(draftBody.slice(0, s) + ph + draftBody.slice(e))
    setTimeout(() => { ta.selectionStart = ta.selectionEnd = s + ph.length; ta.focus() }, 0)
  }

  // ── Shared styles ──
  const thStyle: React.CSSProperties = {
    padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700,
    color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px',
    background: 'var(--gray-1)', position: 'sticky', top: 0, zIndex: 1,
  }

  // ── Loading / error full-card states ──
  function LoadingState() {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <Spinner />
        <span style={{ fontSize: 13, color: 'var(--gray-5)' }}>데이터 불러오는 중...</span>
      </div>
    )
  }

  // ── GAS table renderer (plain function, NOT a React component) ──
  function renderGasTable(pg: ReturnType<typeof paginate<GasRow>>, allRowsForTab: GasRow[], actions: (r: GasRow) => React.ReactNode, onPrev: () => void, onNext: () => void, onRowClick?: (r: GasRow) => void) {
    if (loading) return <LoadingState />
    if (gasError) return <div style={{ padding: 24, color: '#b91c1c', fontSize: 13 }}>{gasError}</div>
    if (allRowsForTab.length === 0) return <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--gray-5)', fontSize: 13 }}>데이터가 없습니다.</div>
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
                <th style={{ ...thStyle, textAlign: 'right' }}>액션</th>
              </tr>
            </thead>
            <tbody>
              {pg.pageItems.map((r, i) => (
                <tr key={i}
                  onClick={() => onRowClick?.(r)}
                  style={{
                    borderBottom: '1px solid var(--gray-2)',
                    cursor: onRowClick ? 'pointer' : 'default',
                    background: selectedRow?.sheetRow === r.sheetRow ? 'var(--blue-lt)' : undefined,
                  }}>
                  <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13 }}>{r.name || '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12 }}>
                    <a href={`https://www.tiktok.com/@${r.handle}`} target="_blank" rel="noopener"
                      style={{ color: 'var(--blue-dk)', textDecoration: 'none', fontWeight: 500 }}
                      onClick={e => e.stopPropagation()}>
                      @{r.handle}
                    </a>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--gray-6)' }}>{r.email || '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600, textAlign: 'right', color: 'var(--gray-7)' }}>
                    {r.followers ? fmtNum(r.followers) : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--gray-5)' }}>{r.tier}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>{actions(r)}</div>
                  </td>
                </tr>
              ))}
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

      {/* Tab bar */}
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
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
          <button onClick={loadOutreach} style={{ padding: '6px 14px', background: '#fff', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--gray-6)' }}>
            ↻ 새로고침
          </button>
        </div>
      </div>

      {/* ── 컨택 예정 (GAS outreach = 'contact') ── */}
      {contactTab === 'pending' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--gray-3)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-2)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-8)' }}>컨택 예정 인플루언서</div>
              <div style={{ fontSize: 12, color: 'var(--gray-5)', marginTop: 4 }}>대상을 클릭해 이메일 초안을 작성하세요.</div>
            </div>
            {renderGasTable(pp, pendingRows, r => (
              <button onClick={() => gasUpdateStatus(r, 'yes')}
                style={{ padding: '4px 10px', background: '#dbeafe', color: '#1d4ed8', border: '1px solid #93c5fd', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                완료
              </button>
            ),
            () => setPendingPage(p => Math.max(1, p - 1)),
            () => setPendingPage(p => Math.min(pp.totalPages, p + 1)),
            selectRow)}
          </div>

          {/* Email draft builder */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--gray-3)', boxShadow: 'var(--shadow)', padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--gray-2)', paddingBottom: 12, marginBottom: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>이메일 초안 빌더</span>
              {selectedRow && (
                <span style={{ fontSize: 12, fontWeight: 600, background: 'var(--blue-lt)', color: 'var(--blue-dk)', padding: '4px 10px', borderRadius: 999 }}>
                  {selectedRow.name} 대상
                </span>
              )}
            </div>
            {!selectedRow
              ? <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--gray-5)', fontSize: 13 }}>
                  인플루언서를 클릭하면 초안을 작성할 수 있습니다.
                </div>
              : <>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--blue-dk)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>템플릿 선택</div>
                    <select value={selectedTplIdx} onChange={e => setSelectedTplIdx(+e.target.value)}
                      style={{ width: '100%', fontSize: 12, border: '1px solid var(--gray-3)', borderRadius: 8, padding: '8px 12px', outline: 'none', fontFamily: 'inherit', cursor: 'pointer' }}>
                      {templates.map((t: any, i: number) => <option key={t.id} value={i}>{t.name}</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom: 12, border: '1px solid var(--gray-3)', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--gray-1)', borderBottom: '1px solid var(--gray-2)' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--blue-dk)', textTransform: 'uppercase', letterSpacing: '.5px' }}>메일 제목</span>
                      <button onClick={() => navigator.clipboard.writeText(draftSubject).then(() => showToast('복사됨', 'success'))}
                        style={{ fontSize: 11, padding: '2px 8px', background: '#fff', border: '1px solid var(--gray-3)', borderRadius: 6, cursor: 'pointer', color: 'var(--gray-6)', fontWeight: 600 }}>📋 복사</button>
                    </div>
                    <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--gray-8)', lineHeight: 1.5, wordBreak: 'break-all' }}>
                      {draftSubject || <span style={{ color: 'var(--gray-4)' }}>—</span>}
                    </div>
                  </div>
                  <div style={{ marginBottom: 12, border: '1px solid var(--yellow-md)', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: '#fffbeb', borderBottom: '1px solid var(--yellow-md)' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--yellow-text)', textTransform: 'uppercase', letterSpacing: '.5px' }}>본문 (수정 가능)</span>
                      <button onClick={() => navigator.clipboard.writeText(draftBody).then(() => showToast('복사됨', 'success'))}
                        style={{ fontSize: 11, padding: '2px 8px', background: '#fff', border: '1px solid var(--yellow-md)', borderRadius: 6, cursor: 'pointer', color: 'var(--yellow-text)', fontWeight: 600 }}>📋 복사</button>
                    </div>
                    <textarea ref={bodyRef} value={draftBody} onChange={e => setDraftBody(e.target.value)} rows={8}
                      style={{ width: '100%', padding: '10px 12px', border: 'none', fontSize: 12, fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.6, display: 'block' }} />
                  </div>
                  <div style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {['{{이름}}', '{{핸들}}', '{{이메일}}', '{{팔로워}}', '{{조회수}}'].map(p => (
                      <button key={p} onClick={() => insertPlaceholder(p)}
                        style={{ fontSize: 11, padding: '3px 9px', background: 'var(--gray-1)', border: '1px solid var(--gray-3)', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}>
                        {p}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button onClick={sendEmail} disabled={sendingEmail}
                      style={{ padding: '10px', background: 'var(--yellow)', color: 'var(--yellow-text)', border: '1px solid var(--yellow-md)', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      {sendingEmail ? '발송 중...' : '이메일 즉시 전송'}
                    </button>
                    <button onClick={() => gasUpdateStatus(selectedRow, 'yes')}
                      style={{ padding: '10px', background: 'var(--blue-dk)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      컨택 완료로 확정
                    </button>
                  </div>
                </>
            }
          </div>
        </div>
      )}

      {/* ── 컨택 완료 (GAS outreach = yes / reply / negotiate) ── */}
      {contactTab === 'sent' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--gray-3)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-2)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-8)' }}>컨택 완료 인플루언서</div>
            <div style={{ fontSize: 12, color: 'var(--gray-5)', marginTop: 4 }}>아웃리치 시트의 완료·답장·협의중 상태 기준으로 표시됩니다.</div>
          </div>
          {renderGasTable(sp, sentRows, r => (
            <>
              <button onClick={() => gasUpdateStatus(r, 'accept')}
                style={{ padding: '4px 10px', background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                ✓ 수락 확정
              </button>
              <button onClick={() => gasUpdateStatus(r, 'reject')}
                style={{ padding: '4px 10px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                ✗ 거절
              </button>
            </>
          ),
          () => setSentPage(p => Math.max(1, p - 1)),
          () => setSentPage(p => Math.min(sp.totalPages, p + 1)))}
        </div>
      )}

      {/* ── 확정 인플루언서 (GAS outreach = accept) ── */}
      {contactTab === 'accepted' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--gray-3)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-2)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-8)' }}>확정 인플루언서</div>
            <div style={{ fontSize: 12, color: 'var(--gray-5)', marginTop: 4 }}>협업이 확정된 인플루언서 명단입니다.</div>
          </div>
          {renderGasTable(ap, acceptedRows, () => (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7' }}>
              확정
            </span>
          ),
          () => setAcceptedPage(p => Math.max(1, p - 1)),
          () => setAcceptedPage(p => Math.min(ap.totalPages, p + 1)))}
        </div>
      )}
    </div>
  )
}
