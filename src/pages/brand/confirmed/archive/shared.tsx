import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import * as XLSX from 'xlsx'
import QRCode from 'qrcode'
import { ChevronLeft, ChevronRight, Download, FileText, ExternalLink, Trash2, Upload, ZoomIn, ZoomOut, X } from 'lucide-react'
import { demoDb } from '@/lib/local-db'
import Spinner from '@/components/Spinner'

export const BUCKET = 'brand-archive'

export const CATEGORIES = [
  { key: 'logo',          label: '브랜드 로고',           hint: 'AI / PNG / SVG',  viewHint: '권장 크기: 200px × 200px',  accept: '.ai,.png,.svg,image/png,image/svg+xml', single: true  },
  { key: 'product_main',  label: '제품 이미지 (대표)',    hint: '대표 사진 1장',   viewHint: '권장 크기: 800px × 800px',  accept: 'image/*',                                 single: true  },
  { key: 'product_sub',   label: '제품 이미지 (서브)',    hint: '서브 사진 (복수)', viewHint: '권장 크기: 800px × 800px', accept: 'image/*',                                 single: false },
  { key: 'cutout',        label: '제품 누끼',             hint: '누끼 PNG 등',     viewHint: '권장 크기: 800px × 800px',  accept: 'image/*',                                 single: false },
  { key: 'ingredients',   label: '전성분표',              hint: 'PDF / Excel / 이미지', viewHint: 'PDF / Excel / 이미지', accept: '.pdf,.xlsx,.xls,.xlsm,image/*,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel', single: false },
  { key: 'sales_channel', label: '판매처',                hint: '링크 + 이미지',    viewHint: '판매처 링크 (QR 코드) · 이미지', accept: 'image/*', single: true },
] as const

export type CategoryKey = typeof CATEGORIES[number]['key']

export const VIEW_TOP_ROW: CategoryKey[] = ['logo', 'product_main', 'product_sub', 'cutout']

export const ASSET_GRID_CATEGORIES = CATEGORIES.filter(c => c.key !== 'sales_channel')

