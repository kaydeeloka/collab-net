import { useEffect, useRef, useState } from 'react'
import { gasGet, gasPost } from '../../lib/api'
import { escHtml } from '../../lib/utils'
import Spinner from '../../components/Spinner'

interface ArchiveItem {
  dateKey: string
  date?: string
  savedAt?: string
}

interface ArchiveGroup {
  label: string
  items: ArchiveItem[]
}

interface CategoryItem {
  title: string
  link?: string
  source?: string
  summary: string
}

interface Category {
  emoji: string
  name: string
  count?: number
  items: CategoryItem[]
}

interface ReportData {
  ok: boolean
  reportTitle?: string
  date?: string
  categories?: Category[]
  keywords?: string
  fromArchive?: boolean
  error?: string
}

interface TrendDraft {
  date: string
  subject: string
  body: string
}

type Panel = 'briefing' | 'trends'

export default function Trends() {
  const [panel, setPanel] = useState<Panel>('briefing')

  // Beauty News state
  const [bnStatus, setBnStatus] = useState('')
  const [bnStatusColor, setBnStatusColor] = useState('')
  const [bnRunning, setBnRunning] = useState(false)
  const [bnLive, setBnLive] = useState(false)
  const [bnReport, setBnReport] = useState<ReportData | null>(null)
  const [bnLoading, setBnLoading] = useState(false)
  const [recipients, setRecipients] = useState<string[]>([])
  const [selectedRcpt, setSelectedRcpt] = useState<Set<string>>(new Set())
  const [emailStatus, setEmailStatus] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [archiveGroups, setArchiveGroups] = useState<Record<string, ArchiveGroup>>({})
  const [archiveOrder, setArchiveOrder] = useState<string[]>([])
  const [archiveLoading, setArchiveLoading] = useState(true)
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set())

  // TikTok Trends state
  const [trendDrafts, setTrendDrafts] = useState<TrendDraft[]>([])
  const [trendSelected, setTrendSelected] = useState(0)
  const [trendLoading, setTrendLoading] = useState(true)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    loadRecipients()
    refreshArchiveList()
    loadTrends()
  }, [])

  useEffect(() => {
    if (trendDrafts.length > 0 && iframeRef.current) {
      const doc = iframeRef.current.contentDocument
      if (doc) {
        doc.open()
        doc.write(trendDrafts[trendSelected]?.body || '')
        doc.close()
      }
    }
  }, [trendSelected, trendDrafts])

  async function loadRecipients() {
    try {
      const data: string[] | { emails?: string[]; recipients?: string[] } = await gasGet('getRecipients')
      const emails = Array.isArray(data) ? data : (data.emails || data.recipients || [])
      setRecipients(emails)
      setSelectedRcpt(new Set(emails))
    } catch {}
  }

  async function refreshArchiveList() {
    setArchiveLoading(true)
    try {
      const data: { ok: boolean; archives?: ArchiveItem[]; error?: string } = await gasGet('getArchiveList')
      if (!data.ok) throw new Error(data.error)
      const groups: Record<string, ArchiveGroup> = {}
      const order: string[] = []
      ;(data.archives || []).forEach(a => {
        const d = new Date(a.savedAt || a.dateKey.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'))
        const mk = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
        const ml = d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월'
        if (!groups[mk]) { groups[mk] = { label: ml, items: [] }; order.push(mk) }
        groups[mk].items.push(a)
      })
      setArchiveGroups(groups)
      setArchiveOrder(order)
      if (order.length > 0) setOpenMonths(new Set([order[0]]))
    } catch {}
    setArchiveLoading(false)
  }

  async function loadArchive(dateKey: string) {
    setBnLoading(true)
    setBnStatus('')
    try {
      const data: ReportData = await gasGet('getArchive', { dateKey })
      if (!data.ok) throw new Error(data.error || '불러오기 실패')
      setBnReport(data)
      setBnStatus('📁 아카이브 · ' + (data.date || dateKey))
      setBnStatusColor('var(--gray-6)')
    } catch (e: unknown) {
      setBnStatus('아카이브 오류')
      setBnStatusColor('#c00')
    }
    setBnLoading(false)
  }

  async function deleteArchive(dateKey: string) {
    if (!confirm('이 아카이브를 삭제하시겠습니까?')) return
    try {
      await gasPost({ action: 'deleteArchive', dateKey })
      await refreshArchiveList()
    } catch (e: unknown) {
      alert('삭제 실패: ' + (e as Error).message)
    }
  }

  async function startAnalysis() {
    setBnRunning(true)
    setBnLive(true)
    setBnStatus('RSS 수집 및 AI 분석 중... (약 30~60초 소요)')
    setBnStatusColor('')
    setBnLoading(true)
    setBnReport(null)
    try {
      const data: ReportData = await gasGet('runAnalysis')
      if (!data.ok) throw new Error(data.error || '분석 실패')
      setBnReport(data)
      setBnStatus('분석 완료 · ' + data.date)
      setBnStatusColor('var(--green)')
      refreshArchiveList()
    } catch (e: unknown) {
      setBnStatus('오류 발생')
      setBnStatusColor('#c00')
      setBnLive(false)
    }
    setBnRunning(false)
    setBnLoading(false)
  }

  async function sendNewsEmail() {
    if (!bnReport) { alert('먼저 분석을 실행하세요.'); return }
    const rcpts = [...selectedRcpt].filter(Boolean)
    if (!rcpts.length) { alert('수신자를 선택하세요.'); return }
    setEmailSending(true)
    setEmailStatus('')
    try {
      const subject = '[MiMuse] 주간 뷰티 뉴스 · ' + bnReport.date
      const htmlBody = buildEmailHtml(bnReport)
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
      const data: { drafts?: TrendDraft[]; error?: string } = await gasGet('getAllTrendDrafts')
      setTrendDrafts(data.drafts || [])
    } catch {}
    setTrendLoading(false)
  }

  function buildEmailHtml(data: ReportData): string {
    const title = data.reportTitle || ('이번 주 뷰티 브리핑 — ' + data.date)
    let h = `<html><body style="font-family:sans-serif;max-width:680px;margin:0 auto;padding:24px;color:#222">`
    h += `<h1 style="font-size:20px;border-bottom:2px solid #f5c518;padding-bottom:8px">🌟 MiMuse ${title}</h1>`
    for (const cat of (data.categories || [])) {
      const count = cat.count != null ? cat.count : cat.items.length
      h += `<h2 style="font-size:16px;margin-top:28px">${cat.emoji} ${cat.name}</h2>`
      h += `<p style="font-size:12px;color:#888;margin-bottom:10px">이번 주 트렌드 시그널이 감지된 뉴스는 총 <strong style="color:#1a73e8">${count}</strong>건입니다.</p>`
      for (const item of cat.items) {
        h += `<div style="background:#f9f9f9;border-left:3px solid #f5c518;padding:12px;margin-bottom:12px;border-radius:4px">`
        h += `<div style="font-weight:600;font-size:14px">${item.title}</div>`
        if (item.source) h += `<div style="font-size:11px;color:#888;margin-bottom:6px">${item.source}</div>`
        h += `<div style="font-size:13px;line-height:1.6">${item.summary}</div>`
        if (item.link) h += `<a href="${item.link}" style="font-size:11px;color:#1a73e8" target="_blank">원문 보기</a>`
        h += `</div>`
      }
    }
    if (data.keywords) {
      h += `<div style="background:#fff3cd;border-radius:6px;padding:16px;margin-top:24px">`
      h += `<h3 style="margin-top:0;font-size:15px">트렌드 키워드</h3>`
      h += `<div style="font-size:13px;line-height:1.8">${data.keywords.replace(/\n/g, '<br>')}</div>`
      h += `</div>`
    }
    h += `</body></html>`
    return h
  }

  return (
    <div className="page">
      <div className="page-banner">
        <span className="page-banner-deco">📊</span>
        <div>
          <div className="page-banner-title">트렌드 분석</div>
          <div className="page-banner-desc">뷰티 뉴스 AI 분석 및 틱톡 트렌드 리포트를 확인하세요.</div>
        </div>
      </div>

      <div className="ftab-bar">
        <button className={'ftab' + (panel === 'briefing' ? ' active' : '')} onClick={() => setPanel('briefing')}>뷰티 뉴스</button>
        <button className={'ftab' + (panel === 'trends' ? ' active' : '')} onClick={() => setPanel('trends')}>틱톡 트렌드</button>
      </div>

      <div className="ftab-content">

        {/* Beauty News Panel */}
        {panel === 'briefing' && (
          <div>
            <div className="bn-engine-card">
              <div className="bn-engine-left">
                <span className="bn-engine-icon">◆</span>
                <div>
                  <div className="bn-engine-title">뷰티 뉴스 AI 분석 엔진</div>
                  <div className="bn-engine-desc">Google News RSS + Groq AI · 최근 7일 미국 뷰티 트렌드</div>
                </div>
              </div>
              <div className="bn-engine-right">
                <span className="bn-status" style={{ color: bnStatusColor }}>{bnStatus}</span>
                {bnLive && <span className="bn-live-badge visible">LIVE ANALYSIS</span>}
                <button className="bn-run-btn" onClick={startAnalysis} disabled={bnRunning}>
                  {bnRunning ? '분석 중...' : '분석 시작'}
                </button>
              </div>
            </div>

            <div className="bn-columns">
              <div className="bn-report-card">
                <div className="bn-report-header">
                  <span className="bn-report-title">AI 뉴스 요약 리포트</span>
                </div>
                <div className="bn-report-body">
                  {bnLoading && (
                    <div className="bn-loading">
                      <Spinner />
                      <span>뷰티 뉴스를 분석하고 있습니다...</span>
                    </div>
                  )}
                  {!bnLoading && !bnReport && (
                    <div className="bn-empty-cats">
                      {['스킨케어', '메이크업', '퍼스널케어', 'K-뷰티', '기타'].map(cat => (
                        <div key={cat} style={{ marginBottom: 16 }}>
                          <div className="bn-ph-cat-title">{cat}</div>
                          <div className="bn-ph-cat-body">아직 분석 결과가 없습니다.</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {!bnLoading && bnReport && <ReportBody data={bnReport} />}
                </div>
              </div>

              <div className="bn-sidebar">
                <div className="bn-email-panel">
                  <div className="bn-email-header">
                    <span className="bn-email-icon">@</span>
                    <span className="bn-email-title">이메일 발송</span>
                  </div>
                  <div className="bn-recipients">
                    {recipients.length === 0 && <div className="bn-email-none">수신자 없음</div>}
                    {recipients.map(email => (
                      <label key={email} className="bn-rcpt-label">
                        <input
                          type="checkbox"
                          checked={selectedRcpt.has(email)}
                          onChange={e => {
                            const next = new Set(selectedRcpt)
                            e.target.checked ? next.add(email) : next.delete(email)
                            setSelectedRcpt(next)
                          }}
                        /> {email}
                      </label>
                    ))}
                  </div>
                  <div className="bn-email-status" style={{ color: emailStatus.startsWith('완료') ? '#4caf50' : emailStatus.startsWith('오류') ? '#f44336' : undefined }}>
                    {emailStatus}
                  </div>
                  <button className="bn-send-btn" onClick={sendNewsEmail} disabled={emailSending}>
                    {emailSending ? '발송 중...' : '지금 즉시 전체 발송'}
                  </button>
                </div>

                <div className="bn-archive-panel">
                  <div className="bn-archive-header">
                    <span className="bn-archive-title">📁 주간 아카이브</span>
                    <span className="bn-archive-hint">최대 12주</span>
                  </div>
                  <div className="bn-archive-list">
                    {archiveLoading && (
                      <div className="bn-archive-loading"><Spinner sm /> 불러오는 중...</div>
                    )}
                    {!archiveLoading && archiveOrder.length === 0 && (
                      <div className="bn-archive-empty">저장된 아카이브가 없습니다.<br />분석을 실행하면 자동으로 저장됩니다.</div>
                    )}
                    {archiveOrder.map(mk => {
                      const g = archiveGroups[mk]
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
                          {open && (
                            <div className="bn-arch-items" style={{ display: 'flex', flexDirection: 'column' }}>
                              {g.items.map(a => {
                                const savedLabel = a.savedAt
                                  ? new Date(a.savedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                  : ''
                                return (
                                  <div key={a.dateKey} className="bn-archive-item" onClick={() => loadArchive(a.dateKey)}>
                                    <div className="bn-archive-item-date">{a.date || a.dateKey}</div>
                                    {savedLabel && <div className="bn-archive-item-saved">{savedLabel}</div>}
                                    <button className="bn-archive-del" onClick={e => { e.stopPropagation(); deleteArchive(a.dateKey) }}>×</button>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TikTok Trends Panel */}
        {panel === 'trends' && (
          <div className="archive-layout">
            <div className="archive-sidebar">
              {trendLoading && <div className="loader"><Spinner /></div>}
              {!trendLoading && trendDrafts.length === 0 && (
                <div className="empty" style={{ padding: 24 }}>
                  트렌드 리포트 없음<br />
                  <small style={{ fontSize: 11, color: 'var(--gray-5)' }}>
                    Outlook 초안에 제목에 '트렌드' 또는 'trend'를 포함한 초안을 작성하면 자동 표시됩니다
                  </small>
                </div>
              )}
              {!trendLoading && trendDrafts.length > 0 && (
                <>
                  <div className="archive-sidebar-hdr">
                    리포트 <span className="archive-count">{trendDrafts.length}</span>
                  </div>
                  {trendDrafts.map((d, i) => (
                    <div
                      key={i}
                      className={'archive-item' + (trendSelected === i ? ' active' : '')}
                      onClick={() => setTrendSelected(i)}
                    >
                      <div className="archive-item-date">{d.date}</div>
                      <div className="archive-item-label">{d.subject}</div>
                    </div>
                  ))}
                </>
              )}
            </div>
            <div className="archive-content-wrap">
              {trendDrafts.length === 0
                ? <div className="archive-placeholder">← 날짜를 선택하세요</div>
                : <iframe
                    ref={iframeRef}
                    style={{ width: '100%', height: '100%', minHeight: 500, border: 'none' }}
                    sandbox="allow-same-origin"
                  />
              }
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ReportBody({ data }: { data: ReportData }) {
  const title = data.reportTitle || ('이번 주 뷰티 브리핑 — ' + data.date)
  return (
    <div>
      <div className="bn-briefing-title">
        {escHtml(title)}
        {data.fromArchive && (
          <span className="bn-cache-badge" style={{ background: '#e8f5e9', color: '#2e7d32' }}>📁 아카이브</span>
        )}
      </div>
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
                  {item.source && <span className="bn-source">{item.source}</span>}
                </div>
                <div className="bn-article-summary">{item.summary}</div>
              </div>
            ))}
          </div>
        )
      })}
      {data.keywords && (
        <div className="bn-keywords-section">
          <div className="bn-keywords-title">트렌드 키워드</div>
          <div className="bn-keywords-body" dangerouslySetInnerHTML={{ __html: data.keywords.replace(/\n/g, '<br>') }} />
        </div>
      )}
    </div>
  )
}
