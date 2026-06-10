import React, { useState, useEffect } from 'react'

const CATEGORIES = ['첫 컨택', '리마인더', '수락/협의', '기타'] as const
type Category = typeof CATEGORIES[number]

const CATEGORY_COLORS: Record<Category, { bg: string; color: string }> = {
  '첫 컨택':   { bg: '#eff6ff', color: '#1d4ed8' },
  '리마인더':  { bg: '#fef9c3', color: '#a16207' },
  '수락/협의': { bg: '#f0fdf4', color: '#15803d' },
  '기타':      { bg: '#f3f4f6', color: '#6b7280' },
}

const DEFAULT_TEMPLATES = [
  {
    id: 'brand_temp_01',
    name: '협업 제안 (첫 컨택)',
    category: '첫 컨택' as Category,
    subject: '[MiMuse] {{브랜드명}} 담당자님, 미뮤즈 협업 제안드립니다',
    body: `안녕하세요 {{담당자}}님,\n\n프리미엄 뷰티 브랜드 MiMuse(미뮤즈) 글로벌 커뮤니케이션 팀입니다.\n\n{{브랜드명}}의 제품과 미뮤즈가 함께 시너지를 낼 수 있을 것이라 생각하여 협업을 제안드립니다.\n\n자세한 내용은 아래와 같으며, 검토 후 회신 주시면 감사하겠습니다.\n\n미뮤즈 드림.`,
  },
  {
    id: 'brand_temp_02',
    name: '협업 리마인더',
    category: '리마인더' as Category,
    subject: '[MiMuse] {{브랜드명}} 담당자님, 이전 협업 제안 관련 재문의',
    body: `안녕하세요 {{담당자}}님, MiMuse 글로벌 팀입니다.\n\n이전에 발송드린 협업 제안 메일 관련하여 재문의 드립니다.\n\n{{브랜드명}}과의 협업에 여전히 큰 기대를 가지고 있으며, 편하실 때 회신 주시면 감사하겠습니다.\n\n감사합니다.`,
  },
]

const STORAGE_KEY = 'mm_brand_email_templates'

function loadTemplates() {
  try { const v = localStorage.getItem(STORAGE_KEY); return v ? JSON.parse(v) : DEFAULT_TEMPLATES } catch { return DEFAULT_TEMPLATES }
}
function saveTemplates(t: typeof DEFAULT_TEMPLATES) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(t))
}

const PLACEHOLDERS = ['{{브랜드명}}', '{{담당자}}', '{{이메일}}', '{{홈페이지}}']

const DUMMY: Record<string, { value: string; color: string }> = {
  '{{브랜드명}}':  { value: 'AmorePacific',        color: '#a07800' },
  '{{담당자}}':    { value: '김민지',               color: '#0369a1' },
  '{{이메일}}':    { value: 'brand@example.com',    color: '#b45309' },
  '{{홈페이지}}':  { value: 'https://example.com',  color: '#065f46' },
}

function renderWithDummy(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let remaining = text; let key = 0
  while (remaining.length > 0) {
    let earliest = -1, earliestTag = ''
    for (const tag of Object.keys(DUMMY)) {
      const idx = remaining.indexOf(tag)
      if (idx !== -1 && (earliest === -1 || idx < earliest)) { earliest = idx; earliestTag = tag }
    }
    if (earliest === -1) { parts.push(remaining); break }
    if (earliest > 0) parts.push(remaining.slice(0, earliest))
    const d = DUMMY[earliestTag]
    parts.push(
      <span key={key++} style={{ background: d.color + '18', color: d.color, fontWeight: 700, borderRadius: 4, padding: '0 3px', fontSize: '0.95em' }}>
        {d.value}
      </span>
    )
    remaining = remaining.slice(earliest + earliestTag.length)
  }
  return parts
}

