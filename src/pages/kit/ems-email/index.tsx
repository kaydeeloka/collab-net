import { useState, useEffect } from 'react'
import { Mail } from 'lucide-react'
import React from 'react'

const CATEGORIES = ['초기 안내', '재발송 안내', '반송 처리', '기타'] as const
type Category = typeof CATEGORIES[number]

const CATEGORY_COLORS: Record<Category, { bg: string; color: string }> = {
  '초기 안내':  { bg: '#eff6ff', color: '#1d4ed8' },
  '재발송 안내':{ bg: '#fef9c3', color: '#a16207' },
  '반송 처리':  { bg: '#f0fdf4', color: '#15803d' },
  '기타':       { bg: '#f3f4f6', color: '#6b7280' },
}

interface Template {
  id: string; name: string; category: Category; subject: string; body: string
}

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'ems_01', name: '기본 오류 안내', category: '초기 안내',
    subject: '[MiMuse] 배송 오류 안내 — {운송장번호}',
    body: `안녕하세요, {이름}님.\n\nMiMuse 팀입니다.\n\n{이름}님께 발송된 패키지({운송장번호})의 배송 과정에서 문제가 발생하여 연락드립니다.\n\n■ 오류 내용: {오류_사유}\n■ 운송장 번호: {운송장번호}\n■ 발송일: {발송일}\n\n현재 해당 건을 확인 중이며, 빠른 시일 내에 재발송 또는 해결 방안을 안내해 드리겠습니다.\n불편을 드려 대단히 죄송합니다.\n\n감사합니다,\nMiMuse 팀`,
  },
  {
    id: 'ems_02', name: '재발송 안내', category: '재발송 안내',
    subject: '[MiMuse] 패키지 재발송 안내 — {이름}님',
    body: `안녕하세요, {이름}님.\n\nMiMuse 팀입니다.\n\n이전 배송 오류로 인해 불편을 드린 점 진심으로 사과드립니다.\n아래와 같이 패키지를 재발송하였습니다.\n\n■ 새 운송장 번호: {새_운송장번호}\n■ 재발송일: {재발송일}\n■ 예상 도착일: {예상_도착일}\n\n이번에는 정상적으로 수령하실 수 있도록 최선을 다하겠습니다.\n궁금하신 점은 언제든지 연락해 주세요.\n\n감사합니다,\nMiMuse 팀`,
  },
  {
    id: 'ems_03', name: '반송 처리 완료', category: '반송 처리',
    subject: '[MiMuse] 반송 처리 완료 — {이름}님',
    body: `안녕하세요, {이름}님.\n\nMiMuse 팀입니다.\n\n{이름}님의 패키지({운송장번호})가 반송 처리되어 저희 측에 도착하였습니다.\n\n■ 반송 도착일: {반송_도착일}\n■ 반송 사유: {오류_사유}\n\n빠른 시일 내에 재발송 일정을 안내드리겠습니다.\n불편을 드려 대단히 죄송합니다.\n\n감사합니다,\nMiMuse 팀`,
  },
]

const VARS = ['{이름}', '{운송장번호}', '{발송일}', '{오류_사유}', '{국가}']

const DUMMY_VALS: Record<string, { value: string; color: string }> = {
  '{이름}':       { value: 'Sarah Kim',       color: '#a07800' },
  '{운송장번호}': { value: 'EMS123456789KR',  color: '#0369a1' },
  '{발송일}':     { value: '2026-05-12',       color: '#b45309' },
  '{오류_사유}':  { value: '주소 불명',        color: '#be123c' },
  '{국가}':       { value: '미국',             color: '#065f46' },
}

function loadTemplates(): Template[] {
  try { const v = localStorage.getItem('mm_ems_templates'); return v ? JSON.parse(v) : DEFAULT_TEMPLATES } catch { return DEFAULT_TEMPLATES }
}
function saveTemplates(t: Template[]) {
  localStorage.setItem('mm_ems_templates', JSON.stringify(t))
}

function renderWithDummy(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let remaining = text
  let key = 0
  while (remaining.length > 0) {
    let earliest = -1; let earliestTag = ''
    for (const tag of Object.keys(DUMMY_VALS)) {
      const idx = remaining.indexOf(tag)
      if (idx !== -1 && (earliest === -1 || idx < earliest)) { earliest = idx; earliestTag = tag }
    }
    if (earliest === -1) { parts.push(remaining); break }
    if (earliest > 0) parts.push(remaining.slice(0, earliest))
    const d = DUMMY_VALS[earliestTag]
    parts.push(
      <span key={key++} style={{ background: d.color + '18', color: d.color, fontWeight: 700, borderRadius: 4, padding: '0 3px', fontSize: '0.95em' }}>
        {d.value}
      </span>
    )
    remaining = remaining.slice(earliest + earliestTag.length)
  }
  return parts
}

