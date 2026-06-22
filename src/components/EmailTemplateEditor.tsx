import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Link2, Mail } from 'lucide-react'
import Spinner from '@/components/Spinner'
import Modal from '@/components/Modal'
import ConfirmToast, { useConfirmToast } from '@/components/ConfirmToast'
import { useToast } from '@/contexts/ToastContext'
import { gasPost } from '@/lib/api'
import {
  fetchEmailTemplates,
  saveEmailTemplate,
  createEmailTemplate,
  deleteEmailTemplate,
  type EmailTemplate,
  type EmailTemplateDomain,
} from '@/lib/email-templates'
import { getEmailTemplateUiConfig } from '@/lib/email-template-ui-config'
import {
  getSelectedText,
  insertMarkdownLink,
  renderEmailBodyPreview,
} from '@/lib/email-body-format'
import { formatKstDateTime } from '@/lib/utils'
import { previewDefaultSignatureHtml, syncSignatureLogoAndReset } from '@/lib/email-signature-sync'

const LOGO_SYNC_KEY = 'outreach-logo-supabase-v3'

function renderWithDummy(
  text: string,
  dummyValues: Record<string, { value: string; color: string }>,
): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let remaining = text
  let key = 0
  while (remaining.length > 0) {
    let earliest = -1
    let earliestTag = ''
    for (const tag of Object.keys(dummyValues)) {
      const idx = remaining.indexOf(tag)
      if (idx !== -1 && (earliest === -1 || idx < earliest)) {
        earliest = idx
        earliestTag = tag
      }
    }
    if (earliest === -1) {
      parts.push(remaining)
      break
    }
    if (earliest > 0) parts.push(remaining.slice(0, earliest))
    const d = dummyValues[earliestTag]
    parts.push(
      <span
        key={key++}
        style={{
          background: d.color + '18',
          color: d.color,
          fontWeight: 700,
          borderRadius: 4,
          padding: '0 3px',
          fontSize: '0.95em',
        }}
      >
        {d.value}
      </span>,
    )
    remaining = remaining.slice(earliest + earliestTag.length)
  }
  return parts
}

function insertAtCursor(
  el: HTMLInputElement | HTMLTextAreaElement | null,
  current: string,
  placeholder: string,
  setValue: (next: string) => void,
) {
  if (!el) {
    setValue(current + placeholder)
    return
  }
  const start = el.selectionStart ?? current.length
  const end = el.selectionEnd ?? current.length
  const next = current.slice(0, start) + placeholder + current.slice(end)
  setValue(next)
  requestAnimationFrame(() => {
    el.selectionStart = el.selectionEnd = start + placeholder.length
    el.focus()
  })
}

interface EmailTemplateEditorProps {
  domain: EmailTemplateDomain
}