export interface ConfirmedBrand {
  id:           string
  brand_name:   string
  product:      string | null
  received:     boolean
  archive_notes?: string | null
  description_en?: string | null
  product_en?:  string | null
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

export function isWordAsset(asset: BrandAsset) {
  const mime = asset.mime_type ?? ''
  const name = asset.file_name.toLowerCase()
  return /\.(docx?|doc)$/i.test(name)
    || mime === 'application/msword'
    || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
}

/** Word files are not accepted for 전성분표 uploads */
export function isWordUploadFile(file: File) {
  const name = file.name.toLowerCase()
  return /\.(docx?|doc)$/i.test(name)
    || file.type === 'application/msword'
    || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
}

export async function getSignedUrl(storagePath: string) {
  const { data, error } = await demoDb.storage.from(BUCKET).createSignedUrl(storagePath, 3600)
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
      demoDb.storage.from(BUCKET).download(asset.storage_path),
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
    const unsupportedIngredients = asset.category === 'ingredients'
    return (
      <div style={{
        minHeight: heights.box, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: unsupportedIngredients ? '#fef0f0' : 'var(--surface)', borderRadius: 'var(--r-sm)',
        border: `1px solid ${unsupportedIngredients ? '#fecaca' : 'var(--surface-md)'}`, padding: 16, gap: 10,
      }}>
        <FileText size={36} color={unsupportedIngredients ? '#dc2626' : 'var(--teal-dk)'} />
        <div style={{ fontSize: 11, color: unsupportedIngredients ? '#991b1b' : 'var(--gray-5)', textAlign: 'center', wordBreak: 'break-all', lineHeight: 1.4 }}>
          {unsupportedIngredients
            ? 'Word 파일은 전성분표로 사용할 수 없습니다. PDF, Excel 또는 이미지로 다시 업로드하세요.'
            : asset.file_name}
        </div>
        {!unsupportedIngredients && (
          <a href={url} target="_blank" rel="noopener noreferrer" download={asset.file_name}
            style={{ fontSize: 11, fontWeight: 600, color: 'var(--teal-dk)', textDecoration: 'none' }}>
            다운로드 / 열기
          </a>
        )}
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

export function ArchiveNotesPanel({
  editMode,
  archiveNotes,
  onSave,
  layout = 'sidebar',
}: {
  editMode: boolean
  archiveNotes: string
  onSave: (v: string) => void
  layout?: 'sidebar' | 'top'
}) {
  const isTop = layout === 'top'

  if (isTop) {
    return (
      <section className="brand-archive-memo">
        <div className="brand-archive-memo__label">
          <FileText size={14} />
          메모
        </div>
        {editMode ? (
          <textarea
            className="cfg-input brand-archive-memo__textarea"
            value={archiveNotes}
            onChange={e => onSave(e.target.value)}
            placeholder="링크, 요청사항, 참고사항 등"
            rows={4}
          />
        ) : (
          <div className={`brand-archive-memo__content${archiveNotes ? '' : ' is-empty'}`}>
            {archiveNotes || '메모 없음'}
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
        메모
      </div>
      {editMode ? (
        <textarea
          className="cfg-input"
          value={archiveNotes}
          onChange={e => onSave(e.target.value)}
          placeholder="링크, 요청사항, 참고사항 등"
          rows={8}
          style={{
            width: '100%', borderRadius: 'var(--r-sm)', resize: 'vertical',
            padding: '10px 12px', boxSizing: 'border-box', minHeight: 140,
          }}
        />
      ) : (
        <div className={`brand-archive-memo__content${archiveNotes ? '' : ' is-empty'}`}>
          {archiveNotes || '메모 없음'}
        </div>
      )}
    </aside>
  )
}

export function ArchiveProductFields({
  editMode,
  productEn,
  descriptionEn,
  archiveNotes,
  onProductEnChange,
  onDescriptionEnChange,
  onArchiveNotesChange,
}: {
  editMode: boolean
  productEn: string
  descriptionEn: string
  archiveNotes: string
  onProductEnChange: (v: string) => void
  onDescriptionEnChange: (v: string) => void
  onArchiveNotesChange: (v: string) => void
}) {
  if (!editMode) return null

  return (
    <section className="brand-archive-product-fields">
      <div className="brand-archive-product-fields__grid">
        <div className="brand-archive-product-fields__field">
          <label className="brand-archive-product-fields__label">제품 영문명</label>
          <input
            type="text"
            className="cfg-input"
            value={productEn}
            onChange={e => onProductEnChange(e.target.value)}
            placeholder="Product name in English"
          />
        </div>
        <div className="brand-archive-product-fields__field brand-archive-product-fields__field--wide">
          <label className="brand-archive-product-fields__label">제품 설명</label>
          <textarea
            className="cfg-input brand-archive-memo__textarea"
            value={descriptionEn}
            onChange={e => onDescriptionEnChange(e.target.value)}
            placeholder="제품 설명 (영문, 시즌 컬렉션에 표시)"
            rows={5}
          />
        </div>
        <div className="brand-archive-product-fields__field brand-archive-product-fields__field--full">
          <label className="brand-archive-product-fields__label">메모</label>
          <textarea
            className="cfg-input brand-archive-memo__textarea"
            value={archiveNotes}
            onChange={e => onArchiveNotesChange(e.target.value)}
            placeholder="링크, 요청사항, 참고사항 등"
            rows={4}
          />
        </div>
      </div>
    </section>
  )
}

export function brandLogoDisplayScale(brandName: string): number {
  const trimmed = brandName.trim()
  if (/^(varuza|바루자|바루쟈)$/i.test(trimmed)) return 1.4
  return 1
}

export function ArchiveProductPreview({
  brandName,
  productKo,
  productEn,
  descriptionEn,
  archiveNotes,
  logoUrl,
  productMainUrl,
}: {
  brandName: string
  productKo: string | null
  productEn: string
  descriptionEn: string
  archiveNotes: string
  logoUrl: string | null
  productMainUrl: string | null
}) {
  const productKoTrim = productKo?.trim() || ''
  const productEnTrim = productEn.trim()
  const primaryTitle = productEnTrim || productKoTrim || brandName
  const desc = descriptionEn.trim() || '설명 없음'
  const brandInitial = brandName.trim().charAt(0) || '?'
  const logoScale = brandLogoDisplayScale(brandName)

  return (
    <article className="brand-archive-product-preview">
      <div className="brand-archive-product-preview__media">
        {productMainUrl ? (
          <img src={productMainUrl} alt={primaryTitle} />
        ) : (
          <span className="brand-archive-product-preview__placeholder">대표 이미지 없음</span>
        )}
      </div>
      <div className="brand-archive-product-preview__copy">
        <div className="brand-archive-product-preview__brand-block">
          <span className="brand-archive-product-preview__brand">{brandName}</span>
          {logoUrl ? (
            <div
              className="brand-archive-product-preview__logo-wrap"
              style={{ '--logo-scale': logoScale } as CSSProperties}
            >
              <img src={logoUrl} alt={brandName} className="brand-archive-product-preview__logo" />
            </div>
          ) : (
            <span className="brand-archive-product-preview__logo-fallback" aria-hidden>{brandInitial}</span>
          )}
        </div>
        {productKoTrim && (
          <p className="brand-archive-product-preview__title-sub">{productKoTrim}</p>
        )}
        <h2 className="brand-archive-product-preview__title">{primaryTitle}</h2>
        <p className={`brand-archive-product-preview__desc${descriptionEn.trim() ? '' : ' is-empty'}`}>{desc}</p>
        <div className="brand-archive-product-preview__memo">
          <span className="brand-archive-product-preview__memo-label">메모</span>
          <p className={`brand-archive-product-preview__memo-text${archiveNotes.trim() ? '' : ' is-empty'}`}>
            {archiveNotes.trim() || '메모 없음'}
          </p>
        </div>
      </div>
    </article>
  )
}

export function isSalesLinkOnly(asset: BrandAsset) {
  return asset.mime_type === 'application/x-sales-link' || asset.storage_path.endsWith('.link')
}

function SalesQrCode({ url, downloadName }: { url: string; downloadName?: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(url, { width: 320, margin: 1, errorCorrectionLevel: 'M' })
      .then(d => { if (!cancelled) setDataUrl(d) })
      .catch(() => { if (!cancelled) setDataUrl(null) })
    return () => { cancelled = true }
  }, [url])

  if (!dataUrl) return null

  function downloadPng() {
    if (!dataUrl) return
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `${(downloadName || 'sales-qr').replace(/[<>:"/\\|?*]+/g, '').trim() || 'sales-qr'}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return (
    <div className="brand-archive-sales__qr">
      <img src={dataUrl} alt="판매처 QR 코드" className="brand-archive-sales__qr-img" />
      <button type="button" className="cfg-btn cfg-btn--ghost brand-archive-sales__qr-dl" onClick={downloadPng}>
        <Download size={12} />
        QR 다운로드
      </button>
    </div>
  )
}

export function SalesChannelPanel({
  assets,
  editMode,
  uploading,
  onAddLink,
  onAddImage,
  onAttachImage,
  onDelete,
  onLinkChange,
  onDownload,
}: {
  assets: BrandAsset[]
  editMode: boolean
  uploading: boolean
  onAddLink: (url: string) => void
  onAddImage: (url: string, file: File) => void
  onAttachImage: (asset: BrandAsset, file: File) => void
  onDelete: (asset: BrandAsset) => void
  onLinkChange: (asset: BrandAsset, url: string) => void
  onDownload: (asset: BrandAsset) => void
}) {
  const cat = CATEGORIES.find(c => c.key === 'sales_channel')!
  const [draftUrl, setDraftUrl] = useState('')
  const [draftFile, setDraftFile] = useState<File | null>(null)

  function tryAdd() {
    const url = draftUrl.trim()
    if (draftFile) {
      onAddImage(url, draftFile)
    } else if (url) {
      onAddLink(url)
    } else {
      return
    }
    setDraftUrl('')
    setDraftFile(null)
  }

  return (
    <section className="brand-archive-asset-slot brand-archive-asset-slot--wide brand-archive-sales">
      <ViewCategoryHeader label={cat.label} viewHint={cat.viewHint} />
      {assets.length === 0 && !editMode ? (
        <ViewEmptyPlaceholder />
      ) : (
        <div className="brand-archive-sales__list">
          {assets.map(asset => {
            const url = asset.label?.trim() || ''
            const hasImage = !isSalesLinkOnly(asset)
            return (
              <div key={asset.id} className="brand-archive-sales__item">
                {/* link (top) */}
                {editMode ? (
                  <div className="brand-archive-sales__edit-row">
                    <input
                      type="url"
                      className="cfg-input"
                      value={asset.label ?? ''}
                      onChange={e => onLinkChange(asset, e.target.value)}
                      placeholder="판매처 링크 (https://)"
                    />
                    {hasImage && (
                      <button type="button" className="cfg-btn cfg-btn--ghost" title="이미지 다운로드" onClick={() => onDownload(asset)}>
                        <Download size={12} />
                      </button>
                    )}
                    <button type="button" className="cfg-btn cfg-btn--ghost" title="삭제" onClick={() => onDelete(asset)}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ) : url ? (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="brand-archive-sales__link">
                    <ExternalLink size={12} />
                    {url}
                  </a>
                ) : null}

                {/* QR (middle) */}
                {url && <SalesQrCode url={url} downloadName="sales-qr" />}

                {/* image (bottom) */}
                {hasImage ? (
                  <div className="brand-archive-sales__media">
                    <AssetPreview asset={asset} variant="thumb" />
                    {editMode && (
                      <label className="brand-archive-sales__media-edit" title="이미지 변경">
                        <Upload size={13} />
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          disabled={uploading}
                          onChange={e => {
                            const file = e.target.files?.[0]
                            if (file) onAttachImage(asset, file)
                            e.target.value = ''
                          }}
                        />
                      </label>
                    )}
                  </div>
                ) : editMode ? (
                  <div className="brand-archive-sales__media">
                    <label className="brand-archive-sales__media-add" title="이미지 추가">
                      <Upload size={20} color="var(--gray-5)" />
                      <span>이미지 추가</span>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        disabled={uploading}
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (file) onAttachImage(asset, file)
                          e.target.value = ''
                        }}
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
      {editMode && assets.length === 0 && (
        <div className="brand-archive-sales__add">
          <input
            type="url"
            className="cfg-input"
            value={draftUrl}
            onChange={e => setDraftUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); tryAdd() } }}
            placeholder="판매처 링크 (https://)"
          />
          <label
            className={`brand-archive-sales__add-box${draftFile ? ' has-file' : ''}`}
            style={{ cursor: uploading ? 'wait' : 'pointer', opacity: uploading ? 0.6 : 1 }}
          >
            <Upload size={20} color="var(--gray-5)" />
            <span>{draftFile ? draftFile.name : '이미지 선택 (선택사항)'}</span>
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              disabled={uploading}
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) setDraftFile(file)
                e.target.value = ''
              }}
            />
          </label>
          <div className="brand-archive-sales__add-actions">
            {draftFile && (
              <button
                type="button"
                className="cfg-btn cfg-btn--ghost"
                title="선택한 이미지 취소"
                onClick={() => setDraftFile(null)}
              >
                <X size={13} />
                이미지 취소
              </button>
            )}
            <button
              type="button"
              className="cfg-btn"
              disabled={uploading || (!draftUrl.trim() && !draftFile)}
              onClick={tryAdd}
            >
              {uploading ? '추가 중…' : '추가'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

/** @deprecated use ArchiveNotesPanel */
export function ArchiveMemoPanel(props: {
  editMode: boolean
  archiveMemo: string
  onSave: (v: string) => void
  layout?: 'sidebar' | 'top'
}) {
  return (
    <ArchiveNotesPanel
      editMode={props.editMode}
      archiveNotes={props.archiveMemo}
      onSave={props.onSave}
      layout={props.layout}
    />
  )
}
