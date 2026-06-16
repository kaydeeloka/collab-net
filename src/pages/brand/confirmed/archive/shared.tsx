import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import { ChevronLeft, ChevronRight, Download, FileText, ExternalLink, ZoomIn, ZoomOut, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Spinner from '@/components/Spinner'

export const BUCKET = 'brand-archive'

export const CATEGORIES = [
  { key: 'logo',          label: '브랜드 로고',           hint: 'AI / PNG / SVG',  viewHint: '권장 크기: 200px × 200px',  accept: '.ai,.png,.svg,image/png,image/svg+xml', single: true  },
  { key: 'product_main',  label: '제품 이미지 (대표)',    hint: '대표 사진 1장',   viewHint: '권장 크기: 800px × 800px',  accept: 'image/*',                                 single: true  },
  { key: 'product_sub',   label: '제품 이미지 (서브)',    hint: '서브 사진 (복수)', viewHint: '권장 크기: 800px × 800px', accept: 'image/*',                                 single: false },
  { key: 'cutout',        label: '제품 누끼',             hint: '누끼 PNG 등',     viewHint: '권장 크기: 800px × 800px',  accept: 'image/*',                                 single: false },
  { key: 'ingredients',   label: '전성분표',              hint: 'PDF / Excel / 이미지', viewHint: 'PDF / Excel / 이미지 / Word', accept: '.pdf,.xlsx,.xls,.xlsm,.doc,.docx,image/*,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document', single: false },
] as const

export type CategoryKey = typeof CATEGORIES[number]['key']

export const VIEW_TOP_ROW: CategoryKey[] = ['logo', 'product_main', 'product_sub', 'cutout']

export interface ConfirmedBrand {
  id:         string
  brand_name: string
  product:    string | null
  received:   boolean
}

export interface BrandAsset {
  id:           string
  category:     CategoryKey
  file_name:    string
  storage_path: string
  file_size:    number | null
  mime_type:    string | null
  label:        string | null
  created_at:   string
}

/** Supabase Storage keys must be ASCII — keep original name in DB only */
export function buildStoragePath(phaseId: string, brandId: string, category: string, fileName: string, index: number) {
  const rawExt = fileName.includes('.') ? fileName.split('.').pop() ?? 'bin' : 'bin'
  const ext = rawExt.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'bin'
  const token = `${Date.now()}_${index}_${Math.random().toString(36).slice(2, 10)}`
  return `${phaseId}/${brandId}/${category}/${token}.${ext}`
}

export function formatBytes(n: number | null | undefined) {
  if (!n) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function sanitizeZipSegment(name: string) {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'folder'
}

export function categoryZipFileName(label: string, originalFileName: string, index: number, count: number) {
  const dot = originalFileName.lastIndexOf('.')
  const ext = dot > 0 ? originalFileName.slice(dot) : ''
  const safeLabel = label.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'file'
  if (count <= 1) return `${safeLabel}${ext}`
  return `${safeLabel}_${index + 1}${ext}`
}

export function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function isPreviewableImageAsset(asset: BrandAsset) {
  const mime = asset.mime_type ?? ''
  const name = asset.file_name.toLowerCase()
  return mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(name)
}

function isImageAsset(asset: BrandAsset) {
  return isPreviewableImageAsset(asset)
}

function isPdfAsset(asset: BrandAsset) {
  const mime = asset.mime_type ?? ''
  const name = asset.file_name.toLowerCase()
  return mime === 'application/pdf' || name.endsWith('.pdf')
}

function isSpreadsheetAsset(asset: BrandAsset) {
  const mime = asset.mime_type ?? ''
  const name = asset.file_name.toLowerCase()
  return /\.(xlsx?|xlsm|csv)$/i.test(name)
    || mime === 'application/vnd.ms-excel'
    || mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    || mime === 'text/csv'
}

function isWordAsset(asset: BrandAsset) {
  const mime = asset.mime_type ?? ''
  const name = asset.file_name.toLowerCase()
  return /\.(docx?|doc)$/i.test(name)
    || mime === 'application/msword'
    || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
}

function isDocxAsset(asset: BrandAsset) {
  const mime = asset.mime_type ?? ''
  const name = asset.file_name.toLowerCase()
  return name.endsWith('.docx')
    || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
}

export async function getSignedUrl(storagePath: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 3600)
  if (error) return { url: null as string | null, error: error.message }
  return { url: data?.signedUrl ?? null, error: null }
}

type PreviewVariant = 'thumb' | 'hero' | 'full'

const PREVIEW_HEIGHTS: Record<PreviewVariant, { box: number; image: number; pdf: number }> = {
  thumb: { box: 140, image: 180, pdf: 200 },
  hero:  { box: 280, image: 420, pdf: 320 },
  full:  { box: 320, image: 520, pdf: 560 },
}

const SHEET_TABLE_CSS = `
  .archive-sheet-wrap table { border-collapse: collapse; width: auto; font-size: 11px; background: #fff; }
  .archive-sheet-wrap td, .archive-sheet-wrap th {
    border: 1px solid var(--surface-md); padding: 5px 8px; text-align: left;
    vertical-align: top; white-space: pre-wrap;
  }
  .archive-sheet-wrap tr:first-child td, .archive-sheet-wrap tr:first-child th { background: var(--surface); font-weight: 600; }
`

const SHEET_ZOOM_STEP = 0.25
const SHEET_ZOOM_MIN = 0.5
const SHEET_ZOOM_MAX = 2.5

const DOC_PREVIEW_CSS = `
  .archive-doc-wrap { font-size: 13px; line-height: 1.65; color: var(--ink); word-break: break-word; }
  .archive-doc-wrap p { margin: 0 0 10px; }
  .archive-doc-wrap h1, .archive-doc-wrap h2, .archive-doc-wrap h3, .archive-doc-wrap h4 {
    margin: 14px 0 8px; font-weight: 700; line-height: 1.35;
  }
  .archive-doc-wrap table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 12px; }
  .archive-doc-wrap td, .archive-doc-wrap th {
    border: 1px solid var(--surface-md); padding: 6px 8px; text-align: left; vertical-align: top;
  }
  .archive-doc-wrap ul, .archive-doc-wrap ol { margin: 0 0 10px; padding-left: 22px; }
  .archive-doc-wrap img { max-width: 100%; height: auto; }
  .archive-doc-wrap strong { font-weight: 700; }
`

function WordPreview({ asset, variant = 'thumb' }: { asset: BrandAsset; variant?: PreviewVariant }) {
  const [html, setHtml] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const heights = PREVIEW_HEIGHTS[variant]

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErr(null)
    setHtml(null)
    setDownloadUrl(null)

    Promise.all([
      supabase.storage.from(BUCKET).download(asset.storage_path),
      getSignedUrl(asset.storage_path),
    ]).then(async ([{ data: blob, error: dlErr }, { url: signed, error: urlErr }]) => {
      if (cancelled) return
      if (urlErr || !signed) {
        setErr(urlErr ?? '미리보기 불가')
        setLoading(false)
        return
      }
      setDownloadUrl(signed)
      if (dlErr || !blob) {
        setErr(dlErr?.message ?? '파일 불러오기 실패')
        setLoading(false)
        return
      }
      try {
        const buf = await blob.arrayBuffer()
        const { value, messages } = await mammoth.convertToHtml({ arrayBuffer: buf })
        if (messages.some(m => m.type === 'error')) {
          const msg = messages.find(m => m.type === 'error')?.message
          if (!value.trim()) throw new Error(msg ?? 'Word 미리보기 실패')
        }
        if (!value.trim()) throw new Error('문서 내용이 비어 있습니다')
        setHtml(value)
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Word 미리보기 실패')
      }
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [asset.storage_path, asset.id])

  if (loading) {
    return (
      <div style={{ minHeight: heights.box, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', borderRadius: 'var(--r-sm)' }}>
        <Spinner sm />
      </div>
    )
  }

  if (err || !html) {
    return (
      <div style={{
        minHeight: heights.box, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: '#fef0f0', borderRadius: 'var(--r-sm)', padding: 12, textAlign: 'center', gap: 6,
      }}>
        <FileText size={28} color="#dc2626" />
        <div style={{ fontSize: 11, color: '#991b1b', lineHeight: 1.4 }}>
          {err?.includes('Invalid key') || err?.includes('invalid')
            ? '파일 경로 오류 — 편집 모드에서 다시 업로드하세요'
            : (err ?? '미리보기 불가')}
        </div>
        {downloadUrl && (
          <a href={downloadUrl} target="_blank" rel="noopener noreferrer" download={asset.file_name}
            style={{ fontSize: 11, fontWeight: 600, color: 'var(--teal-dk)', textDecoration: 'none' }}>
            원본 파일 다운로드
          </a>
        )}
      </div>
    )
  }

  return (
    <div style={{ borderRadius: 'var(--r-sm)', overflow: 'hidden', border: '1px solid var(--surface-md)', background: 'var(--white)' }}>
      <style>{DOC_PREVIEW_CSS}</style>
      <div style={{
        maxHeight: heights.pdf,
        overflowY: 'auto',
        overflowX: 'auto',
        padding: 16,
        background: '#fff',
      }}>
        <div className="archive-doc-wrap" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
      {downloadUrl && (
        <a href={downloadUrl} target="_blank" rel="noopener noreferrer" download={asset.file_name}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 10px', fontSize: 11, fontWeight: 600, color: 'var(--teal-dk)', background: 'var(--surface)', textDecoration: 'none', borderTop: '1px solid var(--surface-md)' }}>
          <ExternalLink size={12} /> 원본 파일 다운로드
        </a>
      )}
    </div>
  )
}

function SpreadsheetPreview({ asset, variant = 'thumb' }: { asset: BrandAsset; variant?: PreviewVariant }) {
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [sheetsHtml, setSheetsHtml] = useState<Record<string, string>>({})
  const [activeSheet, setActiveSheet] = useState('')
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 })
  const [containerWidth, setContainerWidth] = useState(0)
  const [zoomScale, setZoomScale] = useState<number | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const heights = PREVIEW_HEIGHTS[variant]

  const html = activeSheet ? sheetsHtml[activeSheet] : null

  const fitScale = naturalSize.w > 0 && containerWidth > 0
    ? Math.min(1, (containerWidth - 16) / naturalSize.w)
    : 1
  const displayScale = zoomScale ?? fitScale
  const isFitMode = zoomScale === null
  const showHorizontalScroll = !isFitMode && displayScale > fitScale + 0.01

  useEffect(() => {
    setZoomScale(null)
  }, [asset.storage_path, asset.id, activeSheet])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErr(null)
    setSheetNames([])
    setSheetsHtml({})
    setActiveSheet('')
    setDownloadUrl(null)
    setNaturalSize({ w: 0, h: 0 })

    Promise.all([
      supabase.storage.from(BUCKET).download(asset.storage_path),
      getSignedUrl(asset.storage_path),
    ]).then(async ([{ data: blob, error: dlErr }, { url: signed, error: urlErr }]) => {
      if (cancelled) return
      if (urlErr || !signed) {
        setErr(urlErr ?? '미리보기 불가')
        setLoading(false)
        return
      }
      setDownloadUrl(signed)
      if (dlErr || !blob) {
        setErr(dlErr?.message ?? '파일 불러오기 실패')
        setLoading(false)
        return
      }
      try {
        const buf = await blob.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array' })
        const names = wb.SheetNames.filter(name => wb.Sheets[name])
        if (!names.length) throw new Error('시트가 비어 있습니다')

        const htmlMap: Record<string, string> = {}
        for (const name of names) {
          htmlMap[name] = XLSX.utils.sheet_to_html(wb.Sheets[name])
        }

        setSheetNames(names)
        setSheetsHtml(htmlMap)
        setActiveSheet(names[0])
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Excel 미리보기 실패')
      }
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [asset.storage_path, asset.id])

  useLayoutEffect(() => {
    if (!html) return
    const measure = () => {
      const viewport = viewportRef.current
      const content = contentRef.current
      const table = content?.querySelector('table')
      if (!viewport || !table) return
      setContainerWidth(viewport.clientWidth)
      setNaturalSize({ w: table.scrollWidth, h: table.scrollHeight })
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (viewportRef.current) ro.observe(viewportRef.current)
    return () => ro.disconnect()
  }, [html])

  function zoomIn() {
    setZoomScale(prev => Math.min((prev ?? fitScale) + SHEET_ZOOM_STEP, SHEET_ZOOM_MAX))
  }

  function zoomOut() {
    setZoomScale(prev => {
      const current = prev ?? fitScale
      const next = current - SHEET_ZOOM_STEP
      if (next <= fitScale + 0.001) return null
      return Math.max(next, SHEET_ZOOM_MIN)
    })
  }

  function resetZoom() {
    setZoomScale(null)
  }

  if (loading) {
    return (
      <div style={{ minHeight: heights.box, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', borderRadius: 'var(--r-sm)' }}>
        <Spinner sm />
      </div>
    )
  }

  if (err || !html) {
    return (
      <div style={{
        minHeight: heights.box, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: '#fef0f0', borderRadius: 'var(--r-sm)', padding: 12, textAlign: 'center', gap: 6,
      }}>
        <FileText size={28} color="#dc2626" />
        <div style={{ fontSize: 11, color: '#991b1b', lineHeight: 1.4 }}>
          {err?.includes('Invalid key') || err?.includes('invalid')
            ? '파일 경로 오류 — 편집 모드에서 다시 업로드하세요'
            : (err ?? '미리보기 불가')}
        </div>
      </div>
    )
  }

  return (
    <div style={{ borderRadius: 'var(--r-sm)', overflow: 'hidden', border: '1px solid var(--surface-md)', background: 'var(--white)' }}>
      <style>{SHEET_TABLE_CSS}</style>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        padding: '8px 10px', background: 'var(--surface)', borderBottom: '1px solid var(--surface-md)',
      }}>
        <span style={{ fontSize: 11, color: 'var(--gray-5)' }}>
          {isFitMode ? '화면 맞춤' : `${Math.round(displayScale * 100)}%`}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button type="button" className="cfg-btn cfg-btn--ghost" title="축소" onClick={zoomOut} style={{ padding: '4px 8px' }}>
            <ZoomOut size={14} />
          </button>
          <button type="button" className="cfg-btn cfg-btn--ghost" title="확대" onClick={zoomIn} style={{ padding: '4px 8px' }}>
            <ZoomIn size={14} />
          </button>
          <button type="button" className="cfg-btn cfg-btn--ghost" title="화면 맞춤" onClick={resetZoom} style={{ padding: '4px 10px', fontSize: 11 }}>
            맞춤
          </button>
        </div>
      </div>
      <div
        ref={viewportRef}
        style={{
          maxHeight: heights.pdf,
          overflowY: 'auto',
          overflowX: showHorizontalScroll ? 'auto' : 'hidden',
          padding: 8,
          background: '#fff',
        }}
      >
        <div style={{
          width: naturalSize.w > 0 ? naturalSize.w * displayScale : '100%',
          height: naturalSize.h > 0 ? naturalSize.h * displayScale : undefined,
        }}>
          <div
            ref={contentRef}
            className="archive-sheet-wrap"
            style={{
              transform: `scale(${displayScale})`,
              transformOrigin: 'top left',
              width: naturalSize.w > 0 ? naturalSize.w : undefined,
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
      {sheetNames.length > 1 && (
        <div style={{
          display: 'flex',
          gap: 4,
          padding: '6px 10px',
          background: 'var(--surface)',
          borderTop: '1px solid var(--surface-md)',
          overflowX: 'auto',
          scrollbarWidth: 'thin',
        }}>
          {sheetNames.map(name => (
            <button
              key={name}
              type="button"
              onClick={() => setActiveSheet(name)}
              style={{
                flexShrink: 0,
                padding: '5px 12px',
                fontSize: 11,
                fontWeight: activeSheet === name ? 700 : 500,
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontFamily: 'inherit',
                background: activeSheet === name ? 'var(--white)' : 'transparent',
                color: activeSheet === name ? 'var(--teal-dk)' : 'var(--gray-5)',
                boxShadow: activeSheet === name ? 'var(--sh-xs)' : undefined,
                whiteSpace: 'nowrap',
              }}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      {downloadUrl && (
        <a href={downloadUrl} target="_blank" rel="noopener noreferrer" download={asset.file_name}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 10px', fontSize: 11, fontWeight: 600, color: 'var(--teal-dk)', background: 'var(--surface)', textDecoration: 'none', borderTop: '1px solid var(--surface-md)' }}>
          <ExternalLink size={12} /> 원본 파일 다운로드
        </a>
      )}
    </div>
  )
}

function ImageLightbox({
  url,
  alt,
  fileName,
  onClose,
}: {
  url: string
  alt: string
  fileName: string
  onClose: () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return createPortal(
    <div className="brand-archive-lightbox" onClick={onClose} role="dialog" aria-modal="true" aria-label={fileName}>
      <button type="button" className="brand-archive-lightbox__close" onClick={onClose} aria-label="닫기">
        <X size={22} />
      </button>
      <img
        src={url}
        alt={alt}
        className="brand-archive-lightbox__img"
        onClick={e => e.stopPropagation()}
      />
      <div className="brand-archive-lightbox__caption">{fileName}</div>
    </div>,
    document.body,
  )
}

export function ArchiveImageGalleryLightbox({
  assets,
  currentIndex,
  onClose,
  onChangeIndex,
}: {
  assets: BrandAsset[]
  currentIndex: number
  onClose: () => void
  onChangeIndex: (index: number) => void
}) {
  const asset = assets[currentIndex]
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < assets.length - 1

  useEffect(() => {
    if (!asset) return
    let cancelled = false
    setLoading(true)
    setUrl(null)
    getSignedUrl(asset.storage_path).then(({ url: signed }) => {
      if (!cancelled) {
        setUrl(signed)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [asset?.id, asset?.storage_path])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && hasPrev) onChangeIndex(currentIndex - 1)
      if (e.key === 'ArrowRight' && hasNext) onChangeIndex(currentIndex + 1)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose, currentIndex, hasPrev, hasNext, onChangeIndex])

  if (!asset) return null

  return createPortal(
    <div className="brand-archive-lightbox" onClick={onClose} role="dialog" aria-modal="true" aria-label={asset.file_name}>
      <button type="button" className="brand-archive-lightbox__close" onClick={onClose} aria-label="닫기">
        <X size={22} />
      </button>

      {hasPrev && (
        <button
          type="button"
          className="brand-archive-lightbox__nav brand-archive-lightbox__nav--prev"
          onClick={e => { e.stopPropagation(); onChangeIndex(currentIndex - 1) }}
          aria-label="이전 이미지"
        >
          <ChevronLeft size={28} />
        </button>
      )}

      {loading ? (
        <div className="brand-archive-lightbox__loading"><Spinner /></div>
      ) : url ? (
        <img
          src={url}
          alt={asset.file_name}
          className="brand-archive-lightbox__img"
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <div className="brand-archive-lightbox__loading" style={{ color: '#fff', fontSize: 13 }}>미리보기 불가</div>
      )}

      {hasNext && (
        <button
          type="button"
          className="brand-archive-lightbox__nav brand-archive-lightbox__nav--next"
          onClick={e => { e.stopPropagation(); onChangeIndex(currentIndex + 1) }}
          aria-label="다음 이미지"
        >
          <ChevronRight size={28} />
        </button>
      )}

      <div className="brand-archive-lightbox__caption">
        {asset.file_name}
        {assets.length > 1 && ` · ${currentIndex + 1} / ${assets.length}`}
      </div>
    </div>,
    document.body,
  )
}

export function AssetPreview({
  asset,
  variant = 'thumb',
  onImageClick,
}: {
  asset: BrandAsset
  variant?: PreviewVariant
  onImageClick?: (asset: BrandAsset) => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const heights = PREVIEW_HEIGHTS[variant]

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErr(null)
    setUrl(null)
    getSignedUrl(asset.storage_path).then(({ url: signed, error }) => {
      if (cancelled) return
      if (error || !signed) {
        setErr(error ?? '미리보기 불가')
      } else {
        setUrl(signed)
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [asset.storage_path, asset.id])

  if (loading) {
    return (
      <div style={{ minHeight: heights.box, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', borderRadius: 'var(--r-sm)' }}>
        <Spinner sm />
      </div>
    )
  }

  if (err || !url) {
    return (
      <div style={{
        minHeight: heights.box, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: '#fef0f0', borderRadius: 'var(--r-sm)', padding: 12, textAlign: 'center', gap: 6,
      }}>
        <FileText size={28} color="#dc2626" />
        <div style={{ fontSize: 11, color: '#991b1b', lineHeight: 1.4 }}>
          {err?.includes('Invalid key') || err?.includes('invalid')
            ? '파일 경로 오류 — 편집 모드에서 다시 업로드하세요'
            : (err ?? '미리보기 불가')}
        </div>
      </div>
    )
  }

  if (isPdfAsset(asset)) {
    return (
      <div style={{ borderRadius: 'var(--r-sm)', overflow: 'hidden', border: '1px solid var(--surface-md)', background: 'var(--white)' }}>
        <iframe
          title={asset.file_name}
          src={url}
          style={{ width: '100%', height: heights.pdf, border: 'none', display: 'block' }}
        />
        <a href={url} target="_blank" rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 10px', fontSize: 11, fontWeight: 600, color: 'var(--teal-dk)', background: 'var(--surface)', textDecoration: 'none' }}>
          <ExternalLink size={12} /> 새 탭에서 PDF 열기
        </a>
      </div>
    )
  }

  if (isSpreadsheetAsset(asset)) {
    return <SpreadsheetPreview asset={asset} variant={variant} />
  }

  if (isWordAsset(asset)) {
    return (
      <div style={{
        minHeight: heights.box, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'var(--surface)', borderRadius: 'var(--r-sm)', border: '1px solid var(--surface-md)', padding: 16, gap: 10,
      }}>
        <FileText size={36} color="var(--teal-dk)" />
        <div style={{ fontSize: 11, color: 'var(--gray-5)', textAlign: 'center', wordBreak: 'break-all', lineHeight: 1.4 }}>
          {asset.file_name}
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer" download={asset.file_name}
          style={{ fontSize: 11, fontWeight: 600, color: 'var(--teal-dk)', textDecoration: 'none' }}>
          다운로드 / 열기
        </a>
      </div>
    )
  }

  if (isImageAsset(asset)) {
    return (
      <>
        <button
          type="button"
          onClick={() => {
            if (onImageClick) onImageClick(asset)
            else setLightboxOpen(true)
          }}
          style={{
            display: 'block',
            width: '100%',
            padding: 0,
            border: '1px solid var(--surface-md)',
            borderRadius: 'var(--r-sm)',
            overflow: 'hidden',
            background: '#fff',
            cursor: 'zoom-in',
          }}
        >
          <img
            src={url}
            alt={asset.file_name}
            style={{
              width: '100%',
              height: variant === 'thumb' ? heights.image : undefined,
              maxHeight: variant !== 'thumb' ? heights.image : undefined,
              objectFit: 'contain',
              background: '#fff',
              display: 'block',
              pointerEvents: 'none',
            }}
          />
        </button>
        {lightboxOpen && !onImageClick && (
          <ImageLightbox
            url={url}
            alt={asset.file_name}
            fileName={asset.file_name}
            onClose={() => setLightboxOpen(false)}
          />
        )}
      </>
    )
  }

  return (
    <div style={{
      minHeight: heights.box, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'var(--surface)', borderRadius: 'var(--r-sm)', gap: 8,
    }}>
      <FileText size={32} color="var(--gray-5)" />
      <a href={url} target="_blank" rel="noopener noreferrer" download={asset.file_name}
        style={{ fontSize: 11, fontWeight: 600, color: 'var(--blue-dk)' }}>
        파일 열기 / 다운로드
      </a>
    </div>
  )
}

export const SECTION_STYLE: CSSProperties = {
  border: '1px solid var(--surface-md)',
  borderRadius: 'var(--r-sm)',
  background: 'var(--white)',
  overflow: 'hidden',
}

export const SECTION_PAD: CSSProperties = {
  ...SECTION_STYLE,
  padding: 16,
}

export function ViewCategoryHeader({ label, viewHint }: { label: string; viewHint: string }) {
  return (
    <div className="brand-archive-cat-head">
      <div className="brand-archive-cat-head__title">{label}</div>
      <div className="brand-archive-cat-head__hint">{viewHint}</div>
    </div>
  )
}

export function ViewAssetFooter({ asset, onDownload }: { asset: BrandAsset; onDownload: (a: BrandAsset) => void }) {
  return (
    <div className="brand-archive-asset-footer">
      <div style={{ minWidth: 0 }}>
        <div className="brand-archive-asset-footer__name">{asset.file_name}</div>
        <div className="brand-archive-asset-footer__size">{formatBytes(asset.file_size)}</div>
      </div>
      <button type="button" className="cfg-btn cfg-btn--ghost" title="다운로드" onClick={() => onDownload(asset)}>
        <Download size={12} />
      </button>
    </div>
  )
}

export function ViewEmptyPlaceholder() {
  return (
    <div className="brand-archive-empty-slot">
      등록된 파일 없음
    </div>
  )
}

export const PANEL: CSSProperties = {
  background: 'var(--gray-0)',
  borderRadius: 'var(--radius)',
  boxShadow: 'var(--shadow)',
  overflow: 'hidden',
}

export function ArchiveMemoPanel({
  editMode,
  archiveMemo,
  onSave,
  layout = 'sidebar',
}: {
  editMode: boolean
  archiveMemo: string
  onSave: (v: string) => void
  layout?: 'sidebar' | 'top'
}) {
  const isTop = layout === 'top'

  if (isTop) {
    return (
      <section className="brand-archive-memo">
        <div className="brand-archive-memo__label">
          <FileText size={14} />
          기타 메모
        </div>
        {editMode ? (
          <textarea
            className="cfg-input brand-archive-memo__textarea"
            value={archiveMemo}
            onChange={e => onSave(e.target.value)}
            placeholder="링크, 요청사항, 참고사항 등"
            rows={4}
          />
        ) : (
          <div className={`brand-archive-memo__content${archiveMemo ? '' : ' is-empty'}`}>
            {archiveMemo || '메모 없음'}
          </div>
        )}
      </section>
    )
  }

  return (
    <aside style={{
      flex: '0 0 260px',
      width: 260,
      padding: '18px 16px',
      background: 'var(--surface)',
      borderLeft: '1px solid var(--surface-md)',
      alignSelf: 'stretch',
    }}>
      <div className="brand-archive-memo__label">
        <FileText size={14} />
        기타 메모
      </div>
      {editMode ? (
        <textarea
          className="cfg-input"
          value={archiveMemo}
          onChange={e => onSave(e.target.value)}
          placeholder="링크, 요청사항, 참고사항 등"
          rows={8}
          style={{
            width: '100%', borderRadius: 'var(--r-sm)', resize: 'vertical',
            padding: '10px 12px', boxSizing: 'border-box', minHeight: 140,
          }}
        />
      ) : (
        <div className={`brand-archive-memo__content${archiveMemo ? '' : ' is-empty'}`}>
          {archiveMemo || '메모 없음'}
        </div>
      )}
    </aside>
  )
}