export default function EmailTemplateEditor({ domain }: EmailTemplateEditorProps) {
  const config = getEmailTemplateUiConfig(domain)
  const { showToast } = useToast()
  const confirmToast = useConfirmToast()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [name, setName] = useState('')
  const [category, setCategory] = useState(config.defaultCategory)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set())
  const [isEditing, setIsEditing] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkLabel, setLinkLabel] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [signature, setSignature] = useState('')
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  const titleWarnAt = config.titleMaxLength - 5
  const titleMax = config.titleMaxLength

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await fetchEmailTemplates(domain)
      setTemplates(rows)
      setSelectedIdx(i => Math.min(i, Math.max(0, rows.length - 1)))
    } catch {
      showToast('템플릿을 불러오지 못했습니다', 'error')
    } finally {
      setLoading(false)
    }
  }, [domain, showToast])

  useEffect(() => { reload() }, [reload])

  useEffect(() => {
    gasPost<{ ok?: boolean; signature?: string }>({ action: 'getEmailSignature' })
      .then(res => setSignature(res.signature || previewDefaultSignatureHtml()))
      .catch(() => setSignature(previewDefaultSignatureHtml()))

    if (localStorage.getItem(LOGO_SYNC_KEY)) return
    syncSignatureLogoAndReset()
      .then(sig => {
        localStorage.setItem(LOGO_SYNC_KEY, '1')
        setSignature(sig)
      })
      .catch(() => { /* bucket/GAS not ready — upload manually if clip persists */ })
  }, [])

  useEffect(() => {
    const t = templates[selectedIdx]
    if (t) {
      setName(t.name)
      setCategory(t.category || config.defaultCategory)
      setTitle(t.title)
      setBody(t.body)
    }
  }, [selectedIdx, templates, config.defaultCategory])

  function selectTemplate(i: number) {
    setSelectedIdx(i)
    setIsEditing(false)
    setShowPreviewModal(false)
  }

  function openEditMode() {
    setIsEditing(true)
    setShowPreviewModal(false)
  }

  function previewCategoryStyle(cat: string) {
    return config.categoryColors[cat] ?? config.categoryColors['기타']
  }

  function renderEmailPreview(previewTitle: string, previewBody: string) {
    return (
      <div
        style={{
          background: 'var(--gray-1)',
          borderRadius: 10,
          padding: '14px 18px',
          border: '1px solid var(--gray-2)',
        }}
      >
        <div style={{ fontSize: 10, color: 'var(--gray-4)', marginBottom: 6 }}>
          {config.previewSender}
        </div>
        {previewTitle ? (
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-8)', marginBottom: 10 }}>
            {renderWithDummy(previewTitle, config.dummyValues)}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--gray-4)', marginBottom: 10, fontStyle: 'italic' }}>
            (제목 없음)
          </div>
        )}
        {previewBody ? (
          <div
            style={{
              fontSize: 13,
              color: 'var(--gray-7)',
              lineHeight: 1.9,
              whiteSpace: 'pre-wrap',
            }}
          >
            {renderEmailBodyPreview(previewBody, config.dummyValues)}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--gray-4)', fontStyle: 'italic' }}>본문 없음</div>
        )}
        {signature && (
          <div
            style={{ marginTop: 16, fontSize: 13, color: 'var(--gray-7)', lineHeight: 1.6 }}
            dangerouslySetInnerHTML={{ __html: signature }}
          />
        )}
      </div>
    )
  }

  function openLinkModal() {
    const selected = getSelectedText(bodyRef.current, body)
    setLinkLabel(selected)
    setLinkUrl('')
    setShowLinkModal(true)
  }

  function confirmInsertLink() {
    const label = linkLabel.trim()
    const url = linkUrl.trim()
    if (!label || !url) {
      showToast('링크 텍스트와 URL을 모두 입력하세요', 'error')
      return
    }
    insertMarkdownLink(bodyRef.current, body, label, url, setBody)
    setShowLinkModal(false)
    setLinkLabel('')
    setLinkUrl('')
  }

  async function save() {
    const t = templates[selectedIdx]
    if (!t) return
    setSaving(true)
    try {
      const updated = await saveEmailTemplate({ ...t, name, category, title, body })
      setTemplates(prev => prev.map(row => (row.id === updated.id ? updated : row)))
      showToast('저장되었습니다', 'success')
      setIsEditing(false)
      setShowPreviewModal(false)
    } catch {
      showToast('저장에 실패했습니다', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function createNew() {
    setSaving(true)
    try {
      const created = await createEmailTemplate(domain, {
        name: '새 템플릿',
        category: '기타',
        title: '',
        body: '',
      })
      setTemplates(prev => [...prev, created])
      setSelectedIdx(templates.length)
      setIsEditing(true)
      setShowPreviewModal(false)
      showToast('템플릿이 추가되었습니다', 'success')
    } catch {
      showToast('템플릿 추가에 실패했습니다', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function deleteTpl() {
    const t = templates[selectedIdx]
    if (!t || templates.length <= 1) return
    setSaving(true)
    try {
      await deleteEmailTemplate(t.id)
      const next = templates.filter(row => row.id !== t.id)
      setTemplates(next)
      setSelectedIdx(0)
      setIsEditing(false)
      showToast('삭제되었습니다', 'success')
    } catch {
      showToast('삭제에 실패했습니다', 'error')
    } finally {
      setSaving(false)
    }
  }

  function requestDeleteTpl() {
    const t = templates[selectedIdx]
    if (!t || templates.length <= 1) return
    confirmToast.show(`"${name || t.name}" 템플릿을 삭제하시겠습니까?`, () => { void deleteTpl() })
  }

  function toggleCat(cat: string) {
    setCollapsedCats(prev => {
      const next = new Set(prev)
      if (prev.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const categoryStyle = config.categoryColors[category] ?? config.categoryColors['기타']
  const selectedTemplate = templates[selectedIdx]
  const updatedAtLabel = formatKstDateTime(selectedTemplate?.updated_at)

  if (loading) {
    return (
      <div className="page page--fill" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Spinner />
        <span style={{ fontSize: 13, color: 'var(--gray-5)' }}>템플릿 불러오는 중...</span>
      </div>
    )
  }

  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">
          {config.bannerDeco === 'mail-icon' ? <Mail size={28} /> : '✉️'}
        </span>
        <div>
          <div className="page-banner-title">{config.bannerTitle}</div>
          <div className="page-banner-desc">{config.bannerDesc}</div>
        </div>
        <div className="page-banner-actions">
          <button
            type="button"
            className="page-banner-btn page-banner-btn--secondary"
            onClick={createNew}
            disabled={saving}
          >
            + 새 템플릿
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start' }}>
        <div
          style={{
            background: 'var(--gray-0)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--gray-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--gray-5)',
                textTransform: 'uppercase',
                letterSpacing: '.5px',
              }}
            >
              템플릿 목록
            </span>
            <span style={{ fontSize: 11, color: 'var(--gray-4)' }}>{templates.length}개</span>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {config.categories.map(cat => {
              const catTemplates = templates
                .map((t, i) => ({ t, i }))
                .filter(({ t }) => (t.category || '기타') === cat)
              if (catTemplates.length === 0) return null
              const c = config.categoryColors[cat] ?? config.categoryColors['기타']
              const collapsed = collapsedCats.has(cat)
              return (
                <div key={cat}>
                  <div
                    onClick={() => toggleCat(cat)}
                    style={{
                      padding: '10px 18px',
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '.8px',
                      color: c.color,
                      background: c.bg,
                      borderBottom: '1px solid var(--gray-2)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>
                      {cat}{' '}
                      <span style={{ fontWeight: 400, opacity: 0.7 }}>({catTemplates.length})</span>
                    </span>
                    <span style={{ fontSize: 10 }}>{collapsed ? '▸' : '▾'}</span>
                  </div>
                  {!collapsed &&
                    catTemplates.map(({ t, i }) => (
                      <div
                        key={t.id}
                        onClick={() => selectTemplate(i)}
                        style={{
                          padding: '14px 18px',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--gray-2)',
                          background: selectedIdx === i ? 'var(--blue-lt)' : '#fff',
                          borderLeft: selectedIdx === i ? `3px solid ${c.color}` : '3px solid transparent',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: 'var(--gray-8)',
                            marginBottom: 3,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {t.name}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--gray-4)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {t.title || '(제목 없음)'}
                        </div>
                      </div>
                    ))}
                </div>
              )
            })}
          </div>
          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--gray-2)' }}>
            <button
              type="button"
              onClick={createNew}
              disabled={saving}
              style={{
                width: '100%',
                padding: '7px',
                background: 'var(--gray-1)',
                border: '1px dashed var(--gray-3)',
                borderRadius: 8,
                fontSize: 12,
                color: 'var(--gray-6)',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              + 새 템플릿
            </button>
          </div>
        </div>

        <div
          style={{
            background: 'var(--gray-0)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow)',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            minHeight: 480,
          }}
        >
          {!isEditing ? (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
                    미리보기
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-8)', marginBottom: 8 }}>
                    {name || '(이름 없음)'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: 20,
                        background: previewCategoryStyle(category).bg,
                        color: previewCategoryStyle(category).color,
                        border: `1px solid ${previewCategoryStyle(category).color}44`,
                      }}
                    >
                      {category}
                    </span>
                    {updatedAtLabel && (
                      <span style={{ fontSize: 11, color: 'var(--gray-4)' }}>
                        마지막 수정 · {updatedAtLabel}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openEditMode}
                  style={{
                    padding: '6px 16px',
                    background: 'var(--teal-dk)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 12,
                    cursor: 'pointer',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  편집
                </button>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {renderEmailPreview(title, body)}
                <div style={{ fontSize: 10, color: 'var(--gray-4)', marginTop: 8 }}>
                  치환 구문은 발송 시 자동 적용됩니다
                </div>
              </div>
            </>
          ) : (
            <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-8)' }}>템플릿 편집</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowPreviewModal(true)}
                style={{
                  padding: '6px 14px',
                  background: 'var(--gray-1)',
                  color: 'var(--gray-7)',
                  border: '1px solid var(--gray-3)',
                  borderRadius: 8,
                  fontSize: 12,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                미리보기
              </button>
              <button
                type="button"
                onClick={requestDeleteTpl}
                disabled={templates.length <= 1 || saving}
                style={{
                  padding: '6px 14px',
                  background: '#fff0f0',
                  color: '#c00',
                  border: '1px solid #fca5a5',
                  borderRadius: 8,
                  fontSize: 12,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                삭제
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                style={{
                  padding: '6px 16px',
                  background: 'var(--teal-dk)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 12,
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
            <div>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--gray-5)',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                템플릿명
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value.slice(0, 30))}
                maxLength={30}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${name.length >= 27 ? '#f59e0b' : 'var(--gray-3)'}`,
                  borderRadius: 8,
                  fontSize: 13,
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
              <div
                style={{
                  fontSize: 10,
                  color: name.length >= 27 ? '#d97706' : 'var(--gray-4)',
                  textAlign: 'right',
                  marginTop: 3,
                }}
              >
                {name.length}/30
              </div>
            </div>
            <div>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--gray-5)',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                카테고리
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                style={{
                  padding: '8px 10px',
                  border: `1px solid ${categoryStyle.color}55`,
                  borderRadius: 8,
                  fontSize: 12,
                  outline: 'none',
                  fontFamily: 'inherit',
                  background: categoryStyle.bg,
                  color: categoryStyle.color,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {config.categories.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 4,
              }}
            >
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)' }}>이메일 제목</label>
              <div style={{ display: 'flex', gap: 5 }}>
                {config.titlePlaceholders.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => insertAtCursor(titleRef.current, title, p, setTitle)}
                    style={{
                      fontSize: 10,
                      padding: '2px 8px',
                      background: 'var(--gray-1)',
                      border: '1px solid var(--gray-3)',
                      borderRadius: 5,
                      cursor: 'pointer',
                      color: 'var(--gray-7)',
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <input
              ref={titleRef}
              value={title}
              onChange={e => setTitle(e.target.value.slice(0, titleMax))}
              maxLength={titleMax}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: `1px solid ${title.length >= titleWarnAt ? '#f59e0b' : 'var(--gray-3)'}`,
                borderRadius: 8,
                fontSize: 13,
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            <div
              style={{
                fontSize: 10,
                color: title.length >= titleWarnAt ? '#d97706' : 'var(--gray-4)',
                textAlign: 'right',
                marginTop: 3,
              }}
            >
              {title.length}/{titleMax}
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 4,
              }}
            >
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)' }}>이메일 본문</label>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={openLinkModal}
                  style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    background: '#eff6ff',
                    border: '1px solid #93c5fd',
                    borderRadius: 5,
                    cursor: 'pointer',
                    color: '#1d4ed8',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontWeight: 600,
                  }}
                >
                  <Link2 size={11} />
                  링크 삽입
                </button>
                {config.bodyPlaceholders.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => insertAtCursor(bodyRef.current, body, p, setBody)}
                    style={{
                      fontSize: 10,
                      padding: '2px 8px',
                      background: 'var(--gray-1)',
                      border: '1px solid var(--gray-3)',
                      borderRadius: 5,
                      cursor: 'pointer',
                      color: 'var(--gray-7)',
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              ref={bodyRef}
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={14}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--gray-3)',
                borderRadius: 8,
                fontSize: 13,
                fontFamily: 'inherit',
                outline: 'none',
                resize: 'vertical',
                lineHeight: 1.7,
              }}
            />
            <div style={{ fontSize: 10, color: 'var(--gray-4)', marginTop: 6, lineHeight: 1.5 }}>
              링크 수정: <code style={{ fontSize: 10 }}>[표시 텍스트](URL)</code> 형식에서 대괄호 안 글자를 바꾸면 링크 이름이 변경됩니다.
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--gray-2)', paddingTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)' }}>이메일 서명</label>
              <span
                style={{
                  fontSize: 11,
                  padding: '4px 10px',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #93c5fd',
                  borderRadius: 6,
                  fontWeight: 600,
                  userSelect: 'none',
                }}
              >
                기본 서명 적용
              </span>
            </div>
            <div
              style={{ fontSize: 13, lineHeight: 1.6 }}
              dangerouslySetInnerHTML={{ __html: signature || previewDefaultSignatureHtml() }}
            />
          </div>
            </>
          )}
        </div>
      </div>

      <Modal
        open={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        title="링크 삽입"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              type="button"
              onClick={() => setShowLinkModal(false)}
              style={{
                padding: '8px 16px',
                background: 'var(--gray-1)',
                border: '1px solid var(--gray-3)',
                borderRadius: 8,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              취소
            </button>
            <button
              type="button"
              onClick={confirmInsertLink}
              style={{
                padding: '8px 16px',
                background: 'var(--teal-dk)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              삽입
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-7)', display: 'block', marginBottom: 6 }}>
              표시 텍스트
            </label>
            <input
              value={linkLabel}
              onChange={e => setLinkLabel(e.target.value)}
              placeholder="예: 제안서 보기"
              autoFocus
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--gray-3)',
                borderRadius: 8,
                fontSize: 13,
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-7)', display: 'block', marginBottom: 6 }}>
              URL
            </label>
            <input
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              placeholder="https://"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--gray-3)',
                borderRadius: 8,
                fontSize: 13,
                outline: 'none',
                fontFamily: 'inherit',
              }}
              onKeyDown={e => { if (e.key === 'Enter') confirmInsertLink() }}
            />
          </div>
          <div style={{ fontSize: 11, color: 'var(--gray-4)', lineHeight: 1.5 }}>
            본문에 <code>[표시 텍스트](URL)</code> 형식으로 저장됩니다. 나중에 대괄호 안 글자만 수정하면 링크 이름을 바꿀 수 있습니다.
          </div>
        </div>
      </Modal>

      <Modal
        open={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title="미리보기"
        size="lg"
      >
        {renderEmailPreview(title, body)}
        <div style={{ fontSize: 11, color: 'var(--gray-4)', marginTop: 12 }}>
          치환 구문은 발송 시 자동 적용됩니다
        </div>
      </Modal>

      <ConfirmToast state={confirmToast.state} onHide={confirmToast.hide} />
    </div>
  )
}
