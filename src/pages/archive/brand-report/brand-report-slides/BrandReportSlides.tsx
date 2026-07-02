import { useState } from 'react'
import { resolveMonitoringThumbnailUrl } from '@/lib/influencer/monitoring-storage'
import { monitoringBrandKey } from '@/lib/influencer/monitoring-keywords'
import type { MonitoringRow } from '@/lib/influencer/monitoring-data'
import type { BrandReportPage, BrandPageContent, ProcessStep } from '../brand-report-types'
import { uploadReportSlideImage } from '../../season/report-slides/report-image-upload'
import '../../season/report-slides/report-slides.css'
import './brand-report-slides.css'

const LOGO = '/img/logo-black.svg'
const ROWS_PER_PAGE = 15

// ── Editable text ─────────────────────────────────────────────────

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

// ── Section pill ──────────────────────────────────────────────────

function SectionPill({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`rslide__section-pill${className ? ` ${className}` : ''}`}>{children}</div>
}

// ── Content header ────────────────────────────────────────────────

function ContentHeader({
  content, editMode, onChange, onBlur,
}: {
  content: BrandPageContent
  editMode: boolean
  onChange: (c: BrandPageContent) => void
  onBlur: () => void
}) {
  return (
    <div className="rslide__header">
      {editMode ? (
        <ET value={content.engTitle ?? ''} onChange={v => onChange({ ...content, engTitle: v })} onBlur={onBlur}
          placeholder="English title..." className="rslide__eng-edit" />
      ) : (
        <div className="rslide__eng">{content.engTitle}</div>
      )}
      {editMode ? (
        <ET value={content.korTitle ?? ''} onChange={v => onChange({ ...content, korTitle: v })} onBlur={onBlur}
          placeholder="한국어 제목..." className="rslide__kor-edit" />
      ) : (
        <div className="rslide__kor">{content.korTitle}</div>
      )}
    </div>
  )
}

// ── Platform label ────────────────────────────────────────────────

function platformLabel(p: string) {
  if (/tiktok/i.test(p)) return 'TikTok'
  if (/insta/i.test(p)) return 'Instagram'
  if (/magazine/i.test(p)) return 'Magazine'
  return p
}

// ── Individual slide ──────────────────────────────────────────────

