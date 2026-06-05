import React, { useState, useEffect } from 'react'

const CATEGORIES = ['첫 컨택', '리마인더', '수락/협의', '기타'] as const
type Category = typeof CATEGORIES[number]

const CATEGORY_COLORS: Record<Category, { bg: string; color: string }> = {
  '첫 컨택':  { bg: '#eff6ff', color: '#1d4ed8' },
  '리마인더': { bg: '#fef9c3', color: '#a16207' },
  '수락/협의':{ bg: '#f0fdf4', color: '#15803d' },
  '기타':     { bg: '#f3f4f6', color: '#6b7280' },
}

const DEFAULT_TEMPLATES = [
  {
    id: 'temp_01',
    name: '신제품 기프트 제안',
    category: '첫 컨택' as Category,
    subject: '[MiMuse] {{이름}}님, 미뮤즈 신제품 VIP 기프트 증정 제안',
    body: `안녕하세요 {{이름}}님!\n프리미엄 뷰티 브랜드 MiMuse(미뮤즈) 글로벌 커뮤니케이션 팀입니다.\n\n평소 {{이름}}님의 TikTok 채널({{핸들}})을 통해 전달하시는 세련된 감성과 독창적인 리뷰 스타일에 깊은 인상을 받았습니다.\n\n이번 론칭하는 수분 세럼 패키지를 맞이하여 기프팅 선물을 전달드리고자 메일 드립니다.\n\n배송을 위해 성함, 연락처, 배송 정보를 회신 주시면 조속히 발송하겠습니다.\n\nMiMuse 드림.`,
  },
  {
    id: 'temp_02',
    name: '1차 기프트 리마인더',
    category: '리마인더' as Category,
    subject: '[MiMuse] {{이름}}님, 이전 기프트 패키지 증정 관련 재문의',
    body: `안녕하세요 {{이름}}님, MiMuse 글로벌 팀입니다.\n\n이전 메일을 통해 전달해 드렸던 신제품 선물 기프팅 제안에 대해 재문의 드립니다.\n\n{{이름}}님 채널({{핸들}})이 저희 제품과 잘 어울릴 것 같아 특별히 연락드립니다.\n\n배송 정보를 회신 주시면 즉시 절차를 진행하겠습니다.\n감사합니다.`,
  },
]

function loadTemplates() {
  try { const v = localStorage.getItem('mm_email_templates'); return v ? JSON.parse(v) : DEFAULT_TEMPLATES } catch { return DEFAULT_TEMPLATES }
}
function saveTemplates(t: typeof DEFAULT_TEMPLATES) {
  localStorage.setItem('mm_email_templates', JSON.stringify(t))
}

