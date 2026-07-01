import { useState } from 'react'
import { Eye, Heart, MessageCircle } from 'lucide-react'
import { fmtNum } from '@/lib/utils'
import { resolveMonitoringThumbnailUrl } from '@/lib/influencer/monitoring-storage'
import type { MonitoringRow } from '@/lib/influencer/monitoring-data'
import type { ReportPage, PageContent, ProcessStep } from '../report-builder/types'
import './report-slides.css'

// ── Background paths ──────────────────────────────────────────────
const BG = {
  title:   '/report/title-bg.jpg',
  content: '/report/content-bg.jpg',
  outro:   '/report/conclusion-bg.jpg',
}

function bgFor(type: string) {
  if (type === 'cover') return BG.title
  if (type === 'outro') return BG.outro
  return BG.content
}

// ── Editable text element ─────────────────────────────────────────

function ET({
  value, onChange, onBlur, placeholder, className, multiline, rows = 4,
}: {
  value: string
  onChange: (v: string) => void
  onBlur: () => void
  placeholder?: string
  className?: string
  multiline?: boolean
  rows?: number
}) {
  if (multiline) {
    return (
      <textarea
        className={`rslide-edit ${className ?? ''}`}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        rows={rows}
      />
    )
  }
  return (
    <input
      className={`rslide-edit ${className ?? ''}`}
      value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
    />
  )
}

// ── Helpers ───────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return fmtNum(n)
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

interface BrandStat { brand: string; count: number; views: number; likes: number; comments: number }
function computeBrandStats(rows: MonitoringRow[]): BrandStat[] {
  const m: Record<string, BrandStat> = {}
  rows.filter(r => r.review_link?.startsWith('http')).forEach(r => {
    const b = r.brand || '기타'
    if (!m[b]) m[b] = { brand: b, count: 0, views: 0, likes: 0, comments: 0 }
    m[b].count++; m[b].views += r.views; m[b].likes += r.likes; m[b].comments += r.comments
  })
  return Object.values(m).sort((a, b) => b.views - a.views)
}

// ── Section pill ─────────────────────────────────────────────────

function SectionPill({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`rslide__section-pill${className ? ` ${className}` : ''}`}>{children}</div>
}

// ── Content header (English + Korean title) ───────────────────────

function ContentHeader({
  content, editMode, onChange, onBlur,
}: {
  content: PageContent
  editMode: boolean
  onChange: (c: PageContent) => void
  onBlur: () => void
}) {
  return (
    <div className="rslide__header">
      {editMode ? (
        <ET
          value={content.engTitle ?? ''}
          onChange={v => onChange({ ...content, engTitle: v })}
          onBlur={onBlur}
          placeholder="English title..."
          className="rslide__eng-edit"
        />
      ) : (
        <div className="rslide__eng">{content.engTitle}</div>
      )}
      {editMode ? (
        <ET
          value={content.korTitle ?? ''}
          onChange={v => onChange({ ...content, korTitle: v })}
          onBlur={onBlur}
          placeholder="한국어 제목..."
          className="rslide__kor-edit"
        />
      ) : (
        <div className="rslide__kor">{content.korTitle}</div>
      )}
    </div>
  )
}

// ── Individual slide ──────────────────────────────────────────────