function BrandSlide({
  page, brandName, editMode, rows, onUpdate,
}: {
  page: BrandReportPage
  brandName: string
  editMode: boolean
  rows: MonitoringRow[]
  onUpdate: (content: BrandPageContent) => void
}) {
  const [local, setLocal] = useState<BrandPageContent>(page.content)
  const [uploading, setUploading] = useState<string | null>(null)

  const currentJson = JSON.stringify(page.content)
  const [lastJson, setLastJson] = useState(currentJson)
  if (currentJson !== lastJson) {
    setLocal(page.content)
    setLastJson(currentJson)
  }

  function commit() { onUpdate(local) }

  async function handleImageUpload(field: 'imageUrl' | 'bmdImageUrl') {
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

  // Pre-filter rows
  const brandKey = monitoringBrandKey(brandName)
  const brandVariants = new Set([
    brandName.trim().toLowerCase(),
    brandKey,
    brandName.trim().toLowerCase().replace(/\s+/g, ''),
  ])
  const reviewRows = rows.filter(r => r.review_link?.startsWith('http'))
  const brandRows = reviewRows.filter(r => r.brand && brandVariants.has(r.brand.toLowerCase()))
  const mimuseRows = reviewRows.filter(r => r.brand === 'mimuse')

  // ── Outro ──────────────────────────────────────────────────────
  if (page.type === 'outro') {
    const CONTACTS = [
      { name: '신유빈 프로', email: 'ybshin@cranecomm.com' },
      { name: '김도연 프로', email: 'dykim@cranecomm.com' },
    ]
    return (
      <div className="rslide">
        <div className="rslide__outro-layer">
          {editMode ? (
            <ET value={local.title ?? 'E.O.D'} onChange={v => setLocal(p => ({ ...p, title: v }))} onBlur={commit}
              placeholder="E.O.D" className="rslide__outro-title-edit" />
          ) : (
            <div className="rslide__outro-title">{local.title || 'E.O.D'}</div>
          )}
          <div className="rslide__outro-contact brslide__outro-contact">
            <span className="rslide__outro-contact-label">CONTACT</span>
            <span className="rslide__outro-contact-divider" />
            <div className="brslide__outro-contact-list">
              {CONTACTS.map(c => (
                <div key={c.email} className="brslide__outro-contact-row">
                  <span className="brslide__outro-contact-name">{c.name}</span>
                  <a href={`mailto:${c.email}`} className="brslide__outro-contact-email">{c.email}</a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rslide">
      {/* Logo */}
      {page.type === 'cover'
        ? <img src={LOGO} className="rslide__logo rslide__logo--cover" alt="" />
        : <img src={LOGO} className="rslide__logo rslide__logo--content" alt="" />
      }
      {page.type === 'cover' && (
        <div className="rslide__cover-copyright">© CRANECOMMUNICATIONS</div>
      )}

      {/* Cover */}
      {page.type === 'cover' && (
        <div className="rslide__cover-layer">
          {editMode ? (
            <ET value={local.title ?? ''} onChange={v => setLocal(p => ({ ...p, title: v }))} onBlur={commit}
              placeholder={`2026 Q1 시딩 프로젝트 결과 리포트 _ ${brandName}`}
              className="rslide__cover-title-edit" multiline rows={2} />
          ) : (
            local.title && <div className="rslide__cover-title">{local.title}</div>
          )}
        </div>
      )}

      {/* Content pages */}
      {page.type !== 'cover' && (
        <div className="rslide__content-layer">
          <ContentHeader content={local} editMode={editMode} onChange={c => setLocal(c)} onBlur={commit} />

          {/* Project Overview */}
          {page.type === 'project_overview' && (() => {
            const DEFAULT_STEPS: ProcessStep[] = [
              { date: '', content: '' }, { date: '', content: '' },
              { date: '', content: '' }, { date: '', content: '' },
            ]
            const steps = local.processSteps ?? DEFAULT_STEPS
            const infoRows: { label: string; value: string | undefined; setter: (v: string) => void; multiline?: boolean; tall?: boolean }[] = [
              { label: '프로젝트 명',    value: local.projectName,         setter: v => setLocal(p => ({ ...p, projectName: v })),         multiline: true },
              { label: '프로젝트 목적',  value: local.projectPurpose,      setter: v => setLocal(p => ({ ...p, projectPurpose: v })),      multiline: true, tall: true },
              { label: '키트 발송 대상', value: local.kitRecipients,       setter: v => setLocal(p => ({ ...p, kitRecipients: v })) },
              { label: '총 배송 수량',   value: local.totalShipping,       setter: v => setLocal(p => ({ ...p, totalShipping: v })) },
              { label: '참여 브랜드',    value: local.participatingBrands, setter: v => setLocal(p => ({ ...p, participatingBrands: v })) },
            ]
            return (
              <>
                <div className="rslide__ov-body">
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
                  <div className="rslide__ov-table">
                    {infoRows.map(({ label, value, setter, multiline, tall }) => (
                      <div key={label} className={`rslide__ov-row${tall ? ' rslide__ov-row--tall' : ''}`}>
                        <SectionPill className="rslide__section-pill--label">{label}</SectionPill>
                        {editMode
                          ? <ET value={value ?? ''} onChange={setter} onBlur={commit} className="rslide__ov-value-edit" multiline={multiline} rows={tall ? 3 : 2} />
                          : <div className={`rslide__ov-value${multiline ? '' : ' rslide__ov-value--single'}`}>{value}</div>}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rslide__ov-process">
                  <SectionPill className="rslide__section-pill--process">진행 프로세스</SectionPill>
                  <div className="rslide__ov-steps">
                    {steps.map((step, i) => (
                      <div key={i} className="rslide__ov-step-wrap">
                        <div className={`rslide__ov-step${editMode ? ' rslide__ov-step--edit' : ''}`}>
                          {editMode ? (
                            <ET value={step.date}
                              onChange={v => setLocal(p => ({ ...p, processSteps: (p.processSteps ?? DEFAULT_STEPS).map((s, j) => j === i ? { ...s, date: v } : s) }))}
                              onBlur={commit} placeholder="날짜" className="rslide__ov-step-date-edit" />
                          ) : (
                            step.date && <div className="rslide__ov-step-date">{step.date}</div>
                          )}
                          {editMode ? (
                            <ET value={step.content.split('\n').map(l => l ? `■ ${l}` : '').join('\n')}
                              onChange={v => {
                                const clean = v.split('\n').map(l => l.replace(/^■\s?/, '')).join('\n')
                                setLocal(p => ({ ...p, processSteps: (p.processSteps ?? DEFAULT_STEPS).map((s, j) => j === i ? { ...s, content: clean } : s) }))
                              }}
                              onBlur={commit} placeholder="■ 내용을 입력하세요"
                              className="rslide__ov-step-content-edit" multiline rows={4} />
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

          {/* Brand Content Performance */}
          {page.type === 'brand_content_performance' && (() => {
            const DEFAULT_RECOVERY = '인플루언서||80\n매거진||100\n콘텐츠 수량||98'
            const recoveryCards = (local.cpRecoveryCards ?? DEFAULT_RECOVERY).split('\n').map(line => {
              const parts = line.split('|')
              return { label: parts[0] ?? '', desc: parts[1] ?? '', pct: parseInt(parts[2] ?? '0') || 0 }
            })

            const infMap = new Map<string, boolean>()
            const infUploadMap = new Map<string, boolean>()
            for (const r of rows) {
              const key = (r as any).confirmed_influencer_id || (r as any).influencer_platform_id || r.id
              infMap.set(key, true)
              if (r.review_link?.startsWith('http')) infUploadMap.set(key, true)
            }
            const infPct = infMap.size ? Math.round(infUploadMap.size / infMap.size * 100) : 0

            // Platform performance auto from all review rows
            const platforms = ['TikTok', 'Instagram', 'Magazine'] as const
            const platStats = platforms.map(label => {
              const pRows = reviewRows.filter(r => platformLabel(r.platform ?? '') === label)
              return {
                label,
                count: pRows.length,
                avgViews: pRows.length ? Math.round(pRows.reduce((s, r) => s + r.views, 0) / pRows.length) : 0,
                avgLikes: pRows.length ? Math.round(pRows.reduce((s, r) => s + r.likes, 0) / pRows.length) : 0,
                avgComments: pRows.length ? Math.round(pRows.reduce((s, r) => s + r.comments, 0) / pRows.length) : 0,
              }
            }).filter(p => p.count > 0)

            const DEFAULT_CT = `Mi Muse 리뷰|0|0|0|0\n개별 브랜드 리뷰|0|0|0|0\n브랜드 단독 리뷰|0|0|0|0\n합계|0|0|0|0`
            const ctRows = (local.cpContentTypeRows ?? DEFAULT_CT).split('\n').map(line => {
              const p = line.split('|')
              return { label: p[0] ?? '', tiktok: p[1] ?? '0', instagram: p[2] ?? '0', magazine: p[3] ?? '0', total: p[4] ?? '0' }
            })

            return (
              <div className="brslide__cp">
                <SectionPill>회수율</SectionPill>
                <div className="rslide__cp-recovery">
                  {recoveryCards.map((card, i) => {
                    const isInfluencer = i === 0
                    const barPct = isInfluencer ? infPct : card.pct
                    return (
                      <div key={i} className="rslide__cp-card">
                        <div className="rslide__cp-card-header">
                          <div className="rslide__cp-card-label">{card.label}</div>
                        </div>
                        {editMode ? (
                          <>
                            <ET value={card.desc}
                              onChange={v => {
                                const updated = recoveryCards.map((c, j) => j === i ? { ...c, desc: v } : c)
                                setLocal(p => ({ ...p, cpRecoveryCards: updated.map(c => `${c.label}|${c.desc}|${c.pct}`).join('\n') }))
                              }}
                              onBlur={commit} placeholder="설명 입력" className="rslide__cp-card-desc-edit" />
                            {!isInfluencer && (
                              <ET value={String(card.pct)}
                                onChange={v => {
                                  const updated = recoveryCards.map((c, j) => j === i ? { ...c, pct: parseInt(v) || 0 } : c)
                                  setLocal(p => ({ ...p, cpRecoveryCards: updated.map(c => `${c.label}|${c.desc}|${c.pct}`).join('\n') }))
                                }}
                                onBlur={commit} placeholder="진행률 (0-100)" className="rslide__cp-card-pct-edit" />
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

                {/* Tables row */}
                <div className="brslide__cp-tables">
                  {/* Content type table — editable */}
                  <div className="brslide__cp-table-block">
                    <SectionPill>콘텐츠 종류</SectionPill>
                    <table className="brslide__table">
                      <thead>
                        <tr>
                          <th>구분</th><th>TikTok</th><th>Instagram</th><th>Magazine</th><th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ctRows.map((row, ri) => (
                          <tr key={ri} className={ri === ctRows.length - 1 ? 'brslide__table-total' : ''}>
                            <td>{row.label || `행 ${ri + 1}`}</td>
                            {editMode ? (
                              ['tiktok', 'instagram', 'magazine', 'total'].map(col => (
                                <td key={col}>
                                  <ET
                                    value={(row as any)[col]}
                                    onChange={v => {
                                      const updated = ctRows.map((r, j) => j === ri ? { ...r, [col]: v } : r)
                                      setLocal(p => ({ ...p, cpContentTypeRows: updated.map(r => `${r.label}|${r.tiktok}|${r.instagram}|${r.magazine}|${r.total}`).join('\n') }))
                                    }}
                                    onBlur={commit}
                                    className="brslide__table-cell-edit"
                                  />
                                </td>
                              ))
                            ) : (
                              <>
                                <td>{row.tiktok}</td>
                                <td>{row.instagram}</td>
                                <td>{row.magazine}</td>
                                <td>{row.total}</td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Platform performance table — auto */}
                  <div className="brslide__cp-table-block">
                    <SectionPill>콘텐츠 성과</SectionPill>
                    <table className="brslide__table">
                      <thead>
                        <tr>
                          <th>플랫폼</th><th>건 수</th><th>평균 조회수</th><th>평균 좋아요</th><th>평균 댓글</th>
                        </tr>
                      </thead>
                      <tbody>
                        {platStats.map((s, i) => (
                          <tr key={i}>
                            <td>{s.label}</td>
                            <td>{s.count}</td>
                            <td>{s.avgViews}</td>
                            <td>{s.label === 'Magazine' ? '—' : s.avgLikes}</td>
                            <td>{s.avgComments}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {editMode && (
                      <div className="rslide__cp-auto-note">콘텐츠 성과 대시보드 데이터 기반으로 자동 집계됩니다.</div>
                    )}
                  </div>
                </div>

                {/* Comment reaction */}
                <div className="brslide__cp-reaction">
                  <SectionPill>{brandName} 리뷰 콘텐츠 댓글 반응</SectionPill>
                  {editMode ? (
                    <ET value={local.cpCommentReaction ?? ''} onChange={v => setLocal(p => ({ ...p, cpCommentReaction: v }))}
                      onBlur={commit} placeholder="댓글 반응 요약을 입력하세요..." className="brslide__cp-reaction-edit" />
                  ) : (
                    <div className="brslide__cp-reaction-text">{local.cpCommentReaction}</div>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Review List */}
          {page.type === 'review_list' && (() => {
            const subtitle = local.rlSubtitle ?? 'Mi Muse 리뷰'
            const isMimuse = subtitle.includes('Mi Muse') || subtitle.includes('mimuse')
            const tableRows = (isMimuse ? mimuseRows : brandRows)
            const offset = local.rlOffset ?? 0
            const pageRows = tableRows.slice(offset, offset + ROWS_PER_PAGE)
            const isBrand = !isMimuse

            return (
              <div className="brslide__rl">
                <div className="brslide__rl-subtitle">
                  {editMode ? (
                    <ET value={local.rlSubtitle ?? ''} onChange={v => setLocal(p => ({ ...p, rlSubtitle: v }))}
                      onBlur={commit} placeholder="Mi Muse 리뷰 / 브랜드 개별 리뷰" className="brslide__rl-subtitle-edit" />
                  ) : (
                    <span>— {subtitle}</span>
                  )}
                  {editMode && (
                    <div className="brslide__rl-offset-wrap">
                      <span className="brslide__rl-offset-label">시작 행</span>
                      <ET value={String(offset)} onChange={v => setLocal(p => ({ ...p, rlOffset: parseInt(v) || 0 }))}
                        onBlur={commit} className="brslide__rl-offset-edit" />
                    </div>
                  )}
                </div>
                <div className="brslide__rl-table-wrap">
                  <table className="brslide__rl-table">
                    <thead>
                      <tr>
                        <th>No.</th>
                        <th>플랫폼</th>
                        <th>계정</th>
                        <th>조회수</th>
                        <th>좋아요</th>
                        <th>댓글</th>
                        {isBrand && <th>Repost</th>}
                        <th>포스팅 URL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.length > 0 ? pageRows.map((row, i) => (
                        <tr key={row.id}>
                          <td className="brslide__rl-no">{offset + i + 1}</td>
                          <td>{platformLabel(row.platform ?? '')}</td>
                          <td className="brslide__rl-handle">{row.handle}</td>
                          <td>{row.views > 0 ? row.views : '—'}</td>
                          <td>{row.likes > 0 ? row.likes : '—'}</td>
                          <td>{row.comments > 0 ? row.comments : '—'}</td>
                          {isBrand && <td>{row.repost ?? '—'}</td>}
                          <td className="brslide__rl-url">
                            {row.review_link
                              ? <a href={row.review_link} target="_blank" rel="noopener noreferrer">{row.review_link}</a>
                              : '—'}
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={isBrand ? 8 : 7} className="brslide__rl-empty">
                            {editMode ? '모니터링 데이터가 없습니다.' : '데이터 없음'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {tableRows.length > ROWS_PER_PAGE && (
                  <div className="brslide__rl-page-info">
                    {offset + 1}–{Math.min(offset + ROWS_PER_PAGE, tableRows.length)} / 총 {tableRows.length}건
                  </div>
                )}
              </div>
            )
          })()}

          {/* Best Review grid */}
          {page.type === 'best_review' && (
            <div className="rslide__hl-grid">
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} className="rslide__hl-cell">
                  <div className="rslide__hl-ph">이미지</div>
                </div>
              ))}
            </div>
          )}

          {/* Best Review detail */}
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
                      <div className="rslide__brd-media"><div className="rslide__brd-ph">이미지</div></div>
                      {editMode ? (
                        <div className="rslide__brd-info-edit">
                          <span className="rslide__brd-edit-label">인플루언서</span>
                          <ET value={d.handle} onChange={v => setLocal(p => ({ ...p, [key]: [v, d.followers, d.comment].join('\n') }))} onBlur={commit} placeholder="@handle" className="rslide__brd-edit-input" />
                          <span className="rslide__brd-edit-label">팔로워</span>
                          <ET value={d.followers} onChange={v => setLocal(p => ({ ...p, [key]: [d.handle, v, d.comment].join('\n') }))} onBlur={commit} placeholder="예: 7.4K" className="rslide__brd-edit-input" />
                          <span className="rslide__brd-edit-label rslide__brd-edit-label--last">댓글 반응</span>
                          <ET value={d.comment} onChange={v => setLocal(p => ({ ...p, [key]: [d.handle, d.followers, v].join('\n') }))} onBlur={commit} placeholder="댓글 반응 내용..." className="rslide__brd-edit-input rslide__brd-edit-input--area" multiline rows={4} />
                        </div>
                      ) : (
                        <div className="rslide__brd-info">
                          <span className="rslide__brd-label">인플루언서</span>
                          <span className="rslide__brd-value">{d.handle || '—'}</span>
                          <span className="rslide__brd-label">팔로워</span>
                          <span className="rslide__brd-value">{d.followers || '—'}</span>
                          <span className="rslide__brd-label rslide__brd-label--last">댓글 반응</span>
                          <span className="rslide__brd-value rslide__brd-value--desc">{d.comment || '—'}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {/* Brand Mention grid — filtered to this brand */}
          {page.type === 'brand_mention' && (
            <div className="brslide__bm-grid">
              {Array.from({ length: 12 }).map((_, i) => {
                const row = brandRows[i]
                const thumb = row ? resolveMonitoringThumbnailUrl(row.assets) : null
                const isVideo = row ? !!(row.assets?.video_url) : false
                return (
                  <div key={i} className="brslide__bm-thumb">
                    {thumb
                      ? <img src={thumb} alt="" referrerPolicy="no-referrer" className="brslide__bm-img" />
                      : <div className="brslide__bm-ph" />}
                    {isVideo && <div className="rslide__bm-play" />}
                  </div>
                )
              })}
            </div>
          )}

          {/* Brand Mention detail — one influencer per slide */}
          {page.type === 'brand_mention_detail' && (() => {
            const statRows: { label: string; key: keyof BrandPageContent; link?: boolean }[] = [
              { label: '인플루언서', key: 'bmdHandle', link: true },
              { label: '팔로워',    key: 'bmdFollowers' },
              { label: '조회수',    key: 'bmdViews' },
              { label: '좋아요',    key: 'bmdLikes' },
              { label: '댓글',     key: 'bmdComments' },
              { label: '추가 업로드', key: 'bmdAdditional', link: true },
            ]
            return (
              <div className="brslide__bmd">
                {/* Left: image */}
                <div className="brslide__bmd-img-block">
                  {editMode ? (
                    <div className="rslide__img-upload-zone" onClick={() => handleImageUpload('bmdImageUrl')}>
                      {uploading === 'bmdImageUrl' ? (
                        <div className="rslide__img-upload-loading">업로드 중...</div>
                      ) : local.bmdImageUrl ? (
                        <>
                          <img src={local.bmdImageUrl} alt="" referrerPolicy="no-referrer" className="brslide__bmd-img" />
                          <div className="rslide__img-upload-overlay">이미지 변경</div>
                        </>
                      ) : (
                        <div className="rslide__img-upload-empty">이미지</div>
                      )}
                    </div>
                  ) : local.bmdImageUrl ? (
                    <img src={local.bmdImageUrl} alt="" referrerPolicy="no-referrer" className="brslide__bmd-img" />
                  ) : (
                    <div className="rslide__ov-img-empty">이미지</div>
                  )}
                </div>

                {/* Right: stats + comment reaction */}
                <div className="brslide__bmd-right">
                  <div className="brslide__bmd-stats">
                    {statRows.map(({ label, key }) => (
                      <div key={label} className="brslide__bmd-stat-row">
                        <div className="brslide__bmd-stat-label">{label}</div>
                        {editMode ? (
                          <ET value={(local[key] as string) ?? ''}
                            onChange={v => setLocal(p => ({ ...p, [key]: v }))}
                            onBlur={commit} placeholder={label}
                            className="brslide__bmd-stat-edit" />
                        ) : (
                          <div className="brslide__bmd-stat-value">{(local[key] as string) || '—'}</div>
                        )}
                      </div>
                    ))}
                    <div className="brslide__bmd-stat-row brslide__bmd-stat-row--reaction">
                      <div className="brslide__bmd-stat-label">댓글 반응</div>
                      {editMode ? (
                        <ET value={local.bmdCommentReaction ?? ''} onChange={v => setLocal(p => ({ ...p, bmdCommentReaction: v }))}
                          onBlur={commit} placeholder="댓글 반응 내용..." className="brslide__bmd-reaction-edit" multiline rows={4} />
                      ) : (
                        <div className="brslide__bmd-reaction-text">{local.bmdCommentReaction || '—'}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {editMode && <div className="rslide__edit-badge">편집 중</div>}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────

export default function BrandReportSlides({
  pages,
  rows,
  brandName,
  editMode,
  onUpdate,
}: {
  pages: BrandReportPage[]
  rows: MonitoringRow[]
  brandName: string
  editMode: boolean
  onUpdate: (page: BrandReportPage) => Promise<void>
}) {
  const sorted = [...pages].sort((a, b) => a.order_index - b.order_index)

  if (sorted.length === 0) {
    return (
      <div className="rslide-empty">
        <p>리포트 페이지가 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="report-slides brand-report-slides">
      {sorted.map(page => (
        <BrandSlide
          key={page.id}
          page={page}
          brandName={brandName}
          editMode={editMode}
          rows={rows}
          onUpdate={content => onUpdate({ ...page, content })}
        />
      ))}
    </div>
  )
}
