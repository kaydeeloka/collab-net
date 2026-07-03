import { useState } from 'react'
import { fmtNum } from '@/lib/utils'
import { resolveMonitoringThumbnailUrl } from '@/lib/influencer/monitoring-storage'
import { monitoringBrandKey } from '@/lib/influencer/monitoring-keywords'
import type { MonitoringRow } from '@/lib/influencer/monitoring-data'
import type { ReportPage, PageContent, ProcessStep } from './types'
import { uploadReportSlideImage } from './report-image-upload'
import './report-slides.css'

const LOGO = '/img/logo-report.svg'

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
  page, editMode, rows, confirmedBrands, onUpdate,
}: {
  page: ReportPage
  editMode: boolean
  rows: MonitoringRow[]
  confirmedBrands: { name: string; nameEn: string }[]
  onUpdate: (content: PageContent) => void
}) {
  const [local, setLocal] = useState<PageContent>(page.content)
  const [uploading, setUploading] = useState<string | null>(null)

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

  async function handleImageUpload(field: 'imageUrl' | 'kitImageUrl') {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      setUploading(field)
      const url = await uploadReportSlideImage(page.phase_id, file)
      setUploading(null)
      if (url) {
        const next = { ...local, [field]: url }
        setLocal(next)
        onUpdate(next)
      }
    }
    input.click()
  }

  async function handleBmSlotUpload(brandKey: string, ti: number, currentOverrides: Record<string, string>) {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const ovKey = `${brandKey}_${ti}`
      setUploading(`bm_${ovKey}`)
      const url = await uploadReportSlideImage(page.phase_id, file)
      setUploading(null)
      if (url) {
        const next = { ...local, bmOverrides: JSON.stringify({ ...currentOverrides, [ovKey]: url }) }
        setLocal(next)
        onUpdate(next)
      }
    }
    input.click()
  }

  async function handleNpImageUpload(index: number, currentUrls: string[]) {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      setUploading(`np_${index}`)
      const url = await uploadReportSlideImage(page.phase_id, file)
      setUploading(null)
      if (url) {
        const arr = [...currentUrls]
        arr[index] = url
        const next = { ...local, npImageUrls: arr.join('\n') }
        setLocal(next)
        onUpdate(next)
      }
    }
    input.click()
  }

  // ── Outro ──────────────────────────────────────────────────────
  if (page.type === 'outro') {
    const DEFAULT_CONTACT = 'CONTACT | beautyproject@cranecomm.com'
    const captionValue = local.caption || DEFAULT_CONTACT
    const contactParts = captionValue.split('|').map(p => p.trim())
    return (
      <div className="rslide">
        <div className="rslide__outro-layer">
          {editMode ? (
            <ET value={local.title ?? 'E.O.D'} onChange={v => setLocal(p => ({ ...p, title: v }))} onBlur={commit} placeholder="E.O.D" className="rslide__outro-title-edit" />
          ) : (
            <div className="rslide__outro-title">{local.title || 'E.O.D'}</div>
          )}
          {editMode ? (
            <ET value={local.caption ?? ''} onChange={v => setLocal(p => ({ ...p, caption: v }))} onBlur={commit} placeholder="CONTACT  |  email@example.com" className="rslide__outro-caption-edit" />
          ) : contactParts.length >= 2 ? (
            <div className="rslide__outro-contact">
              <span className="rslide__outro-contact-label" style={{ lineHeight: 1 }}>{contactParts[0]}</span>
              <span className="rslide__outro-contact-divider" />
              <a className="rslide__outro-contact-email" href={`mailto:${contactParts.slice(1).join('|').trim()}`} style={{ lineHeight: 1 }}>{contactParts.slice(1).join('|').trim()}</a>
            </div>
          ) : (
            <div className="rslide__outro-caption">{captionValue}</div>
          )}
        </div>
      </div>
    )
  }

  const reviewRows = rows.filter(r => r.review_link?.startsWith('http'))

  return (
    <div className="rslide">

      {/* ── Logo ── */}
      {page.type === 'cover'
        ? <img src={LOGO} className="rslide__logo rslide__logo--cover" alt="" />
        : <img src={LOGO} className="rslide__logo rslide__logo--content" alt="" />
      }
      {page.type === 'cover' && (
        <div className="rslide__cover-copyright">© CRANECOMMUNICATIONS</div>
      )}

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
                    {editMode && (
                      <div className="rslide__cp-auto-note">
                        콘텐츠 성과 대시보드 데이터 기반으로 자동 집계됩니다.
                      </div>
                    )}
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

          {/* Best review highlights — mimuse thumbnail grid */}
          {page.type === 'best_review' && (() => {
            const mimuseRows = reviewRows
              .filter(r => (r.brand || '').toLowerCase() === 'mimuse')
              .sort((a, b) => {
                const aThumb = !!resolveMonitoringThumbnailUrl(a.assets)
                const bThumb = !!resolveMonitoringThumbnailUrl(b.assets)
                if (aThumb !== bThumb) return aThumb ? -1 : 1
                return (b.views || 0) - (a.views || 0)
              })
              .slice(0, 14)
            return (
              <div className="rslide__hl-grid">
                {Array.from({ length: 14 }).map((_, i) => {
                  const r = mimuseRows[i]
                  const thumbUrl = r ? resolveMonitoringThumbnailUrl(r.assets) : null
                  return (
                    <div key={i} className="rslide__hl-cell">
                      {thumbUrl
                        ? <img src={thumbUrl} className="rslide__hl-img" alt="" referrerPolicy="no-referrer" />
                        : <div className="rslide__hl-ph">이미지</div>}
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {/* Best review detail cards */}
          {page.type === 'best_review_detail' && (() => {
            function parseBrdCard(raw?: string) {
              const lines = (raw ?? '').split('\n')
              return { handle: lines[0] ?? '', followers: lines[1] ?? '', comment: lines.slice(2).join('\n') }
            }
            const cardKeys = ['brdCard1', 'brdCard2', 'brdCard3'] as const
            return (
              <div className="rslide__brd-grid">
                {cardKeys.map((key, i) => {
                  const d = parseBrdCard(local[key])
                  return (
                    <div key={i} className="rslide__brd-card">
                      <div className="rslide__brd-media">
                        <div className="rslide__brd-ph">이미지</div>
                        <div className="rslide__brd-badges">
                        </div>
                      </div>
                      {editMode ? (
                        <div className="rslide__brd-info-edit">
                          <span className="rslide__brd-edit-label">인플루언서</span>
                          <ET value={d.handle} onChange={v => setLocal(p => ({ ...p, [key]: [v, d.followers, d.comment].join('\n') }))} onBlur={commit} placeholder="@handle" className="rslide__brd-edit-input" />
                          <span className="rslide__brd-edit-label">팔로워</span>
                          <ET value={d.followers} onChange={v => setLocal(p => ({ ...p, [key]: [d.handle, v, d.comment].join('\n') }))} onBlur={commit} placeholder="예: 7.4K" className="rslide__brd-edit-input" />
                          <span className="rslide__brd-edit-label rslide__brd-edit-label--last">댓글 반응</span>
                          <ET value={d.comment} onChange={v => setLocal(p => ({ ...p, [key]: [d.handle, d.followers, v].join('\n') }))} onBlur={commit} placeholder="댓글 반응 내용..." className="rslide__brd-edit-input rslide__brd-edit-input--area" multiline rows={4} />
                        </div>
                      ) : (() => {
                        const rawHandle = d.handle || ''
                        const slug = rawHandle.replace(/^@/, '')
                        const tiktokUrl = slug ? `https://www.tiktok.com/@${slug}` : ''
                        return (
                          <div className="rslide__brd-info">
                            <span className="rslide__brd-label">인플루언서</span>
                            <span className="rslide__brd-value rslide__brd-value--link">
                              {tiktokUrl
                                ? <a href={tiktokUrl} target="_blank" rel="noopener noreferrer" data-pdf-link={tiktokUrl} className="rslide__brd-handle-link">{rawHandle || '—'}</a>
                                : (rawHandle || '—')}
                            </span>
                            <span className="rslide__brd-label">팔로워</span>
                            <span className="rslide__brd-value">{d.followers || '—'}</span>
                            <span className="rslide__brd-label rslide__brd-label--last">댓글 반응</span>
                            <span className="rslide__brd-value rslide__brd-value--desc">{d.comment || '—'}</span>
                          </div>
                        )
                      })()}
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {/* Brand mention gallery */}
          {page.type === 'brand_mention' && (() => {
            function brandVariants(name: string): string[] {
              const lower = name.trim().toLowerCase()
              return [lower, monitoringBrandKey(name), lower.replace(/\s+/g, ''), lower.replace(/\s+/g, '-')]
            }
            const bmOvMap: Record<string, string> = (() => {
              try { return JSON.parse(local.bmOverrides ?? '{}') } catch { return {} }
            })()
            const groups: { name: string; nameEn: string; brandRows: MonitoringRow[] }[] = confirmedBrands.length > 0
              ? confirmedBrands.slice(0, 4).map(({ name, nameEn }) => {
                  const variants = new Set([...brandVariants(name), ...brandVariants(nameEn)])
                  const matched = reviewRows
                    .filter(r => r.brand && variants.has(r.brand.toLowerCase()))
                    .sort((a, b) => {
                      const aThumb = !!resolveMonitoringThumbnailUrl(a.assets)
                      const bThumb = !!resolveMonitoringThumbnailUrl(b.assets)
                      if (aThumb !== bThumb) return aThumb ? -1 : 1
                      return (b.views || 0) - (a.views || 0)
                    })
                  return { name, nameEn, brandRows: matched }
                })
              : [
                  { name: 'brand1', nameEn: 'BRAND 1', brandRows: [] },
                  { name: 'brand2', nameEn: 'BRAND 2', brandRows: [] },
                  { name: 'brand3', nameEn: 'BRAND 3', brandRows: [] },
                  { name: 'brand4', nameEn: 'BRAND 4', brandRows: [] },
                ]
            return (
              <div className="rslide__bm-grid">
                {groups.map(({ name, nameEn, brandRows }, gi) => (
                  <div key={gi} className="rslide__bm-brand">
                    <div className="rslide__bm-pill">{nameEn}</div>
                    <div className="rslide__bm-thumbs">
                      {Array.from({ length: 4 }).map((_, ti) => {
                        const ovKey = `${monitoringBrandKey(name)}_${ti}`
                        const overrideUrl = bmOvMap[ovKey] ?? null
                        const row = brandRows[ti]
                        const autoThumb = row ? resolveMonitoringThumbnailUrl(row.assets) : null
                        const displayUrl = overrideUrl ?? autoThumb
                        if (editMode) {
                          return (
                            <div
                              key={ti}
                              className="rslide__bm-thumb rslide__img-upload-zone"
                              onClick={() => handleBmSlotUpload(monitoringBrandKey(name), ti, bmOvMap)}
                            >
                              {uploading === `bm_${ovKey}` ? (
                                <div className="rslide__img-upload-loading">...</div>
                              ) : displayUrl ? (
                                <>
                                  <img src={displayUrl} alt="" referrerPolicy="no-referrer" className="rslide__bm-img" />
                                  <div className="rslide__img-upload-overlay">변경</div>
                                </>
                              ) : (
                                <div className="rslide__img-upload-empty" style={{ fontSize: '0.6cqw' }}>+</div>
                              )}
                            </div>
                          )
                        }
                        return (
                          <div key={ti} className="rslide__bm-thumb">
                            {displayUrl
                              ? <img src={displayUrl} alt="" referrerPolicy="no-referrer" className="rslide__bm-img" />
                              : <div className="rslide__bm-ph" />}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Project Overview */}
          {page.type === 'project_overview' && (() => {
            const DEFAULT_STEPS: ProcessStep[] = [
              { date: '', content: '' }, { date: '', content: '' },
              { date: '', content: '' }, { date: '', content: '' },
            ]
            const steps = local.processSteps ?? DEFAULT_STEPS
            const infoRows: { label: string; value: string | undefined; setter: (v: string) => void; multiline?: boolean; rows?: number }[] = [
              { label: '프로젝트 명',    value: local.projectName,         setter: v => setLocal(p => ({ ...p, projectName: v })),         multiline: true, rows: 2 },
              { label: '프로젝트 목적',  value: local.projectPurpose,      setter: v => setLocal(p => ({ ...p, projectPurpose: v })),      multiline: true, rows: 3 },
              { label: '키트 발송 대상', value: local.kitRecipients,       setter: v => setLocal(p => ({ ...p, kitRecipients: v })) },
              { label: '총 배송 수량',   value: local.totalShipping,       setter: v => setLocal(p => ({ ...p, totalShipping: v })) },
              { label: '참여 브랜드',    value: local.participatingBrands, setter: v => setLocal(p => ({ ...p, participatingBrands: v })) },
            ]
            return (
              <>
                <div className="rslide__ov-body">
                  {/* Image 1/3 */}
                  <div className="rslide__ov-img-block">
                    {editMode ? (
                      <div className="rslide__img-upload-zone" onClick={() => handleImageUpload('imageUrl')}>
                        {uploading === 'imageUrl' ? (
                          <div className="rslide__img-upload-loading">업로드 중...</div>
                        ) : local.imageUrl ? (
                          <>
                            <img src={local.imageUrl} className="rslide__ov-img" alt="product" referrerPolicy="no-referrer" />
                            <div className="rslide__img-upload-overlay">이미지 변경</div>
                          </>
                        ) : (
                          <div className="rslide__img-upload-empty">이미지</div>
                        )}
                      </div>
                    ) : local.imageUrl ? (
                      <img src={local.imageUrl} className="rslide__ov-img" alt="product" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="rslide__ov-img-empty">이미지</div>
                    )}
                  </div>
                  {/* Info table 2/3 */}
                  <div className="rslide__ov-table">
                    {infoRows.map(({ label, value, setter, multiline, rows }) => (
                      <div key={label} className="rslide__ov-row">
                        <SectionPill className="rslide__section-pill--label">{label}</SectionPill>
                        {editMode
                          ? <ET value={value ?? ''} onChange={setter} onBlur={commit} className="rslide__ov-value-edit" multiline={multiline} rows={rows ?? 1} />
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
                                <div key={li} className="rslide__ov-step-bullet">
                                  <span className="rslide__ov-step-bullet-icon">■</span>
                                  <span>{line}</span>
                                </div>
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
                  <div className="rslide__img-upload-zone" onClick={() => handleImageUpload('kitImageUrl')}>
                    {uploading === 'kitImageUrl' ? (
                      <div className="rslide__img-upload-loading">업로드 중...</div>
                    ) : local.kitImageUrl ? (
                      <>
                        <img src={local.kitImageUrl} className="rslide__kit-img" alt="kit" referrerPolicy="no-referrer" />
                        <div className="rslide__img-upload-overlay">이미지 변경</div>
                      </>
                    ) : (
                      <div className="rslide__img-upload-empty">이미지</div>
                    )}
                  </div>
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
              {/* Bottom row: two equal composition cells */}
              <div className="rslide__kit-composition-row">
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
                        <div key={li} className="rslide__kit-list-item"><span className="rslide__kit-list-bullet">■</span><span>{line.replace(/^■\s?/, '')}</span></div>
                      ))}
                    </div>
                  )}
                </div>
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
                        <div key={li} className="rslide__kit-list-item"><span className="rslide__kit-list-bullet">■</span><span>{line.replace(/^■\s?/, '')}</span></div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Next project */}
          {page.type === 'next_project' && (() => {
            const imageUrls = (local.npImageUrls ?? '').split('\n').map(u => u.trim()).slice(0, 4)
            const conceptLines = (local.npConcept ?? '').split('\n')
            const conceptTitle = conceptLines[0] ?? ''
            const conceptDetail = conceptLines.slice(1)
            const infoRows = [
              { label: '프로젝트 컨셉', key: 'npConcept' as const, value: local.npConcept ?? '', isMulti: true },
              { label: '프로젝트 기간',  key: 'npPeriod' as const,  value: local.npPeriod ?? '', isMulti: false },
              { label: '키트 발송 대상', key: 'npKitRecipients' as const, value: local.npKitRecipients ?? '', isMulti: false },
              { label: '참여 브랜드',    key: 'npBrands' as const,  value: local.npBrands ?? '', isMulti: false },
            ]
            const cardKeys = ['npCard1', 'npCard2', 'npCard3'] as const
            function parseCard(raw?: string) {
              const lines = (raw ?? '').split('\n')
              return { title: lines[0] ?? '', bullets: lines.slice(1).filter(Boolean) }
            }
            return (
              <div className="rslide__np">
                {/* Top: images + info */}
                <div className="rslide__np-body">
                  {/* Left: 4-image strip */}
                  <div className="rslide__np-imgs">
                    {Array.from({ length: 4 }).map((_, i) => {
                      const url = imageUrls[i]
                      const key = `np_${i}`
                      return (
                        <div key={i} className="rslide__np-img-cell">
                          {editMode ? (
                            <div className="rslide__img-upload-zone" onClick={() => handleNpImageUpload(i, imageUrls)}>
                              {uploading === key ? (
                                <div className="rslide__img-upload-loading">업로드 중...</div>
                              ) : url ? (
                                <>
                                  <img src={url} alt="" referrerPolicy="no-referrer" className="rslide__np-img" />
                                  <div className="rslide__img-upload-overlay">변경</div>
                                </>
                              ) : (
                                <div className="rslide__img-upload-empty" style={{ fontSize: '0.7cqw' }}>이미지</div>
                              )}
                            </div>
                          ) : url ? (
                            <img src={url} alt="" referrerPolicy="no-referrer" className="rslide__np-img" />
                          ) : (
                            <div className="rslide__np-img-ph" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {/* Right: info table */}
                  <div className="rslide__np-info">
                    {infoRows.map(row => (
                      <div key={row.label} className="rslide__np-row">
                        <SectionPill className="rslide__section-pill--np-label">{row.label}</SectionPill>
                        {row.key === 'npConcept' ? (
                          editMode ? (
                            <div className="rslide__np-concept">
                              <ET value={conceptTitle}
                                onChange={v => setLocal(p => ({ ...p, npConcept: [v, ...conceptDetail].join('\n') }))}
                                onBlur={commit} placeholder="컨셉 제목..." className="rslide__np-concept-title-edit" />
                              <ET value={conceptDetail.join('\n')}
                                onChange={v => setLocal(p => ({ ...p, npConcept: [conceptTitle, ...v.split('\n')].join('\n') }))}
                                onBlur={commit} placeholder="컨셉 설명..." className="rslide__np-concept-desc-edit" multiline rows={2} />
                            </div>
                          ) : (
                            <div className="rslide__np-concept">
                              <div className="rslide__np-concept-title">{conceptTitle}</div>
                              {conceptDetail.map((line, li) => (
                                <div key={li} className={`rslide__np-concept-line${line.startsWith('■') ? ' rslide__np-concept-bullet' : ''}`}>{line}</div>
                              ))}
                            </div>
                          )
                        ) : editMode ? (
                          <ET value={row.value} onChange={v => setLocal(p => ({ ...p, [row.key]: v }))} onBlur={commit}
                            className="rslide__np-value-edit" multiline={row.isMulti} rows={row.isMulti ? 3 : 1} />
                        ) : (
                          <div className="rslide__np-value">{row.value}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Bottom: improvement section */}
                <div className="rslide__np-bottom">
                  {editMode ? (
                    <ET value={local.npImprovementTitle ?? ''} onChange={v => setLocal(p => ({ ...p, npImprovementTitle: v }))} onBlur={commit}
                      placeholder="보완 섹션 제목..." className="rslide__np-impr-title-edit" />
                  ) : (
                    <SectionPill className="rslide__section-pill--np-impr">{local.npImprovementTitle || '1차 대비 보완 운영 예정'}</SectionPill>
                  )}
                  <div className="rslide__np-cards">
                    {cardKeys.map((key, ci) => {
                      const card = parseCard(local[key])
                      return (
                        <div key={ci} className="rslide__np-card-wrap">
                          <div className="rslide__np-card">
                            {editMode ? (
                              <>
                                <ET value={card.title}
                                  onChange={v => setLocal(p => { const c = parseCard(p[key]); return { ...p, [key]: [v, ...c.bullets.map(b => b.startsWith('■') ? b : `■ ${b}`)].join('\n') } })}
                                  onBlur={commit} placeholder="카드 제목..." className="rslide__np-card-title-edit" />
                                <ET value={card.bullets.map(b => b.startsWith('■') ? b : `■ ${b}`).join('\n')}
                                  onChange={v => setLocal(p => { const c = parseCard(p[key]); return { ...p, [key]: [c.title, ...v.split('\n').map(l => l.replace(/^■\s?/, ''))].join('\n') } })}
                                  onBlur={commit} placeholder={'■ 내용\n■ 내용'} className="rslide__np-card-content-edit" multiline rows={4} />
                              </>
                            ) : (
                              <>
                                <div className="rslide__np-card-title">{card.title}</div>
                                {card.bullets.map((b, bi) => (
                                  <div key={bi} className="rslide__np-card-bullet">
                                    <span className="rslide__np-card-bullet-icon">■</span>
                                    <span>{b.replace(/^■\s*/, '')}</span>
                                  </div>
                                ))}
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })()}
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
  confirmedBrands,
  editMode,
  onUpdate,
}: {
  pages: ReportPage[]
  rows: MonitoringRow[]
  confirmedBrands: { name: string; nameEn: string }[]
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
          confirmedBrands={confirmedBrands}
          onUpdate={content => onUpdate({ ...page, content })}
        />
      ))}
    </div>
  )
}