function Slide({
  page, editMode, rows, onUpdate,
}: {
  page: ReportPage
  editMode: boolean
  rows: MonitoringRow[]
  onUpdate: (content: PageContent) => void
}) {
  const [local, setLocal] = useState<PageContent>(page.content)

  // Keep local in sync when page content changes from outside
  const currentJson = JSON.stringify(page.content)
  const [lastJson, setLastJson] = useState(currentJson)
  if (currentJson !== lastJson) {
    setLocal(page.content)
    setLastJson(currentJson)
  }

  function commit() {
    onUpdate(local)
  }

  // ── Outro: just background, no content ──────────────────────────
  if (page.type === 'outro') {
    return (
      <div
        className="rslide"
        style={{ backgroundImage: `url(${BG.outro})` }}
      />
    )
  }

  const reviewRows = rows.filter(r => r.review_link?.startsWith('http'))

  return (
    <div className="rslide" style={{ backgroundImage: `url(${bgFor(page.type)})` }}>

      {/* ── Cover ── */}
      {page.type === 'cover' && (
        <div className="rslide__cover-layer">
          {editMode ? (
            <ET value={local.title ?? ''} onChange={v => setLocal(p => ({ ...p, title: v }))} onBlur={commit} placeholder="2026 Q1 시딩 프로젝트 결과 리포트" className="rslide__cover-title-edit" multiline rows={2} />
          ) : (
            local.title && <div className="rslide__cover-title">{local.title}</div>
          )}
        </div>
      )}

      {/* ── Content pages (common header) ── */}
      {page.type !== 'cover' && (
        <div className="rslide__content-layer">
          <ContentHeader content={local} editMode={editMode} onChange={c => setLocal(c)} onBlur={commit} />

          {/* Content performance */}
          {page.type === 'content_performance' && (() => {
            const DEFAULT_RECOVERY = '인플루언서||80\n매거진||100\n콘텐츠 수량||98'
            const DEFAULT_CTYPES = '숏폼 중심\n전체 콘텐츠의 대다수가 TikTok 숏폼으로 생성\n\n댓글 반응 활발\n키트 패키징·구성에 대한 자발적 질문 및 공유 다수\n\n키트 언박싱 포맷\n개봉 과정을 담은 리뷰가 주요 콘텐츠 유형으로 확인'

            const recoveryCards = (local.cpRecoveryCards ?? DEFAULT_RECOVERY).split('\n').map(line => {
              const parts = line.split('|')
              return { label: parts[0] ?? '', desc: parts[1] ?? '', pct: parseInt(parts[2] ?? '0') || 0 }
            })

            // Auto-compute influencer upload rate from monitoring rows
            const infMap = new Map<string, boolean>()
            const infUploadMap = new Map<string, boolean>()
            for (const r of rows) {
              const key = (r as any).confirmed_influencer_id || (r as any).influencer_platform_id || r.id
              infMap.set(key, true)
              if (r.review_link?.startsWith('http')) infUploadMap.set(key, true)
            }
            const totalInf = infMap.size
            const uploadedInf = infUploadMap.size
            const infPct = totalInf ? Math.round(uploadedInf / totalInf * 100) : 0
            const contentTypeItems = (local.cpContentTypes ?? DEFAULT_CTYPES).split('\n\n').map(block => {
              const lines = block.trim().split('\n')
              return { title: lines[0] ?? '', desc: lines.slice(1).join('\n') }
            })

            const total = reviewRows.length
            const channelSegs = [
              { label: 'TikTok',    count: reviewRows.filter(r => /tiktok/i.test(r.platform ?? '')).length, color: '#648085' },
              { label: 'Instagram', count: reviewRows.filter(r => /insta/i.test(r.platform ?? '')).length,  color: '#8BAAB8' },
              { label: 'magazine',  count: reviewRows.filter(r => /magazine/i.test(r.platform ?? '')).length, color: '#BED6DE' },
            ].map(s => ({ ...s, pct: total ? Math.round(s.count / total * 100) : 0 }))
              .filter(s => s.count > 0)

            const R = 35; const C = 2 * Math.PI * R
            let cum = 0
            const donutPaths = channelSegs.map(s => {
              const offset = -cum * C / 100
              cum += s.pct
              return { ...s, dasharray: `${s.pct * C / 100} ${C}`, dashoffset: offset }
            })

            return (
              <div className="rslide__cp">
                <SectionPill>회수율</SectionPill>
                <div className="rslide__cp-recovery">
                  {recoveryCards.map((card, i) => {
                    const isInfluencer = i === 0
                    const isContent    = i === 2
                    const barPct = isInfluencer ? infPct : card.pct
                    return (
                      <div key={i} className="rslide__cp-card">
                        <div className="rslide__cp-card-header">
                          <div className="rslide__cp-card-label">{card.label}</div>
                          {isContent && reviewRows.length > 0 && (
                            <div className="rslide__cp-card-total">총 {reviewRows.length}건</div>
                          )}
                        </div>
                        {editMode ? (
                          <>
                            <ET
                              value={card.desc}
                              onChange={v => {
                                const updated = recoveryCards.map((c, j) => j === i ? { ...c, desc: v } : c)
                                setLocal(p => ({ ...p, cpRecoveryCards: updated.map(c => `${c.label}|${c.desc}|${c.pct}`).join('\n') }))
                              }}
                              onBlur={commit}
                              placeholder="설명 입력"
                              className="rslide__cp-card-desc-edit"
                            />
                            {!isInfluencer && (
                              <ET
                                value={String(card.pct)}
                                onChange={v => {
                                  const updated = recoveryCards.map((c, j) => j === i ? { ...c, pct: parseInt(v) || 0 } : c)
                                  setLocal(p => ({ ...p, cpRecoveryCards: updated.map(c => `${c.label}|${c.desc}|${c.pct}`).join('\n') }))
                                }}
                                onBlur={commit}
                                placeholder="진행률 (0-100)"
                                className="rslide__cp-card-pct-edit"
                              />
                            )}
                          </>
                        ) : (
                          <>
                            <div className="rslide__cp-card-desc">
                              {card.desc.split('\n').map((line, li) => (
                                <div key={li}>
                                  {line.split(/(\d+%)/g).map((part, pi) =>
                                    /^\d+%$/.test(part)
                                      ? <span key={pi} className="rslide__cp-card-pct">{part}</span>
                                      : part
                                  )}
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                        <div className="rslide__cp-progress">
                          <div className="rslide__cp-progress-bar" style={{ width: `${barPct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="rslide__cp-bottom" style={{ marginTop: 16 }}>
                  <div className="rslide__cp-panel">
                    <SectionPill>콘텐츠 업로드 채널</SectionPill>
                    <div className="rslide__cp-donut-wrap">
                      <svg viewBox="0 0 100 100" className="rslide__cp-donut">
                        {donutPaths.map((seg, i) => (
                          <circle key={i} cx={50} cy={50} r={R} fill="none"
                            stroke={seg.color} strokeWidth={18}
                            strokeDasharray={seg.dasharray}
                            strokeDashoffset={seg.dashoffset}
                            transform="rotate(-90 50 50)"
                          />
                        ))}
                      </svg>
                      <div className="rslide__cp-legend">
                        {channelSegs.map((seg, i) => (
                          <div key={i} className="rslide__cp-legend-item">
                            <span className="rslide__cp-legend-dot" style={{ background: seg.color }} />
                            <span className="rslide__cp-legend-label">{seg.label}</span>
                            <span className="rslide__cp-legend-pct">{seg.pct}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rslide__cp-panel">
                    <SectionPill>콘텐츠 유형</SectionPill>
                    {editMode ? (
                      <ET
                        value={(local.cpContentTypes ?? DEFAULT_CTYPES)
                          .split('\n\n')
                          .map(block => {
                            const lines = block.trim().split('\n')
                            return [`■ ${lines[0].replace(/^■\s?/, '')}`, ...lines.slice(1)].join('\n')
                          })
                          .join('\n\n')}
                        onChange={v => {
                          const cleaned = v.split('\n\n').map(block => {
                            const lines = block.split('\n')
                            return [lines[0].replace(/^■\s?/, ''), ...lines.slice(1)].join('\n')
                          }).join('\n\n')
                          setLocal(p => ({ ...p, cpContentTypes: cleaned }))
                        }}
                        onBlur={commit}
                        placeholder={'■ 제목\n설명\n\n■ 제목\n설명'}
                        className="rslide__cp-ctypes-edit"
                        multiline
                        rows={7}
                      />
                    ) : (
                      <div className="rslide__cp-ctypes">
                        {contentTypeItems.map((item, i) => (
                          <div key={i} className="rslide__cp-ctype-item">
                            <div className="rslide__cp-ctype-title">■ {item.title}</div>
                            <div className="rslide__cp-ctype-desc">{item.desc}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Best review highlights (influencer grid) */}
          {page.type === 'best_review' && (() => {
            const cols = local.columns ?? 5
            const items = reviewRows.slice(0, cols * 3)
            return (
              <div className="rslide__grid" style={{ '--grid-cols': cols } as React.CSSProperties}>
                {items.map(row => {
                  const thumb = resolveMonitoringThumbnailUrl(row.assets)
                  const handle = (row.handle || '').replace(/^@/, '')
                  return (
                    <div key={row.id} className="rslide__grid-cell">
                      {thumb
                        ? <img src={thumb} className="rslide__grid-thumb" alt={handle} referrerPolicy="no-referrer" />
                        : <div className="rslide__grid-thumb-empty" />}
                      <div className="rslide__grid-body">
                        <div className="rslide__grid-handle">@{handle}</div>
                        <div className="rslide__grid-stat">
                          <Eye size={9} /> {fmt(row.views)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {/* Brand mention highlights */}
          {page.type === 'brand_mention' && (
            <div className="rslide__table">
              <div className="rslide__table-head">
                <span style={{ flex: 2 }}>브랜드</span>
                <span>리뷰</span>
                <span>조회수</span>
                <span>좋아요</span>
                <span>댓글</span>
              </div>
              {computeBrandStats(rows).map((b, i) => (
                <div key={i} className={`rslide__table-row${i % 2 ? ' rslide__table-row--alt' : ''}`}>
                  <span style={{ flex: 2 }}>{b.brand}</span>
                  <span>{b.count}</span>
                  <span>{fmt(b.views)}</span>
                  <span>{fmt(b.likes)}</span>
                  <span>{fmt(b.comments)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Project Overview */}
          {page.type === 'project_overview' && (() => {
            const DEFAULT_STEPS: ProcessStep[] = [
              { date: '', content: '' }, { date: '', content: '' },
              { date: '', content: '' }, { date: '', content: '' },
            ]
            const steps = local.processSteps ?? DEFAULT_STEPS
            const infoRows: { label: string; value: string | undefined; setter: (v: string) => void }[] = [
              { label: '프로젝트 명',    value: local.projectName,        setter: v => setLocal(p => ({ ...p, projectName: v })) },
              { label: '프로젝트 목적',  value: local.projectPurpose,     setter: v => setLocal(p => ({ ...p, projectPurpose: v })) },
              { label: '키트 발송 대상', value: local.kitRecipients,      setter: v => setLocal(p => ({ ...p, kitRecipients: v })) },
              { label: '총 배송 수량',   value: local.totalShipping,      setter: v => setLocal(p => ({ ...p, totalShipping: v })) },
              { label: '참여 브랜드',    value: local.participatingBrands, setter: v => setLocal(p => ({ ...p, participatingBrands: v })) },
            ]
            return (
              <>
                <div className="rslide__ov-body">
                  {/* Image 1/3 */}
                  <div className="rslide__ov-img-block">
                    {local.imageUrl
                      ? <img src={local.imageUrl} className="rslide__ov-img" alt="product" referrerPolicy="no-referrer" />
                      : <div className="rslide__ov-img-empty">이미지</div>}
                  </div>
                  {/* Info table 2/3 */}
                  <div className="rslide__ov-table">
                    {infoRows.map(({ label, value, setter }) => (
                      <div key={label} className="rslide__ov-row">
                        <SectionPill className="rslide__section-pill--label">{label}</SectionPill>
                        {editMode
                          ? <ET value={value ?? ''} onChange={setter} onBlur={commit} className="rslide__ov-value-edit" multiline rows={2} />
                          : <div className="rslide__ov-value">{value}</div>}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Process steps */}
                <div className="rslide__ov-process">
                  <SectionPill className="rslide__section-pill--process">진행 프로세스</SectionPill>
                  <div className="rslide__ov-steps">
                    {steps.map((step, i) => (
                      <div key={i} className="rslide__ov-step-wrap">
                        <div className={`rslide__ov-step${editMode ? ' rslide__ov-step--edit' : ''}`}>
                          {editMode ? (
                            <ET
                              value={step.date}
                              onChange={v => setLocal(p => ({ ...p, processSteps: (p.processSteps ?? DEFAULT_STEPS).map((s, j) => j === i ? { ...s, date: v } : s) }))}
                              onBlur={commit}
                              placeholder="날짜"
                              className="rslide__ov-step-date-edit"
                            />
                          ) : (
                            step.date && <div className="rslide__ov-step-date">{step.date}</div>
                          )}
                          {editMode ? (
                            <ET
                              value={step.content.split('\n').map(l => l ? `■ ${l}` : '').join('\n')}
                              onChange={v => {
                                const clean = v.split('\n').map(l => l.replace(/^■\s?/, '')).join('\n')
                                setLocal(p => ({ ...p, processSteps: (p.processSteps ?? DEFAULT_STEPS).map((s, j) => j === i ? { ...s, content: clean } : s) }))
                              }}
                              onBlur={commit}
                              placeholder="■ 내용을 입력하세요"
                              className="rslide__ov-step-content-edit"
                              multiline
                              rows={4}
                            />
                          ) : (
                            <div className="rslide__ov-step-content">
                              {step.content.split('\n').filter(Boolean).map((line, li) => (
                                <div key={li} className="rslide__ov-step-bullet">■ {line}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )
          })()}

          {/* Kit Composition — 2×3 grid (top 2fr / bottom 1fr) */}
          {page.type === 'kit_composition' && (
            <div className="rslide__kit-grid">
              {/* Top-left: image */}
              <div className="rslide__kit-cell rslide__kit-img-cell">
                {editMode ? (
                  <ET value={local.kitImageUrl ?? ''} onChange={v => setLocal(p => ({ ...p, kitImageUrl: v }))} onBlur={commit} placeholder="이미지 URL..." className="rslide__kit-img-url-edit" />
                ) : local.kitImageUrl ? (
                  <img src={local.kitImageUrl} className="rslide__kit-img" alt="kit" referrerPolicy="no-referrer" />
                ) : (
                  <div className="rslide__kit-img-empty">이미지</div>
                )}
              </div>
              {/* Top-right: concept — transparent, pill = ov-pill style */}
              <div className="rslide__kit-cell rslide__kit-cell--concept">
                {editMode ? (
                  <ET value={local.kitConceptTitle ?? ''} onChange={v => setLocal(p => ({ ...p, kitConceptTitle: v }))} onBlur={commit} placeholder="2026 VOL.1 콘셉트" className="rslide__kit-pill-edit" />
                ) : (
                  <SectionPill className="rslide__section-pill--concept">{local.kitConceptTitle || '2026 VOL.1 콘셉트'}</SectionPill>
                )}
                {editMode ? (
                  <ET value={local.kitConceptText ?? ''} onChange={v => setLocal(p => ({ ...p, kitConceptText: v }))} onBlur={commit} placeholder="콘셉트 설명..." className="rslide__kit-text-edit" multiline rows={6} />
                ) : (
                  <div className="rslide__kit-concept-text">{local.kitConceptText ?? ''}</div>
                )}
              </div>
              {/* Bottom-left: brand items — light blue card, process-head pill */}
              <div className="rslide__kit-cell rslide__kit-cell--composition">
                <SectionPill className="rslide__section-pill--composition">브랜드 구성품</SectionPill>
                {editMode ? (
                  <ET
                    value={(local.kitBrandItems ?? '').split('\n').map(l => l ? `■ ${l.replace(/^■\s?/, '')}` : '').join('\n')}
                    onChange={v => setLocal(p => ({ ...p, kitBrandItems: v.split('\n').map(l => l.replace(/^■\s?/, '')).join('\n') }))}
                    onBlur={commit}
                    placeholder="■ 항목을 입력하세요"
                    className="rslide__kit-text-edit"
                    multiline
                    rows={3}
                  />
                ) : (
                  <div className="rslide__kit-list">
                    {(local.kitBrandItems ?? '').split('\n').filter(Boolean).map((line, li) => (
                      <div key={li} className="rslide__kit-list-item">■ {line.replace(/^■\s?/, '')}</div>
                    ))}
                  </div>
                )}
              </div>
              {/* Bottom-right: Mi Muse items — light blue card, process-head pill */}
              <div className="rslide__kit-cell rslide__kit-cell--composition">
                <SectionPill className="rslide__section-pill--composition">Mi Muse 구성품</SectionPill>
                {editMode ? (
                  <ET
                    value={(local.kitMimuseItems ?? '').split('\n').map(l => l ? `■ ${l.replace(/^■\s?/, '')}` : '').join('\n')}
                    onChange={v => setLocal(p => ({ ...p, kitMimuseItems: v.split('\n').map(l => l.replace(/^■\s?/, '')).join('\n') }))}
                    onBlur={commit}
                    placeholder="■ 항목을 입력하세요"
                    className="rslide__kit-text-edit"
                    multiline
                    rows={3}
                  />
                ) : (
                  <div className="rslide__kit-list">
                    {(local.kitMimuseItems ?? '').split('\n').filter(Boolean).map((line, li) => (
                      <div key={li} className="rslide__kit-list-item">■ {line.replace(/^■\s?/, '')}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Next project — body text */}
          {page.type === 'next_project' && (
            editMode ? (
              <ET value={local.body ?? ''} onChange={v => setLocal(p => ({ ...p, body: v }))} onBlur={commit} placeholder="내용을 입력하세요..." className="rslide__body-edit" multiline />
            ) : (
              <div className="rslide__body">{local.body}</div>
            )
          )}
        </div>
      )}

      {/* Edit mode indicator */}
      {editMode && (
        <div className="rslide__edit-badge">편집 중</div>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────

export default function ReportSlides({
  pages,
  rows,
  editMode,
  onUpdate,
}: {
  pages: ReportPage[]
  rows: MonitoringRow[]
  editMode: boolean
  onUpdate: (page: ReportPage) => Promise<void>
}) {
  const sorted = [...pages].sort((a, b) => a.order_index - b.order_index)

  if (sorted.length === 0) {
    return (
      <div className="rslide-empty">
        <p>리포트 페이지가 없습니다.</p>
        <p style={{ fontSize: 13, color: 'var(--gray-4)', marginTop: 8 }}>
          상단 편집기 버튼을 눌러 페이지를 추가하세요.
        </p>
      </div>
    )
  }

  return (
    <div className="report-slides">
      {sorted.map(page => (
        <Slide
          key={page.id}
          page={page}
          editMode={editMode}
          rows={rows}
          onUpdate={content => onUpdate({ ...page, content })}
        />
      ))}
    </div>
  )
}