export default function ContactTemplate() {
  const [templates, setTemplates] = useState(loadTemplates)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<Category>('첫 컨택')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set())

  useEffect(() => {
    const t = templates[selectedIdx] as any
    if (t) { setName(t.name); setCategory(t.category || '기타'); setSubject(t.subject); setBody(t.body) }
  }, [selectedIdx, templates])

  const DUMMY: Record<string, { value: string; color: string }> = {
    '{{이름}}':   { value: 'MiMuse Creator',       color: '#a07800' },
    '{{핸들}}':   { value: '@mimuse_creator',       color: '#0369a1' },
    '{{이메일}}': { value: 'creator@mimuse.com',    color: '#b45309' },
    '{{팔로워}}': { value: '42,800',                color: '#065f46' },
    '{{조회수}}': { value: '18,500',                color: '#be123c' },
  }

  function renderWithDummy(text: string) {
    const parts: React.ReactNode[] = []
    let remaining = text
    let key = 0
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

  function save() {
    const updated = templates.map((t: any, i: number) => i === selectedIdx ? { ...t, name, category, subject, body } : t)
    setTemplates(updated)
    saveTemplates(updated)
  }

  function createNew() {
    const next = [...templates, { id: 'temp_' + Date.now(), name: '새 템플릿', category: '기타', subject: '', body: '' }]
    setTemplates(next)
    saveTemplates(next)
    setSelectedIdx(next.length - 1)
  }

  function deleteTpl() {
    if (templates.length <= 1) return
    const next = templates.filter((_: any, i: number) => i !== selectedIdx)
    setTemplates(next)
    saveTemplates(next)
    setSelectedIdx(0)
  }

  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">✉️</span>
        <div>
          <div className="page-banner-title">템플릿 관리</div>
          <div className="page-banner-desc">아웃리치 이메일 템플릿을 작성하고 관리합니다.</div>
        </div>
        <div className="page-banner-actions">
          <button className="page-banner-btn page-banner-btn--secondary" onClick={createNew}>+ 새 템플릿</button>
        </div>
      </div>

      {/* Preview popup */}
      {showPreview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowPreview(false)}>
          <div style={{ background: '#fff', borderRadius: 16, width: 560, maxWidth: '90vw', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}>
            {/* Popup header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--gray-2)' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-8)' }}>미리보기</span>
              <button onClick={() => setShowPreview(false)}
                style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'var(--gray-2)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            {/* Email frame */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <div style={{ background: 'var(--gray-1)', padding: '12px 20px', borderBottom: '1px solid var(--gray-2)' }}>
                <div style={{ fontSize: 10, color: 'var(--gray-4)', marginBottom: 3 }}>{'보내는 사람 · MiMuse Team <beautyproject@cranecomm.com>'}</div>
                <div style={{ fontSize: 10, color: 'var(--gray-4)', marginBottom: 8 }}>
                  받는 사람 · <span style={{ color: DUMMY['{{이름}}'].color, fontWeight: 700 }}>{DUMMY['{{이름}}'].value}</span>
                  {' <'}<span style={{ color: DUMMY['{{이메일}}'].color, fontWeight: 700 }}>{DUMMY['{{이메일}}'].value}</span>{'>'}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-8)' }}>{renderWithDummy(subject || '(제목 없음)')}</div>
              </div>
              <div style={{ padding: '24px 20px', fontSize: 13, color: 'var(--gray-7)', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
                {body ? renderWithDummy(body) : <span style={{ color: 'var(--gray-4)' }}>본문을 입력하면 여기에 표시됩니다.</span>}
              </div>
            </div>
            <div style={{ padding: '10px 20px', borderTop: '1px solid var(--gray-2)', fontSize: 11, color: 'var(--gray-4)', textAlign: 'center' }}>
              치환 구문은 발송 시 자동 적용됩니다
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20 }}>

        {/* Sidebar — template list */}
        <div style={{ background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px' }}>템플릿 목록</span>
            <span style={{ fontSize: 11, color: 'var(--gray-4)' }}>{templates.length}개</span>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {CATEGORIES.map(cat => {
              const catTemplates = templates.map((t: any, i: number) => ({ t, i })).filter(({ t }) => (t.category || '기타') === cat)
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
                  {!collapsed && catTemplates.map(({ t, i }) => (
                    <div key={t.id} onClick={() => setSelectedIdx(i)}
                      style={{
                        padding: '14px 18px', cursor: 'pointer', borderBottom: '1px solid var(--gray-2)',
                        background: selectedIdx === i ? 'var(--blue-lt)' : '#fff',
                        borderLeft: selectedIdx === i ? `3px solid ${c.color}` : '3px solid transparent',
                      }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-8)', marginBottom: 3, whiteSpace: 'nowrap' }}>{t.name}</div>
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
              <button onClick={() => setShowPreview(p => !p)}
                style={{ padding: '6px 14px', background: showPreview ? 'var(--teal-lt)' : 'var(--gray-1)', color: showPreview ? 'var(--teal-dk)' : 'var(--gray-6)', border: `1px solid ${showPreview ? 'var(--teal)' : 'var(--gray-3)'}`, borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                {showPreview ? '미리보기 닫기' : '미리보기'}
              </button>
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
                {['{{이름}}', '{{핸들}}', '{{이메일}}', '{{팔로워}}', '{{조회수}}'].map(p => (
                  <button key={p} onClick={() => setBody(prev => prev + p)}
                    style={{ fontSize: 10, padding: '2px 8px', background: 'var(--gray-1)', border: '1px solid var(--gray-3)', borderRadius: 5, cursor: 'pointer' }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={14}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.7 }} />
          </div>
        </div>

      </div>
    </div>
  )
}