export default function BrandTemplate() {
  const [templates,    setTemplates]    = useState(loadTemplates)
  const [selectedIdx,  setSelectedIdx]  = useState(0)
  const [name,         setName]         = useState('')
  const [category,     setCategory]     = useState<Category>('첫 컨택')
  const [subject,      setSubject]      = useState('')
  const [body,         setBody]         = useState('')
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set())

  useEffect(() => {
    const t = templates[selectedIdx] as any
    if (t) { setName(t.name); setCategory(t.category || '기타'); setSubject(t.subject); setBody(t.body) }
  }, [selectedIdx, templates])

  function save() {
    const updated = templates.map((t: any, i: number) => i === selectedIdx ? { ...t, name, category, subject, body } : t)
    setTemplates(updated); saveTemplates(updated)
  }

  function createNew() {
    const next = [...templates, { id: 'brand_temp_' + Date.now(), name: '새 템플릿', category: '기타' as Category, subject: '', body: '' }]
    setTemplates(next); saveTemplates(next); setSelectedIdx(next.length - 1)
  }

  function deleteTpl() {
    if (templates.length <= 1) return
    const next = templates.filter((_: any, i: number) => i !== selectedIdx)
    setTemplates(next); saveTemplates(next); setSelectedIdx(0)
  }

  const bodyRef = React.useRef<HTMLTextAreaElement>(null)
  function insertPlaceholder(p: string) {
    const el = bodyRef.current
    if (!el) { setBody(prev => prev + p); return }
    const start = el.selectionStart ?? body.length
    const end   = el.selectionEnd   ?? body.length
    const next  = body.slice(0, start) + p + body.slice(end)
    setBody(next)
    requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = start + p.length; el.focus() })
  }

  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">✉️</span>
        <div>
          <div className="page-banner-title">브랜드 템플릿 관리</div>
          <div className="page-banner-desc">브랜드 컨택 이메일 템플릿을 작성하고 관리합니다.</div>
        </div>
        <div className="page-banner-actions">
          <button className="page-banner-btn page-banner-btn--secondary" onClick={createNew}>+ 새 템플릿</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20 }}>

        {/* Sidebar — template list */}
        <div style={{ background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px' }}>템플릿 목록</span>
            <span style={{ fontSize: 11, color: 'var(--gray-4)' }}>{templates.length}개</span>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {CATEGORIES.map(cat => {
              const catTemplates = templates.map((t: any, i: number) => ({ t, i })).filter(({ t }: { t: any }) => (t.category || '기타') === cat)
              if (catTemplates.length === 0) return null
              const c = CATEGORY_COLORS[cat]
              const collapsed = collapsedCats.has(cat)
              return (
                <div key={cat}>
                  <div
                    onClick={() => setCollapsedCats(prev => { const next = new Set(prev); collapsed ? next.delete(cat) : next.add(cat); return next })}
                    style={{ padding: '10px 18px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: c.color, background: c.bg, borderBottom: '1px solid var(--gray-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{cat} <span style={{ fontWeight: 400, opacity: 0.7 }}>({catTemplates.length})</span></span>
                    <span style={{ fontSize: 10 }}>{collapsed ? '▸' : '▾'}</span>
                  </div>
                  {!collapsed && catTemplates.map(({ t, i }: { t: any; i: number }) => (
                    <div key={t.id} onClick={() => setSelectedIdx(i)}
                      style={{
                        padding: '14px 18px', cursor: 'pointer', borderBottom: '1px solid var(--gray-2)',
                        background: selectedIdx === i ? 'var(--blue-lt)' : '#fff',
                        borderLeft: selectedIdx === i ? `3px solid ${c.color}` : '3px solid transparent',
                      }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-8)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--gray-4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.subject || '(제목 없음)'}</div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--gray-2)' }}>
            <button onClick={createNew}
              style={{ width: '100%', padding: '7px', background: 'var(--gray-1)', border: '1px dashed var(--gray-3)', borderRadius: 8, fontSize: 12, color: 'var(--gray-6)', cursor: 'pointer', fontWeight: 600 }}>
              + 새 템플릿
            </button>
          </div>
        </div>

        {/* Editor */}
        <div style={{ background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-8)' }}>템플릿 편집</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={deleteTpl} disabled={templates.length <= 1}
                style={{ padding: '6px 14px', background: '#fff0f0', color: '#c00', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                삭제
              </button>
              <button onClick={save}
                style={{ padding: '6px 16px', background: 'var(--teal-dk)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
                저장
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', display: 'block', marginBottom: 4 }}>서식 관리명</label>
              <input value={name} onChange={e => setName(e.target.value.slice(0, 30))} maxLength={30}
                style={{ width: '100%', padding: '8px 12px', border: `1px solid ${name.length >= 27 ? '#f59e0b' : 'var(--gray-3)'}`, borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
              <div style={{ fontSize: 10, color: name.length >= 27 ? '#d97706' : 'var(--gray-4)', textAlign: 'right', marginTop: 3 }}>{name.length}/30</div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', display: 'block', marginBottom: 4 }}>카테고리</label>
              <select value={category} onChange={e => setCategory(e.target.value as Category)}
                style={{ padding: '8px 10px', border: `1px solid ${CATEGORY_COLORS[category].color}55`, borderRadius: 8, fontSize: 12, outline: 'none', fontFamily: 'inherit', background: CATEGORY_COLORS[category].bg, color: CATEGORY_COLORS[category].color, fontWeight: 700, cursor: 'pointer' }}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', display: 'block', marginBottom: 4 }}>이메일 제목</label>
            <input value={subject} onChange={e => setSubject(e.target.value.slice(0, 50))} maxLength={50}
              style={{ width: '100%', padding: '8px 12px', border: `1px solid ${subject.length >= 45 ? '#f59e0b' : 'var(--gray-3)'}`, borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
            <div style={{ fontSize: 10, color: subject.length >= 45 ? '#d97706' : 'var(--gray-4)', textAlign: 'right', marginTop: 3 }}>{subject.length}/50</div>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)' }}>이메일 본문</label>
              <div style={{ display: 'flex', gap: 5 }}>
                {PLACEHOLDERS.map(p => (
                  <button key={p} onClick={() => insertPlaceholder(p)}
                    style={{ fontSize: 10, padding: '2px 8px', background: 'var(--gray-1)', border: '1px solid var(--gray-3)', borderRadius: 5, cursor: 'pointer', color: 'var(--gray-7)' }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <textarea ref={bodyRef} value={body} onChange={e => setBody(e.target.value)} rows={14}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.7 }} />
          </div>

          {/* Preview */}
          {(subject || body) && (
            <div style={{ borderTop: '1px solid var(--gray-2)', paddingTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>미리보기</div>
              <div style={{ background: 'var(--gray-1)', borderRadius: 10, padding: '14px 18px', border: '1px solid var(--gray-2)' }}>
                <div style={{ fontSize: 10, color: 'var(--gray-4)', marginBottom: 6 }}>보내는 사람 · MiMuse Team &lt;beautyproject@cranecomm.com&gt;</div>
                {subject && <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-8)', marginBottom: 10 }}>{renderWithDummy(subject)}</div>}
                {body && <div style={{ fontSize: 13, color: 'var(--gray-7)', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{renderWithDummy(body)}</div>}
              </div>
              <div style={{ fontSize: 10, color: 'var(--gray-4)', marginTop: 6 }}>치환 구문은 발송 시 자동 적용됩니다</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
