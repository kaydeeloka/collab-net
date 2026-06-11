import { useEffect, useRef, useState } from 'react'
import { gasPost } from '../../../lib/api'
import { supabase } from '../../../lib/supabase'
import Spinner from '../../../components/Spinner'

interface ArchiveItem {
  id: string
  windows_start: string
  windows_end?: string
  report_title?: string
  created_at: string
}

interface ArchiveGroup {
  label: string
  items: ArchiveItem[]
}

interface CategoryItem {
  title: string
  link?: string
  source?: string
  pubDate?: string
  summary: string
}

interface Category {
  emoji: string
  name: string
  count?: number
  items: CategoryItem[]
}

interface Keyword {
  tag: string
  explanation: string
}

interface ReportData {
  ok: boolean
  reportTitle?: string
  windowsStart?: string
  windowsEnd?: string
  categories?: Category[]
  keywords?: Keyword[]
  fromArchive?: boolean
  error?: string
}

interface Recipient {
  email: string
  name?: string
}

interface TrendDraft {
  date: string
  subject: string
  body: string
}

function fmtKor(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return (d.getMonth() + 1) + '월 ' + d.getDate() + '일'
}

function fmtKorFull(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일'
}

export default function Trends() {
  const [activeTab, setActiveTab] = useState<'news' | 'archive'>('news')

  const [latestReport, setLatestReport] = useState<ReportData | null>(null)
  const [latestLoading, setLatestLoading] = useState(true)

  const [archiveReport, setArchiveReport] = useState<ReportData | null>(null)
  const [archiveReportLoading, setArchiveReportLoading] = useState(false)
  const [selectedKey, setSelectedKey] = useState('')

  const [archiveGroups, setArchiveGroups] = useState<Record<string, ArchiveGroup>>({})
  const [archiveOrder, setArchiveOrder] = useState<string[]>([])
  const [archiveListLoading, setArchiveListLoading] = useState(true)
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set())

  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [selectedRcpt, setSelectedRcpt] = useState<Set<string>>(new Set())
  const [emailStatus, setEmailStatus] = useState('')
  const [emailSending, setEmailSending] = useState(false)

  // Recipient management
  const [editingEmail, setEditingEmail] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [addName, setAddName] = useState('')
  const [addEmail, setAddEmail] = useState('')
  const [rcptSaving, setRcptSaving] = useState(false)

  const [trendDrafts, setTrendDrafts] = useState<TrendDraft[]>([])
  const [trendSelected, setTrendSelected] = useState(0)
  const [trendLoading, setTrendLoading] = useState(true)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    loadRecipients()
    loadLatestReport()
    refreshArchiveList()
    loadTrends()
  }, [])

  useEffect(() => {
    if (trendDrafts.length > 0 && iframeRef.current) {
      const doc = iframeRef.current.contentDocument
      if (doc) { doc.open(); doc.write(trendDrafts[trendSelected]?.body || ''); doc.close() }
    }
  }, [trendSelected, trendDrafts])

  async function loadRecipients() {
    try {
      const { data } = await supabase
        .from('email_recipients')
        .select('email, name')
        .order('name')
      const list = (data || []) as Recipient[]
      setRecipients(list)
      setSelectedRcpt(new Set(list.map(r => r.email)))
    } catch {}
  }

  async function addRecipient() {
    const email = addEmail.trim().toLowerCase()
    const name  = addName.trim()
    if (!email) return
    setRcptSaving(true)
    const { error } = await supabase.from('email_recipients').insert({ email, name: name || null })
    if (!error) { setAddEmail(''); setAddName(''); setShowAddForm(false); await loadRecipients() }
    setRcptSaving(false)
  }

  function startEdit(r: Recipient) {
    setEditingEmail(r.email)
    setEditName(r.name || '')
    setEditEmail(r.email)
  }

  async function saveEdit(oldEmail: string) {
    const email = editEmail.trim().toLowerCase()
    const name  = editName.trim()
    if (!email) return
    setRcptSaving(true)
    const { error } = await supabase
      .from('email_recipients')
      .update({ email, name: name || null })
      .eq('email', oldEmail)
    if (!error) {
      setEditingEmail(null)
      setSelectedRcpt(prev => {
        const next = new Set(prev)
        if (next.has(oldEmail)) { next.delete(oldEmail); next.add(email) }
        return next
      })
      await loadRecipients()
    }
    setRcptSaving(false)
  }

  async function deleteRecipient(email: string) {
    if (!confirm(email + ' 을(를) 삭제하시겠습니까?')) return
    const { error } = await supabase.from('email_recipients').delete().eq('email', email)
    if (!error) {
      setSelectedRcpt(prev => { const next = new Set(prev); next.delete(email); return next })
      await loadRecipients()
    }
  }

  async function loadLatestReport() {
    setLatestLoading(true)
    try {
      const { data, error } = await supabase
        .from('beauty_news_archives')
        .select('id, windows_start, windows_end, report_title, categories, keywords')
        .order('windows_start', { ascending: false })
        .limit(1)
        .single()
      if (error || !data) throw new Error()
      setLatestReport({
        ok: true,
        reportTitle: data.report_title,
        windowsStart: data.windows_start,
        windowsEnd: data.windows_end,
        categories: data.categories,
        keywords: data.keywords,
      })
    } catch {}
    setLatestLoading(false)
  }

  async function refreshArchiveList() {
    setArchiveListLoading(true)
    try {
      const { data, error } = await supabase
        .from('beauty_news_archives')
        .select('id, windows_start, windows_end, report_title, created_at')
        .order('windows_start', { ascending: false })
      if (error) throw error
      const groups: Record<string, ArchiveGroup> = {}
      const order: string[] = []
      ;(data || []).forEach(a => {
        const d  = new Date(a.windows_start + 'T00:00:00')
        const mk = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
        const ml = d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월'
        if (!groups[mk]) { groups[mk] = { label: ml, items: [] }; order.push(mk) }
        groups[mk].items.push(a as ArchiveItem)
      })
      setArchiveGroups(groups)
      setArchiveOrder(order)
      if (order.length > 0) setOpenMonths(new Set([order[0]]))
    } catch {}
    setArchiveListLoading(false)
  }

  async function loadArchive(windowsStart: string) {
    setArchiveReportLoading(true)
    setSelectedKey(windowsStart)
    try {
      const { data, error } = await supabase
        .from('beauty_news_archives')
        .select('id, windows_start, windows_end, report_title, categories, keywords')
        .eq('windows_start', windowsStart)
        .single()
      if (error || !data) throw new Error(error?.message || '불러오기 실패')
      setArchiveReport({
        ok: true,
        reportTitle: data.report_title,
        windowsStart: data.windows_start,
        windowsEnd: data.windows_end,
        categories: data.categories,
        keywords: data.keywords,
        fromArchive: true,
      })
    } catch (e: unknown) {
      setArchiveReport({ ok: false, error: (e as Error).message || '오류' })
    }
    setArchiveReportLoading(false)
  }

  async function deleteArchive(windowsStart: string) {
    if (!confirm('이 아카이브를 삭제하시겠습니까?')) return
    try {
      const { error } = await supabase
        .from('beauty_news_archives')
        .delete()
        .eq('windows_start', windowsStart)
      if (error) throw error
      if (selectedKey === windowsStart) { setArchiveReport(null); setSelectedKey('') }
      await refreshArchiveList()
    } catch (e: unknown) {
      alert('삭제 실패: ' + (e as Error).message)
    }
  }

  async function sendNewsEmail(report: ReportData) {
    const rcpts = [...selectedRcpt].filter(Boolean)
    if (!rcpts.length) { alert('수신자를 선택하세요.'); return }
    setEmailSending(true)
    setEmailStatus('')
    try {
      const dateLabel = report.windowsEnd ? fmtKor(report.windowsEnd) : (report.windowsStart ? fmtKor(report.windowsStart) : '')
      const subject   = '[MiMuse] 주간 뷰티 뉴스 · ' + dateLabel
      const htmlBody  = buildEmailHtml(report)
      const result: { ok: boolean; sent?: number; error?: string } = await gasPost({ action: 'sendBeautyNewsEmail', recipients: rcpts, htmlBody, subject })
      if (!result.ok) throw new Error(result.error || '발송 실패')
      setEmailStatus('완료 — ' + result.sent + '명에게 발송 완료')
    } catch (e: unknown) {
      setEmailStatus('오류: ' + (e as Error).message)
    }
    setEmailSending(false)
  }

  async function loadTrends() {
    setTrendLoading(true)
    try {
      const data: { drafts?: TrendDraft[]; error?: string } = await (await import('../../../lib/api')).gasGet('getAllTrendDrafts')
      setTrendDrafts(data.drafts || [])
    } catch {}
    setTrendLoading(false)
  }

  function buildEmailHtml(data: ReportData): string {
    const ws    = data.windowsStart ? fmtKorFull(data.windowsStart) : ''
    const we    = data.windowsEnd   ? fmtKorFull(data.windowsEnd)   : ''
    const range = ws + (we ? ' – ' + we : '')
    const title = data.reportTitle || ('이번 주 뷰티 브리핑 — ' + range)
    let h = `<html><body style="font-family:sans-serif;max-width:680px;margin:0 auto;padding:24px;color:#222">`
    h += `<h1 style="font-size:20px;border-bottom:2px solid #f5c518;padding-bottom:8px">🌟 MiMuse ${title}</h1>`
    if (range) h += `<p style="font-size:12px;color:#888;margin-top:4px">📅 ${range}</p>`
    for (const cat of (data.categories || [])) {
      const count = cat.count != null ? cat.count : cat.items.length
      h += `<h2 style="font-size:16px;margin-top:28px">${cat.emoji} ${cat.name}</h2>`
      h += `<p style="font-size:12px;color:#888;margin:4px 0 10px">이번 주 트렌드 시그널이 감지된 뉴스는 총 <strong style="color:#1a73e8">${count}</strong>건입니다.</p>`
      for (const item of cat.items) {
        h += `<div style="background:#f9f9f9;border-left:3px solid #f5c518;padding:12px;margin-bottom:12px;border-radius:4px">`
        h += `<div style="font-weight:600;font-size:14px">${item.link ? `<a href="${item.link}" style="color:#222;text-decoration:none">${item.title}</a>` : item.title}</div>`
        if (item.source) h += `<div style="font-size:11px;color:#888;margin-bottom:6px">${item.source}${item.pubDate ? ' · ' + item.pubDate : ''}</div>`
        h += `<div style="font-size:13px;line-height:1.6">${item.summary}</div>`
        if (item.link) h += `<a href="${item.link}" style="font-size:11px;color:#1a73e8" target="_blank">원문 보기</a>`
        h += `</div>`
      }
    }
    const keywords = data.keywords || []
    if (keywords.length) {
      h += `<div style="background:#fff3cd;border-radius:6px;padding:16px;margin-top:24px">`
      h += `<h3 style="margin-top:0;font-size:15px">✨ 이번 주 트렌드 키워드</h3>`
      for (const kw of keywords) {
        h += `<div style="margin-bottom:12px"><strong style="font-size:13px">${kw.tag}</strong><br>`
        h += `<span style="font-size:13px;line-height:1.6">${kw.explanation}</span></div>`
      }
      h += `</div>`
    }
    const dashUrl = 'https://mimuse-automation-dashboard.vercel.app/trend/news'
    h += `<div style="margin-top:40px;padding-top:20px;border-top:1px solid #e0e0e0;text-align:center">`
    h += `<a href="${dashUrl}" target="_blank" style="display:inline-block;background:#f5c518;color:#1a1a1a;font-weight:700;font-size:13px;padding:12px 28px;border-radius:8px;text-decoration:none">📊 대시보드 뷰티뉴스 바로가기</a>`
    h += `</div></body></html>`
    return h
  }

  const archiveListPanel = (
    <div className="bn-archive-panel" style={{ maxHeight: 'none' }}>
      <div className="bn-archive-header">
        <span className="bn-archive-title">📁 주간 아카이브</span>
        <span className="bn-archive-hint">최대 12주</span>
      </div>
      <div className="bn-archive-list" style={{ maxHeight: 'none', overflowY: 'visible' }}>
        {archiveListLoading && <div className="bn-archive-loading"><Spinner sm /> 불러오는 중...</div>}
        {!archiveListLoading && archiveOrder.length === 0 && (
          <div className="bn-archive-empty">저장된 아카이브가 없습니다.<br />Claude 루틴이 실행되면 자동으로 저장됩니다.</div>
        )}
        {archiveOrder.map(mk => {
          const g    = archiveGroups[mk]
          const open = openMonths.has(mk)
          return (
            <div key={mk} className="bn-arch-group">
              <button className="bn-arch-month" onClick={() => {
                const next = new Set(openMonths)
                open ? next.delete(mk) : next.add(mk)
                setOpenMonths(next)
              }}>
                <span className="bn-arch-month-label">{g.label}</span>
                <span className="bn-arch-month-count">{g.items.length}건</span>
                <span>{open ? '▾' : '▸'}</span>
              </button>
              {open && g.items.map(a => {
                const rangeLabel = a.windows_end
                  ? fmtKor(a.windows_start) + ' – ' + fmtKor(a.windows_end)
                  : fmtKor(a.windows_start)
                const isSelected = a.windows_start === selectedKey
                return (
                  <div key={a.windows_start} className="bn-archive-item"
                    style={isSelected ? { background: 'var(--yellow-lt)', borderLeft: '3px solid var(--teal)' } : undefined}
                    onClick={() => loadArchive(a.windows_start)}>
                    <div className="bn-archive-item-date">{rangeLabel}</div>
                    <button className="bn-archive-del" onClick={e => { e.stopPropagation(); deleteArchive(a.windows_start) }}>×</button>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )

  const emailPanel = (report: ReportData | null) => (
    <div className="bn-email-panel">
      <div className="bn-email-header">
        <span className="bn-email-icon">@</span>
        <span className="bn-email-title">이메일 발송</span>
        <button className="bn-rcpt-add-btn" onClick={() => { setShowAddForm(v => !v); setEditingEmail(null) }} title="수신자 추가">+</button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="bn-rcpt-form">
          <input className="bn-rcpt-input" placeholder="이름 (선택)" value={addName} onChange={e => setAddName(e.target.value)} />
          <input className="bn-rcpt-input" placeholder="이메일 *" type="email" value={addEmail} onChange={e => setAddEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addRecipient()} />
          <div className="bn-rcpt-form-btns">
            <button className="bn-rcpt-save" onClick={addRecipient} disabled={rcptSaving || !addEmail.trim()}>추가</button>
            <button className="bn-rcpt-cancel" onClick={() => { setShowAddForm(false); setAddEmail(''); setAddName('') }}>취소</button>
          </div>
        </div>
      )}

      {/* Recipient list */}
      <div className="bn-recipients">
        {recipients.length === 0 && !showAddForm && <div className="bn-email-none">수신자 없음 — + 버튼으로 추가하세요</div>}
        {recipients.map(r => (
          <div key={r.email}>
            {editingEmail === r.email ? (
              <div className="bn-rcpt-form" style={{ margin: '4px 0' }}>
                <input className="bn-rcpt-input" placeholder="이름 (선택)" value={editName} onChange={e => setEditName(e.target.value)} />
                <input className="bn-rcpt-input" placeholder="이메일 *" type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveEdit(r.email)} />
                <div className="bn-rcpt-form-btns">
                  <button className="bn-rcpt-save" onClick={() => saveEdit(r.email)} disabled={rcptSaving || !editEmail.trim()}>저장</button>
                  <button className="bn-rcpt-cancel" onClick={() => setEditingEmail(null)}>취소</button>
                </div>
              </div>
            ) : (
              <div className="bn-rcpt-row">
                <label className="bn-rcpt-label" style={{ flex: 1, minWidth: 0 }}>
                  <input type="checkbox" checked={selectedRcpt.has(r.email)}
                    onChange={e => {
                      const next = new Set(selectedRcpt)
                      e.target.checked ? next.add(r.email) : next.delete(r.email)
                      setSelectedRcpt(next)
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    {r.name && <div className="bn-rcpt-name">{r.name}</div>}
                    <div className="bn-rcpt-email">{r.email}</div>
                  </div>
                </label>
                <div className="bn-rcpt-actions">
                  <button className="bn-rcpt-edit-btn" onClick={() => startEdit(r)} title="수정">✎</button>
                  <button className="bn-archive-del" onClick={() => deleteRecipient(r.email)} title="삭제">×</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bn-email-status" style={{ color: emailStatus.startsWith('완료') ? '#4caf50' : emailStatus.startsWith('오류') ? '#f44336' : undefined }}>
        {emailStatus}
      </div>
      <button className="bn-send-btn" onClick={() => report && sendNewsEmail(report)} disabled={emailSending || !report}>
        {emailSending ? '발송 중...' : '지금 즉시 전체 발송'}
      </button>
    </div>
  )

  return (
    <div className="page">
      <div className="page-banner">
        <span className="page-banner-deco">📊</span>
        <div>
          <div className="page-banner-title">트렌드 분석</div>
          <div className="page-banner-desc">뷰티 뉴스 AI 분석 및 틱톡 트렌드 리포트를 확인하세요.</div>
        </div>
      </div>

      <div className="bn-tab-bar">
        <button className={`bn-tab-btn${activeTab === 'news' ? ' active' : ''}`} onClick={() => setActiveTab('news')}>이번 주 뉴스</button>
        <button className={`bn-tab-btn${activeTab === 'archive' ? ' active' : ''}`} onClick={() => setActiveTab('archive')}>아카이브</button>
      </div>

      {activeTab === 'news' && (
        <div>
          {/* Engine + refresh bar */}
          <div className="bn-engine-card">
            <div className="bn-engine-left">
              <span className="bn-engine-icon">◆</span>
              <div>
                <div className="bn-engine-title">이번 주 뷰티 브리핑</div>
                <div className="bn-engine-desc">Claude 루틴이 실행되면 자동으로 업데이트됩니다</div>
              </div>
            </div>
            <div className="bn-engine-right">
              {latestReport?.windowsEnd && (
                <span className="bn-status" style={{ color: 'rgba(248,246,246,.7)' }}>최신 · {fmtKor(latestReport.windowsEnd)}</span>
              )}
              <button className="bn-run-btn" onClick={() => { loadLatestReport(); refreshArchiveList() }}>새로고침</button>
            </div>
          </div>

          {/* Email panel — full width above report */}
          {emailPanel(latestReport)}

          {/* Full-width report */}
          <div className="bn-report-card">
            <div className="bn-report-header">
              <span className="bn-report-title">AI 뉴스 요약 리포트</span>
            </div>
            <div className="bn-report-body">
              {latestLoading && <div className="bn-loading"><Spinner /><span>리포트를 불러오는 중...</span></div>}
              {!latestLoading && !latestReport && (
                <div className="bn-empty-cats">
                  {['스킨케어', '메이크업', '퍼스널케어', 'K-뷰티', '기타'].map(cat => (
                    <div key={cat} style={{ marginBottom: 16 }}>
                      <div className="bn-ph-cat-title">{cat}</div>
                      <div className="bn-ph-cat-body">아직 분석 결과가 없습니다.</div>
                    </div>
                  ))}
                </div>
              )}
              {!latestLoading && latestReport && <ReportBody data={latestReport} />}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'archive' && (
        <div>
          {/* Horizontal archive nav */}
          <div className="bn-arch-nav-bar">
            <span className="bn-arch-nav-label">📁 아카이브</span>
            {archiveListLoading && <Spinner sm />}
            <div className="bn-arch-nav-pills">
              {archiveOrder.flatMap(mk => archiveGroups[mk].items).map(a => {
                const label = a.windows_end
                  ? fmtKor(a.windows_start) + ' – ' + fmtKor(a.windows_end)
                  : fmtKor(a.windows_start)
                return (
                  <button key={a.windows_start}
                    className={`bn-arch-nav-pill${a.windows_start === selectedKey ? ' active' : ''}`}
                    onClick={() => loadArchive(a.windows_start)}>
                    {label}
                    <span className="bn-arch-nav-del" onClick={e => { e.stopPropagation(); deleteArchive(a.windows_start) }}>×</span>
                  </button>
                )
              })}
              {!archiveListLoading && archiveOrder.length === 0 && (
                <span style={{ fontSize: 13, color: 'var(--teal-dk)', fontStyle: 'italic' }}>저장된 아카이브가 없습니다</span>
              )}
            </div>
          </div>

          {/* Full-width archive report */}
          <div className="bn-report-card">
            <div className="bn-report-header">
              <span className="bn-report-title">{archiveReport?.reportTitle || '아카이브 리포트'}</span>
              {archiveReport?.ok && (
                <button style={{ fontSize: 13, padding: '5px 14px', borderRadius: 6, border: '1px solid var(--surface-md)', background: 'var(--surface)', cursor: 'pointer', color: 'var(--ink)', fontWeight: 600 }}
                  onClick={() => sendNewsEmail(archiveReport!)} disabled={emailSending}>
                  {emailSending ? '발송 중...' : '이메일 발송'}
                </button>
              )}
            </div>
            <div className="bn-report-body">
              {archiveReportLoading && <div className="bn-loading"><Spinner /><span>불러오는 중...</span></div>}
              {!archiveReportLoading && !archiveReport && (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--teal-dk)', fontSize: 14 }}>
                  위 목록에서 주차를 선택하세요.
                </div>
              )}
              {!archiveReportLoading && archiveReport && (
                archiveReport.ok === false
                  ? <div style={{ color: '#c00', padding: 16 }}>{archiveReport.error}</div>
                  : <ReportBody data={archiveReport} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ReportBody({ data }: { data: ReportData }) {
  const ws    = data.windowsStart ? fmtKorFull(data.windowsStart) : ''
  const we    = data.windowsEnd   ? fmtKorFull(data.windowsEnd)   : ''
  const range = ws + (we ? ' – ' + we : '')
  const title = data.reportTitle || ('이번 주 뷰티 브리핑 — ' + range)
  const keywords = data.keywords || []

  return (
    <div>
      <div className="bn-briefing-title">
        {title}
        {data.fromArchive && <span className="bn-cache-badge" style={{ background: '#e8f5e9', color: '#2e7d32' }}>📁 아카이브</span>}
      </div>
      {range && <div style={{ fontSize: 12, color: 'var(--teal-dk)', marginBottom: 16 }}>📅 {range}</div>}
      {(data.categories || []).map((cat, ci) => {
        const count = cat.count != null ? cat.count : cat.items.length
        return (
          <div key={ci} className="bn-cat">
            <div className="bn-cat-title">{cat.emoji} {cat.name}</div>
            <div className="bn-cat-count">
              이번 주 트렌드 시그널이 감지된 뉴스는 총 <span className="bn-cat-count-num">{count}</span>건입니다.
            </div>
            {cat.items.map((item, ii) => (
              <div key={ii} className="bn-article">
                <div className="bn-article-header">
                  {item.link
                    ? <a className="bn-article-link" href={item.link} target="_blank" rel="noopener">{item.title}</a>
                    : <span className="bn-article-link">{item.title}</span>
                  }
                  {item.source && <span className="bn-source">{item.source}{item.pubDate ? ' · ' + item.pubDate : ''}</span>}
                </div>
                <div className="bn-article-summary">{item.summary}</div>
              </div>
            ))}
          </div>
        )
      })}
      {keywords.length > 0 && (
        <div className="bn-keywords-section">
          <div className="bn-keywords-title">트렌드 키워드</div>
          {keywords.map((kw, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{kw.tag}</div>
              <div className="bn-keywords-body">{kw.explanation}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
