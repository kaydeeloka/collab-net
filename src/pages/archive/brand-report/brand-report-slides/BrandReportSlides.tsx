import { useState } from 'react'
import { X } from 'lucide-react'
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

function fmtK(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
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
  page, brandName, brandEn, editMode, rows, onUpdate, onDelete,
}: {
  page: BrandReportPage
  brandName: string
  brandEn?: string
  editMode: boolean
  rows: MonitoringRow[]
  onUpdate: (content: BrandPageContent) => void
  onDelete?: () => void
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

  async function handleBmSlotUpload(ti: number, currentOverrides: Record<string, string>) {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const ovKey = String(ti)
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

  async function handleImageUpload(field: 'imageUrl' | 'bmdImageUrl' | 'brdCard1Img' | 'brdCard2Img' | 'brdCard3Img') {
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
    ...(brandEn ? [brandEn.toLowerCase()] : []),
  ])
  const reviewRows = rows.filter(r => r.review_link?.startsWith('http'))
  const brandRows = reviewRows.filter(r => r.brand && brandVariants.has(r.brand.toLowerCase()))
  const mimuseRows = reviewRows.filter(r => r.brand === 'mimuse')

  // ── Outro ──────────────────────────────────────────────────────
  if (page.type === 'outro') {
    const DEFAULT_CONTACTS = '신유빈 프로|ybshin@cranecomm.com\n김도연 프로|dykim@cranecomm.com'
    const contacts = (local.outroContacts ?? DEFAULT_CONTACTS).split('\n').map(line => {
      const [name = '', email = ''] = line.split('|')
      return { name, email }
    })
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
              {contacts.map((c, i) => (
                <div key={i} className="brslide__outro-contact-row">
                  {editMode ? (
                    <input
                      className="brslide__outro-contact-name-edit"
                      value={c.name}
                      onChange={e => {
                        const updated = contacts.map((x, j) => j === i ? { ...x, name: e.target.value } : x)
                        setLocal(p => ({ ...p, outroContacts: updated.map(x => `${x.name}|${x.email}`).join('\n') }))
                      }}
                      onBlur={commit}
                      placeholder="이름"
                    />
                  ) : (
                    <span className="brslide__outro-contact-name">{c.name}</span>
                  )}
                  {editMode ? (
                    <input
                      className="brslide__outro-contact-email-edit"
                      value={c.email}
                      onChange={e => {
                        const updated = contacts.map((x, j) => j === i ? { ...x, email: e.target.value } : x)
                        setLocal(p => ({ ...p, outroContacts: updated.map(x => `${x.name}|${x.email}`).join('\n') }))
                      }}
                      onBlur={commit}
                      placeholder="email@example.com"
                    />
                  ) : (
                    <a href={`mailto:${c.email}`} className="brslide__outro-contact-email">{c.email}</a>
                  )}
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
      {page.type === 'cover' && (() => {
        const brandSuffix = brandEn
          ? brandEn.charAt(0).toUpperCase() + brandEn.slice(1)
          : brandName
        const titlePrefix = (local.title ?? '').replace(/\s*_\s*.*$/, '').trimEnd()
        return (
          <div className="rslide__cover-layer">
            {editMode ? (
              <div className="brslide__cover-title-edit-wrap">
                <ET
                  value={titlePrefix}
                  onChange={v => setLocal(p => ({ ...p, title: v }))}
                  onBlur={commit}
                  placeholder="2026 Q1 시딩 프로젝트 결과 리포트"
                  className="rslide__cover-title-edit"
                />
                <span className="brslide__cover-brand-suffix">_ {brandSuffix}</span>
              </div>
            ) : (
              <div className="rslide__cover-title" style={{ whiteSpace: 'nowrap', maxWidth: 'none' }}>
                {`${titlePrefix} _ ${brandSuffix}`}
              </div>
            )}
          </div>
        )
      })()}

      {/* Content pages */}
      {page.type !== 'cover' && (
        <div className="rslide__content-layer">
          {page.type !== 'review_list' && (
            <ContentHeader content={local} editMode={editMode} onChange={c => setLocal(c)} onBlur={commit} />
          )}

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
                                // Strip ■ from each line start, then clean any mid-line ■ left by backspace merging
                                const clean = v.split('\n').map(l => l.replace(/^■\s*/, '')).join('\n').replace(/■\s?/g, '')
                                setLocal(p => ({ ...p, processSteps: (p.processSteps ?? DEFAULT_STEPS).map((s, j) => j === i ? { ...s, content: clean } : s) }))
                              }}
                              onBlur={commit} placeholder="■ 내용을 입력하세요"
                              className="rslide__ov-step-content-edit" multiline rows={4} />
                          ) : (
                            <div className="rslide__ov-step-content">
                              {step.content.split('\n').filter(Boolean).map((line, li) => (
                                <div key={li} className="rslide__ov-step-bullet">
                                  <span className="rslide__ov-step-bullet-icon">■</span>
                                  <span>{line.replace(/^■\s?/, '')}</span>
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

            const countByPlat = (rws: MonitoringRow[]) => {
              const tiktok = rws.filter(r => platformLabel(r.platform ?? '') === 'TikTok').length
              const instagram = rws.filter(r => platformLabel(r.platform ?? '') === 'Instagram').length
              const magazine = rws.filter(r => platformLabel(r.platform ?? '') === 'Magazine').length
              return { tiktok, instagram, magazine, total: tiktok + instagram + magazine }
            }
            const allBrandRows = reviewRows.filter(r => r.brand !== 'mimuse')
            const autoCtRows = [
              { label: 'Mi Muse 리뷰', ...countByPlat(mimuseRows) },
              { label: '브랜드별 리뷰', ...countByPlat(allBrandRows) },
              { label: `${(brandEn ?? brandName).toUpperCase()} 리뷰`, ...countByPlat(brandRows) },
              { label: '합계', ...countByPlat(reviewRows) },
            ]

            return (
              <div className="brslide__cp">
                <SectionPill>회수율</SectionPill>
                <div className="rslide__cp-recovery">
                  {recoveryCards.map((card, i) => {
                    const isInfluencer = i === 0
                    const isContentCount = i === 2
                    const barPct = isInfluencer && card.pct === 0 ? infPct : card.pct
                    return (
                      <div key={i} className="rslide__cp-card">
                        <div className="rslide__cp-card-header">
                          <div className="rslide__cp-card-label">{card.label}</div>
                          {isContentCount && (
                            <div className="rslide__cp-card-total">{reviewRows.length}건</div>
                          )}
                          {isInfluencer && (
                            <div className="rslide__cp-card-total">{infUploadMap.size}/{infMap.size}명</div>
                          )}
                        </div>
                        {editMode ? (
                          <>
                            <ET value={card.desc}
                              onChange={v => {
                                const updated = recoveryCards.map((c, j) => j === i ? { ...c, desc: v } : c)
                                setLocal(p => ({ ...p, cpRecoveryCards: updated.map(c => `${c.label}|${c.desc}|${c.pct}`).join('\n') }))
                              }}
                              onBlur={commit} placeholder="설명 입력" className="rslide__cp-card-desc-edit" />
                            <ET value={String(card.pct)}
                              onChange={v => {
                                const updated = recoveryCards.map((c, j) => j === i ? { ...c, pct: parseInt(v) || 0 } : c)
                                setLocal(p => ({ ...p, cpRecoveryCards: updated.map(c => `${c.label}|${c.desc}|${c.pct}`).join('\n') }))
                              }}
                              onBlur={commit} placeholder="진행률 (0-100)" className="rslide__cp-card-pct-edit" />
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
                {editMode ? (
                  <div className="brslide__cp-tables">
                    <div className="brslide__cp-table-block">
                      <SectionPill>콘텐츠 종류</SectionPill>
                      <div className="brslide__cp-auto-info">
                        모니터링 콘텐츠 성과 데이터에서 자동으로 불러옵니다.
                      </div>
                    </div>
                    <div className="brslide__cp-table-block">
                      <SectionPill>콘텐츠 성과</SectionPill>
                      <div className="brslide__cp-auto-info">
                        모니터링 콘텐츠 성과 데이터에서 자동으로 불러옵니다.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="brslide__cp-tables">
                    {/* Content type table — auto from monitoring data */}
                    <div className="brslide__cp-table-block">
                      <SectionPill>콘텐츠 종류</SectionPill>
                      <table className="brslide__table">
                        <thead>
                          <tr>
                            <th>구분</th><th>TikTok</th><th>Instagram</th><th>Magazine</th><th>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {autoCtRows.map((row, ri) => {
                            const isTotal = ri === autoCtRows.length - 1
                            const isBrandSpecific = ri === 2
                            return (
                              <tr key={ri} className={isTotal ? 'brslide__table-total' : isBrandSpecific ? 'brslide__table-sub' : ''}>
                                <td style={isBrandSpecific ? { paddingLeft: '1.2cqw', color: '#5a7a8a' } : undefined}>
                                  {row.label}
                                </td>
                                <td>{row.tiktok || '—'}</td>
                                <td>{row.instagram || '—'}</td>
                                <td>{row.magazine || '—'}</td>
                                <td>{row.total}</td>
                              </tr>
                            )
                          })}
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
                    </div>
                  </div>
                )}

                {/* Comment reaction */}
                <div className="brslide__cp-reaction">
                  <SectionPill>{(brandEn ?? brandName).toUpperCase()} 리뷰 콘텐츠 댓글 반응</SectionPill>
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
            const allBrandReviewRows = reviewRows.filter(r => r.brand !== 'mimuse')
            const tableRows = isMimuse ? mimuseRows : allBrandReviewRows
            const offset = local.rlOffset ?? 0
            const pageRows = tableRows.slice(offset, offset + ROWS_PER_PAGE)
            const isBrand = !isMimuse

            return (
              <div className="brslide__rl">
                <div className="rslide__header brslide__rl-custom-header">
                  {editMode ? (
                    <ET value={local.engTitle ?? ''} onChange={v => setLocal(p => ({ ...p, engTitle: v }))} onBlur={commit}
                      placeholder="English title..." className="rslide__eng-edit" />
                  ) : (
                    <div className="rslide__eng">{local.engTitle}</div>
                  )}
                  {editMode ? (
                    <>
                      <ET value={local.korTitle ?? ''} onChange={v => setLocal(p => ({ ...p, korTitle: v }))} onBlur={commit}
                        placeholder="한국어 제목..." className="rslide__kor-edit" />
                      <div className="brslide__rl-subtitle-row">
                        <select
                          value={local.rlSubtitle ?? 'Mi Muse 리뷰'}
                          onChange={e => {
                            const next = { ...local, rlSubtitle: e.target.value, rlOffset: 0 }
                            setLocal(next)
                            onUpdate(next)
                          }}
                          className="brslide__rl-subtitle-select"
                        >
                          <option value="Mi Muse 리뷰">Mi Muse 리뷰</option>
                          <option value="브랜드 개별 리뷰">브랜드 개별 리뷰</option>
                        </select>
                        <div className="brslide__rl-offset-wrap">
                          <span className="brslide__rl-offset-label">시작 행</span>
                          <ET value={String(offset)} onChange={v => setLocal(p => ({ ...p, rlOffset: parseInt(v) || 0 }))}
                            onBlur={commit} className="brslide__rl-offset-edit" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="brslide__rl-kor-inline">
                      <div className="rslide__kor">{local.korTitle}</div>
                      <span className="brslide__rl-subtitle-inline">— {subtitle}</span>
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
              </div>
            )
          })()}

          {/* Best Review grid */}
          {page.type === 'best_review' && (() => {
            const hlRows = mimuseRows
              .sort((a, b) => {
                const aThumb = !!resolveMonitoringThumbnailUrl(a.assets)
                const bThumb = !!resolveMonitoringThumbnailUrl(b.assets)
                if (aThumb !== bThumb) return aThumb ? -1 : 1
                return (b.views || 0) - (a.views || 0)
              })
              .slice(0, 16)
            return (
              <div className="rslide__hl-grid">
                {Array.from({ length: 16 }).map((_, i) => {
                  const r = hlRows[i]
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

          {/* Best Review detail */}
          {page.type === 'best_review_detail' && (() => {
            function parseBrdCard(raw?: string): { rowId: string | null; comment: string } {
              if (!raw) return { rowId: null, comment: '' }
              try {
                const p = JSON.parse(raw)
                if (p && 'rowId' in p) return { rowId: p.rowId ?? null, comment: p.comment ?? '' }
              } catch {}
              const lines = raw.split('\n')
              return { rowId: null, comment: lines.slice(2).join('\n') }
            }
            function setBrdComment(key: 'brdCard1' | 'brdCard2' | 'brdCard3', comment: string) {
              setLocal(p => ({ ...p, [key]: JSON.stringify({ rowId: null, comment }) }))
            }
            const cardKeys = ['brdCard1', 'brdCard2', 'brdCard3'] as const
            const imgKeys  = ['brdCard1Img', 'brdCard2Img', 'brdCard3Img'] as const
            const bestRows = reviewRows.filter(r => r.best_review_picks)
              .sort((a, b) => b.views - a.views)
            return (
              <>
              {editMode && (
                <div className="rslide__brd-note">
                  모니터링 아카이브에서 ★ 베스트 버튼으로 최대 3명을 선택하면 자동으로 채워집니다.
                </div>
              )}
              <div className="rslide__brd-grid">
                {cardKeys.map((key, i) => {
                  const { comment } = parseBrdCard(local[key])
                  const imgKey = imgKeys[i]
                  const picked = bestRows[i] ?? null
                  const handleUrl = picked?.handle ? `https://www.tiktok.com/@${picked.handle.replace(/^@/, '')}` : null
                  return (
                    <div key={i} className="rslide__brd-card">
                      <div className="rslide__brd-media">
                        {editMode ? (
                          <div className="rslide__img-upload-zone" onClick={() => handleImageUpload(imgKey)}>
                            {uploading === imgKey ? (
                              <div className="rslide__img-upload-loading">업로드 중...</div>
                            ) : local[imgKey] ? (
                              <>
                                <img src={local[imgKey]} alt="" referrerPolicy="no-referrer" className="rslide__brd-img" />
                                <div className="rslide__img-upload-overlay">변경</div>
                              </>
                            ) : (
                              <div className="rslide__img-upload-empty">이미지</div>
                            )}
                          </div>
                        ) : local[imgKey] ? (
                          <img src={local[imgKey]} alt="" referrerPolicy="no-referrer" className="rslide__brd-img" />
                        ) : (
                          <div className="rslide__brd-ph">이미지</div>
                        )}
                        {!editMode && picked?.review_link && (
                          <a href={picked.review_link} target="_blank" rel="noopener noreferrer"
                            data-pdf-link={picked.review_link} className="rslide__brd-review-btn">
                            리뷰 보기
                          </a>
                        )}
                      </div>
                      {editMode ? (
                        <div className="rslide__brd-info-edit">
                          <span className="rslide__brd-edit-label">인플루언서</span>
                          <span className="rslide__brd-edit-input rslide__brd-edit-auto">
                            {picked ? `${picked.handle}${picked.followers != null ? ` · ${fmtK(picked.followers)}` : ''}` : '— 베스트 픽 없음 —'}
                          </span>
                          <span className="rslide__brd-edit-label rslide__brd-edit-label--last">댓글 반응</span>
                          <ET value={comment} onChange={v => setBrdComment(key, v)} onBlur={commit}
                            placeholder="댓글 반응 내용..." className="rslide__brd-edit-input rslide__brd-edit-input--area" multiline rows={4} />
                        </div>
                      ) : (
                        <div className="rslide__brd-info">
                          <span className="rslide__brd-label">인플루언서</span>
                          <span className="rslide__brd-value rslide__brd-value--link">
                            {handleUrl
                              ? <a href={handleUrl} target="_blank" rel="noopener noreferrer" data-pdf-link={handleUrl} className="rslide__brd-handle-link">{picked?.handle || '—'}</a>
                              : (picked?.handle || '—')}
                          </span>
                          <span className="rslide__brd-label">팔로워</span>
                          <span className="rslide__brd-value">{fmtK(picked?.followers)}</span>
                          <span className="rslide__brd-label rslide__brd-label--last">댓글 반응</span>
                          <span className="rslide__brd-value rslide__brd-value--desc">{comment || '—'}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              </>
            )
          })()}

          {/* Brand Mention grid — filtered to this brand */}
          {page.type === 'brand_mention' && (() => {
            const bmOvMap: Record<string, string> = (() => {
              try { return JSON.parse(local.bmOverrides ?? '{}') } catch { return {} }
            })()
            return (
              <div className="brslide__bm-grid">
                {Array.from({ length: 12 }).map((_, i) => {
                  const ovKey = String(i)
                  const overrideUrl = bmOvMap[ovKey] ?? null
                  const row = brandRows[i]
                  const autoThumb = row ? resolveMonitoringThumbnailUrl(row.assets) : null
                  const displayUrl = overrideUrl ?? autoThumb
                  if (editMode) {
                    return (
                      <div
                        key={i}
                        className="brslide__bm-thumb rslide__img-upload-zone"
                        onClick={() => handleBmSlotUpload(i, bmOvMap)}
                      >
                        {uploading === `bm_${ovKey}` ? (
                          <div className="rslide__img-upload-loading">...</div>
                        ) : displayUrl ? (
                          <>
                            <img src={displayUrl} alt="" referrerPolicy="no-referrer" className="brslide__bm-img" />
                            <div className="rslide__img-upload-overlay">변경</div>
                          </>
                        ) : (
                          <div className="rslide__img-upload-empty" style={{ fontSize: '0.6cqw' }}>+</div>
                        )}
                      </div>
                    )
                  }
                  return (
                    <div key={i} className="brslide__bm-thumb">
                      {displayUrl
                        ? <img src={displayUrl} alt="" referrerPolicy="no-referrer" className="brslide__bm-img" />
                        : <div className="brslide__bm-ph" />}
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {/* Brand Mention detail — one influencer per slide */}
          {page.type === 'brand_mention_detail' && (() => {
            const statRows: { label: string; key: keyof BrandPageContent; link?: boolean }[] = [
              { label: '인플루언서', key: 'bmdHandle', link: true },
              { label: '팔로워',    key: 'bmdFollowers' },
              { label: '조회수',    key: 'bmdViews' },
              { label: '좋아요',    key: 'bmdLikes' },
              { label: '댓글',     key: 'bmdComments' },
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

      {editMode && (
        <div className="rslide__edit-controls">
          <div className="rslide__edit-badge">편집 중</div>
          {onDelete && (
            <button type="button" className="rslide__edit-delete" onClick={onDelete} title="페이지 삭제">
              <X size={10} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────

const SHARED_TYPES = new Set<string>(['cover', 'project_overview'])

export default function BrandReportSlides({
  pages,
  rows,
  brandName,
  brandEn,
  editMode,
  onUpdate,
  sharedPages = [],
  onUpdateShared,
  onDelete,
}: {
  pages: BrandReportPage[]
  rows: MonitoringRow[]
  brandName: string
  brandEn?: string
  editMode: boolean
  onUpdate: (page: BrandReportPage) => Promise<void>
  sharedPages?: BrandReportPage[]
  onUpdateShared?: (page: BrandReportPage) => Promise<void>
  onDelete?: (pageId: string) => void
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
      {sorted.map(page => {
        const sharedPage = SHARED_TYPES.has(page.type) ? sharedPages.find(s => s.type === page.type) : undefined
        const effectivePage = sharedPage ?? page
        const handleUpdate = sharedPage && onUpdateShared
          ? (content: BrandPageContent) => onUpdateShared({ ...sharedPage, content })
          : (content: BrandPageContent) => onUpdate({ ...page, content })
        const handleDelete = sharedPage ? undefined : () => onDelete?.(page.id)
        return (
          <BrandSlide
            key={page.id}
            page={effectivePage}
            brandName={brandName}
            brandEn={brandEn}
            editMode={editMode}
            rows={rows}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        )
      })}
    </div>
  )
}
