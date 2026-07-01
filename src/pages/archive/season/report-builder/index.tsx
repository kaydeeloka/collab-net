import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { pdf } from '@react-pdf/renderer'
import {
  ArrowLeft, FileText, Plus, Trash2, ChevronUp, ChevronDown, Download, Loader,
} from 'lucide-react'
import Spinner from '@/components/Spinner'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import { loadMonitoringData, type MonitoringRow } from '@/lib/influencer/monitoring-data'
import { useArchivePhase } from '@/pages/archive/use-archive-phase'
import ReportPDF from './ReportPDF'
import {
  PAGE_TYPE_LABELS, DEFAULT_CONTENT,
  type ReportPage, type PageType, type PageContent, type ProcessStep,
} from './types'
import './report-builder.css'

const PAGE_TYPES = Object.keys(PAGE_TYPE_LABELS) as PageType[]

// ── Field editors per page type ──────────────────────────────────

function CoverFields({ content, onChange }: { content: PageContent; onChange: (c: PageContent) => void }) {
  return (
    <label className="rb-field">
      <span>메인 제목</span>
      <input value={content.title ?? ''} onChange={e => onChange({ ...content, title: e.target.value })} placeholder="2026 Q1 시딩 프로젝트 결과 리포트" />
    </label>
  )
}

function OutroFields({ content, onChange }: { content: PageContent; onChange: (c: PageContent) => void }) {
  return (
    <>
      <label className="rb-field">
        <span>메인 텍스트</span>
        <input value={content.title ?? ''} onChange={e => onChange({ ...content, title: e.target.value })} placeholder="E.O.D" />
      </label>
      <label className="rb-field">
        <span>하단 연락처 (| 로 구분)</span>
        <input value={content.caption ?? ''} onChange={e => onChange({ ...content, caption: e.target.value })} placeholder="CONTACT | email@example.com" />
      </label>
    </>
  )
}

function TitleFields({ content, onChange }: { content: PageContent; onChange: (c: PageContent) => void }) {
  return (
    <>
      <label className="rb-field">
        <span>영문 소제목</span>
        <input value={content.engTitle ?? ''} onChange={e => onChange({ ...content, engTitle: e.target.value })} />
      </label>
      <label className="rb-field">
        <span>한국어 제목</span>
        <input value={content.korTitle ?? ''} onChange={e => onChange({ ...content, korTitle: e.target.value })} />
      </label>
    </>
  )
}

function TextBodyFields({ content, onChange }: { content: PageContent; onChange: (c: PageContent) => void }) {
  return (
    <>
      <TitleFields content={content} onChange={onChange} />
      <label className="rb-field">
        <span>본문</span>
        <textarea rows={8} value={content.body ?? ''} onChange={e => onChange({ ...content, body: e.target.value })} placeholder="내용을 입력하세요..." />
      </label>
    </>
  )
}

function GridFields({ content, onChange }: { content: PageContent; onChange: (c: PageContent) => void }) {
  return (
    <>
      <TitleFields content={content} onChange={onChange} />
      <label className="rb-field">
        <span>열 수</span>
        <select value={content.columns ?? 5} onChange={e => onChange({ ...content, columns: Number(e.target.value) })}>
          <option value={3}>3열</option>
          <option value={4}>4열</option>
          <option value={5}>5열</option>
        </select>
      </label>
    </>
  )
}