export default function EmsEmail() {
  const [templates, setTemplates]       = useState<Template[]>(loadTemplates)
  const [selectedIdx, setSelectedIdx]   = useState(0)
  const [name, setName]                 = useState('')
  const [category, setCategory]         = useState<Category>('초기 안내')
  const [subject, setSubject]           = useState('')
  const [body, setBody]                 = useState('')
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set())

  useEffect(() => {
    const t = templates[selectedIdx]
    if (t) { setName(t.name); setCategory(t.category); setSubject(t.subject); setBody(t.body) }
  }, [selectedIdx, templates])

  function save() {
    const updated = templates.map((t, i) => i === selectedIdx ? { ...t, name, category, subject, body } : t)
    setTemplates(updated); saveTemplates(updated)
  }

  function createNew() {
    const next: Template[] = [...templates, { id: 'ems_' + Date.now(), name: '새 템플릿', category: '기타', subject: '', body: '' }]
    setTemplates(next); saveTemplates(next); setSelectedIdx(next.length - 1)
  }

  function deleteTpl() {
    if (templates.length <= 1) return
    const next = templates.filter((_, i) => i !== selectedIdx)
    setTemplates(next); saveTemplates(next); setSelectedIdx(0)
  }

  function toggleCat(cat: string) {
    setCollapsedCats(prev => { const next = new Set(prev); prev.has(cat) ? next.delete(cat) : next.add(cat); return next })
  }

  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco"><Mail size={28} /></span>
        <div>
          <div className="page-banner-title">이메일 템플릿</div>
          <div className="page-banner-desc">배송 오류·재발송 안내 이메일 서식을 관리합니다.</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20 }}>
        <div style={{ background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px' }}>템플릿 목록</span>
            <span style={{ fontSize: 11, color: 'var(--gray-4)' }}>{templates.length}개</span>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {CATEGORIES.map(cat => {
              const catItems = templates.map((t, i) => ({ t, i })).filter(({ t }) => (t.category || '기타') === cat)
              if (catItems.length === 0) return null
              const c = CATEGORY_COLORS[cat]
              const collapsed = collapsedCats.has(cat)
              return (
                <div key={cat}>
                  <div onClick={() => toggleCat(cat)}
                    style={{ padding: '10px 18px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: c.color, background: c.bg, borderBottom: '1px solid var(--gray-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{cat} <span style={{ fontWeight: 400, opacity: 0.7 }}>({catItems.length})</span></span>
                    <span style={{ fontSize: 10 }}>{collapsed ? '▸' : '▾'}</span>
                  </div>
                  {!collapsed && catItems.map(({ t, i }) => (
                    <div key={t.id} onClick={() => setSelectedIdx(i)}
                      style={{ padding: '14px 18px', cursor: 'pointer', borderBottom: '1px solid var(--gray-2)', background: selectedIdx === i ? 'var(--blue-lt)' : '#fff', borderLeft: selectedIdx === i ? `3px solid ${c.color}` : '3px solid transparent' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-8)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--gray-4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.subject || '(제목 없음)'}</div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--gray-2)' }}>
            <button type="button" onClick={createNew}
              style={{ width: '100%', padding: '7px', background: 'var(--gray-1)', border: '1px dashed var(--gray-3)', borderRadius: 8, fontSize: 12, color: 'var(--gray-6)', cursor: 'pointer', fontWeight: 600 }}>
              + 새 템플릿
            </button>
          </div>
        </div>

        <div style={{ background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-8)' }}>템플릿 편집</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={deleteTpl} disabled={templates.length <= 1}
                style={{ padding: '6px 14px', background: '#fff0f0', color: '#c00', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                삭제
              </button>
              <button type="button" onClick={save}
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
            <input value={subject} onChange={e => setSubject(e.target.value.slice(0, 80))} maxLength={80}
              style={{ width: '100%', padding: '8px 12px', border: `1px solid ${subject.length >= 72 ? '#f59e0b' : 'var(--gray-3)'}`, borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
            <div style={{ fontSize: 10, color: subject.length >= 72 ? '#d97706' : 'var(--gray-4)', textAlign: 'right', marginTop: 3 }}>{subject.length}/80</div>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)' }}>이메일 본문</label>
              <div style={{ display: 'flex', gap: 5 }}>
                {VARS.map(v => (
                  <button key={v} type="button" onClick={() => setBody(prev => prev + v)}
                    style={{ fontSize: 10, padding: '2px 8px', background: 'var(--gray-1)', border: '1px solid var(--gray-3)', borderRadius: 5, cursor: 'pointer' }}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={14}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.7 }} />
          </div>

          {(subject || body) && (
            <div style={{ borderTop: '1px solid var(--gray-2)', paddingTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>미리보기</div>
              <div style={{ background: 'var(--gray-1)', borderRadius: 10, padding: '14px 18px', border: '1px solid var(--gray-2)' }}>
                <div style={{ fontSize: 10, color: 'var(--gray-4)', marginBottom: 6 }}>보내는 사람 · MiMuse 팀 &lt;hello@mimuse.com&gt;</div>
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