function ImageUploadField({ imageUrl, onChange }: { imageUrl: string | undefined; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setUploading(true)
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `report-images/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('report-assets').upload(path, file, { upsert: true })
    if (upErr) { setError(upErr.message); setUploading(false); return }
    const { data } = supabase.storage.from('report-assets').getPublicUrl(path)
    onChange(data.publicUrl)
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="rb-field">
      <span>이미지</span>
      {imageUrl && (
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <img src={imageUrl} alt="preview" style={{ width: '100%', maxHeight: 160, objectFit: 'contain', borderRadius: 6, border: '1px solid var(--surface-md)', background: '#f8f8f8' }} />
          <button
            type="button"
            onClick={() => onChange('')}
            style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 4, border: 'none', background: 'rgba(0,0,0,.45)', color: '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >×</button>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        style={{ padding: '7px 14px', fontSize: 12, fontWeight: 700, borderRadius: 'var(--r)', border: '1px solid var(--surface-md)', background: 'var(--surface)', color: 'var(--gray-7)', cursor: 'pointer', width: '100%' }}
      >
        {uploading ? '업로드 중…' : imageUrl ? '이미지 교체' : '이미지 업로드'}
      </button>
      {error && <span style={{ fontSize: 11, color: '#dc2626' }}>{error}</span>}
    </div>
  )
}

function ProjectOverviewFields({ content, onChange }: { content: PageContent; onChange: (c: PageContent) => void }) {
  const DEFAULT_STEPS: ProcessStep[] = [
    { date: '', content: '' }, { date: '', content: '' },
    { date: '', content: '' }, { date: '', content: '' },
  ]
  const steps = content.processSteps ?? DEFAULT_STEPS

  return (
    <>
      <TitleFields content={content} onChange={onChange} />
      <ImageUploadField imageUrl={content.imageUrl} onChange={url => onChange({ ...content, imageUrl: url })} />
      <label className="rb-field">
        <span>프로젝트 명</span>
        <input value={content.projectName ?? ''} onChange={e => onChange({ ...content, projectName: e.target.value })} />
      </label>
      <label className="rb-field">
        <span>프로젝트 목적</span>
        <textarea rows={3} value={content.projectPurpose ?? ''} onChange={e => onChange({ ...content, projectPurpose: e.target.value })} />
      </label>
      <label className="rb-field">
        <span>키트 발송 대상</span>
        <input value={content.kitRecipients ?? ''} onChange={e => onChange({ ...content, kitRecipients: e.target.value })} />
      </label>
      <label className="rb-field">
        <span>총 배송 수량</span>
        <input value={content.totalShipping ?? ''} onChange={e => onChange({ ...content, totalShipping: e.target.value })} />
      </label>
      <label className="rb-field">
        <span>참여 브랜드</span>
        <input value={content.participatingBrands ?? ''} onChange={e => onChange({ ...content, participatingBrands: e.target.value })} />
      </label>

      <div style={{ borderTop: '1px solid var(--surface-md)', paddingTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>진행 프로세스</div>
        {steps.map((step, i) => (
          <div key={i} style={{ marginBottom: 12, padding: '12px 14px', background: 'var(--surface)', borderRadius: 'var(--r)', border: '1px solid var(--surface-md)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal-dk)', marginBottom: 8 }}>Step {i + 1}</div>
            <label className="rb-field">
              <span>날짜 (예: 26 Jan)</span>
              <input
                value={step.date}
                onChange={e => {
                  const newSteps = steps.map((s, j) => j === i ? { ...s, date: e.target.value } : s)
                  onChange({ ...content, processSteps: newSteps })
                }}
              />
            </label>
            <label className="rb-field" style={{ marginTop: 8 }}>
              <span>내용 (줄바꿈으로 항목 구분)</span>
              <textarea
                rows={3}
                value={step.content}
                onChange={e => {
                  const newSteps = steps.map((s, j) => j === i ? { ...s, content: e.target.value } : s)
                  onChange({ ...content, processSteps: newSteps })
                }}
              />
            </label>
          </div>
        ))}
      </div>
    </>
  )
}

function ContentFields({ page, onChange }: { page: ReportPage; onChange: (c: PageContent) => void }) {
  switch (page.type) {
    case 'cover':               return <CoverFields content={page.content} onChange={onChange} />
    case 'project_overview':    return <ProjectOverviewFields content={page.content} onChange={onChange} />
    case 'kit_composition':     return <TextBodyFields content={page.content} onChange={onChange} />
    case 'content_performance': return <TitleFields content={page.content} onChange={onChange} />
    case 'best_review':         return <GridFields content={page.content} onChange={onChange} />
    case 'brand_mention':       return <TitleFields content={page.content} onChange={onChange} />
    case 'next_project':        return <TextBodyFields content={page.content} onChange={onChange} />
    case 'outro':               return <OutroFields content={page.content} onChange={onChange} />
  }
}

// ── Slide preview ────────────────────────────────────────────────

// Must match BG_EXT in ReportPDF.tsx
const PREVIEW_BG_EXT = '.jpg'

function SlidePreview({ page }: { page: ReportPage }) {
  const bg = page.type === 'cover' ? `/report/title-bg${PREVIEW_BG_EXT}`
           : page.type === 'outro' ? `/report/conclusion-bg${PREVIEW_BG_EXT}`
           : `/report/content-bg${PREVIEW_BG_EXT}`

  const isDataDriven = page.type === 'content_performance' || page.type === 'best_review' || page.type === 'brand_mention'

  return (
    <div className="rb-preview">
      <div className="rb-preview__slide" style={{ backgroundImage: `url(${bg})` }}>

        {page.type === 'cover' && (
          <div className="rb-preview__cover-layer">
            {page.content.title && <div className="rb-preview__cover-title">{page.content.title}</div>}
          </div>
        )}

        {page.type === 'outro' && (
          <>
            <div className="rb-preview__outro-center">
              <div className="rb-preview__outro-main">{page.content.title || 'E.O.D'}</div>
            </div>
            {page.content.caption && (
              <div className="rb-preview__outro-footer">{page.content.caption}</div>
            )}
          </>
        )}

        {!['cover', 'outro'].includes(page.type) && (
          <div className="rb-preview__content-layer">
            {page.content.engTitle && <div className="rb-preview__eng">{page.content.engTitle}</div>}
            {page.content.korTitle && <div className="rb-preview__kor">{page.content.korTitle}</div>}
            <div className="rb-preview__divider" />
            {page.content.body && <div className="rb-preview__body">{page.content.body}</div>}
            {isDataDriven && (
              <div className="rb-preview__placeholder">데이터는 PDF 생성 시 자동으로 채워집니다</div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────

export default function ReportBuilder() {
  const { phaseName } = useParams<{ phaseName: string }>()
  const { phase, phasesLoading } = useArchivePhase()
  const { showToast } = useToast()
  const [pages, setPages]         = useState<ReportPage[]>([])
  const [rows, setRows]           = useState<MonitoringRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [generating, setGenerating] = useState(false)
  const [addOpen, setAddOpen]     = useState(false)
  const addMenuRef = useRef<HTMLDivElement>(null)

  // Close add menu on outside click
  useEffect(() => {
    if (!addOpen) return
    function handle(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setAddOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [addOpen])

  // Load pages + monitoring data
  useEffect(() => {
    if (phasesLoading || !phase) return
    setLoading(true)
    void Promise.all([
      supabase
        .from('report_pages')
        .select('*')
        .eq('phase_id', phase.id)
        .order('order_index'),
      loadMonitoringData(phase.id),
    ]).then(([{ data }, { rows: r }]) => {
      setPages((data as ReportPage[]) ?? [])
      setRows(r)
    }).finally(() => setLoading(false))
  }, [phase, phasesLoading])

  const selected = pages.find(p => p.id === selectedId) ?? null

  // ── CRUD ──────────────────────────────────────────────────────

  async function addPage(type: PageType) {
    if (!phase) return
    setAddOpen(false)
    const maxOrder = pages.reduce((m, p) => Math.max(m, p.order_index), -1)
    const { data, error } = await supabase.from('report_pages').insert({
      phase_id:    phase.id,
      order_index: maxOrder + 1,
      type,
      content:     DEFAULT_CONTENT[type],
    }).select().single()
    if (error) {
      console.error('report_pages insert error:', error)
      showToast(
        error.code === '42P01'
          ? 'report_pages 테이블이 없습니다. Supabase에서 SQL을 먼저 실행해 주세요.'
          : `저장 오류: ${error.message}`,
        'error',
      )
      return
    }
    if (data) {
      setPages(prev => [...prev, data as ReportPage])
      setSelectedId((data as ReportPage).id)
    }
  }

  async function updateContent(content: PageContent) {
    if (!selected) return
    setPages(prev => prev.map(p => p.id === selected.id ? { ...p, content } : p))
    setSaving(true)
    await supabase.from('report_pages').update({ content }).eq('id', selected.id)
    setSaving(false)
  }

  async function deletePage(id: string) {
    await supabase.from('report_pages').delete().eq('id', id)
    setPages(prev => prev.filter(p => p.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  async function movePage(id: string, dir: -1 | 1) {
    const idx = pages.findIndex(p => p.id === id)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= pages.length) return
    const next = [...pages]
    const aOrder = next[idx].order_index
    const bOrder = next[swapIdx].order_index
    next[idx]     = { ...next[idx],    order_index: bOrder }
    next[swapIdx] = { ...next[swapIdx], order_index: aOrder }
    next.sort((a, b) => a.order_index - b.order_index)
    setPages(next)
    await Promise.all([
      supabase.from('report_pages').update({ order_index: bOrder }).eq('id', next[swapIdx].id),
      supabase.from('report_pages').update({ order_index: aOrder }).eq('id', next[idx].id),
    ])
  }

  async function downloadPDF() {
    if (!phase || pages.length === 0) return
    setGenerating(true)
    try {
      const blob = await pdf(
        <ReportPDF
          phaseName={phase.name}
          pages={pages}
          rows={rows}
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `MiMuse_${phase.name}_Report.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('PDF generation failed:', e)
    } finally {
      setGenerating(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────

  if (phasesLoading || loading) {
    return <div className="rb-loading"><Spinner /></div>
  }

  const sorted = [...pages].sort((a, b) => a.order_index - b.order_index)

  return (
    <div className="rb-page">

      {/* ── Toolbar ── */}
      <div className="rb-toolbar">
        <div className="rb-toolbar__left">
          <Link to={`/archive/${phaseName}/season-report`} className="rb-back-btn" aria-label="돌아가기">
            <ArrowLeft size={15} />
          </Link>
          <FileText size={16} />
          <span className="rb-toolbar__title">리포트 편집기</span>
          {phase && <span className="rb-toolbar__phase">{phase.name}</span>}
          {saving && <span className="rb-toolbar__saving"><Loader size={12} className="rb-spin" />저장 중</span>}
        </div>
        <button
          className="rb-dl-btn"
          disabled={generating || pages.length === 0}
          onClick={() => { void downloadPDF() }}
        >
          {generating ? <Spinner sm /> : <Download size={14} />}
          PDF 다운로드
        </button>
      </div>

      <div className="rb-body">

        {/* ── Page list ── */}
        <aside className="rb-sidebar">
          <div className="rb-sidebar__head">
            <span className="rb-sidebar__label">페이지 목록</span>
            <div className="rb-add-wrap" ref={addMenuRef}>
              <button
                className="rb-add-btn"
                onClick={() => setAddOpen(o => !o)}
                aria-expanded={addOpen}
              >
                <Plus size={13} /> 추가
              </button>
              {addOpen && (
                <div className="rb-add-menu">
                  {PAGE_TYPES.map(t => (
                    <button key={t} className="rb-add-menu__item" onClick={() => { void addPage(t) }}>
                      {PAGE_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rb-page-list">
            {sorted.length === 0 && (
              <p className="rb-page-list__empty">페이지가 없습니다.<br />위 추가 버튼으로 시작하세요.</p>
            )}
            {sorted.map((p, i) => (
              <div
                key={p.id}
                className={`rb-page-item${selectedId === p.id ? ' is-active' : ''}`}
                onClick={() => setSelectedId(p.id)}
              >
                <div className="rb-page-item__main">
                  <span className="rb-page-item__num">{i + 1}</span>
                  <div>
                    <div className="rb-page-item__type">{PAGE_TYPE_LABELS[p.type]}</div>
                    <div className="rb-page-item__label">
                      {p.content.title || p.content.korTitle || '—'}
                    </div>
                  </div>
                </div>
                <div className="rb-page-item__actions">
                  <button onClick={e => { e.stopPropagation(); void movePage(p.id, -1) }} disabled={i === 0} aria-label="위로">
                    <ChevronUp size={12} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); void movePage(p.id, 1) }} disabled={i === sorted.length - 1} aria-label="아래로">
                    <ChevronDown size={12} />
                  </button>
                  <button className="rb-page-item__del" onClick={e => { e.stopPropagation(); void deletePage(p.id) }} aria-label="삭제">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* ── Editor panel ── */}
        <main className="rb-editor">
          {selected ? (
            <>
              {/* Live slide preview */}
              <SlidePreview page={selected} />

              <div className="rb-editor__head">
                <span className="rb-editor__type-badge">{PAGE_TYPE_LABELS[selected.type]}</span>
                <span className="rb-editor__hint">수정 내용은 자동 저장됩니다</span>
              </div>
              <div className="rb-editor__fields">
                <ContentFields page={selected} onChange={c => { void updateContent(c) }} />
              </div>
            </>
          ) : (
            <div className="rb-editor__empty">
              <FileText size={32} strokeWidth={1.5} />
              <p>왼쪽에서 페이지를 선택하거나<br />새 페이지를 추가하세요</p>
            </div>
          )}
        </main>

      </div>
    </div>
  )
}
