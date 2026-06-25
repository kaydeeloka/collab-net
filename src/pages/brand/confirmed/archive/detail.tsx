import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import JSZip from 'jszip'
import { ArrowLeft, Download, Pencil, Save, Trash2, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usePhase } from '@/contexts/PhaseContext'
import { useToast } from '@/contexts/ToastContext'
import Spinner from '@/components/Spinner'
import {
  BUCKET,
  CATEGORIES,
  VIEW_TOP_ROW,
  buildStoragePath,
  formatBytes,
  sanitizeZipSegment,
  categoryZipFileName,
  triggerBlobDownload,
  AssetPreview,
  ArchiveImageGalleryLightbox,
  isPreviewableImageAsset,
  ViewCategoryHeader,
  ViewAssetFooter,
  ViewEmptyPlaceholder,
  ArchiveMemoPanel,
  getSignedUrl,
  isWordAsset,
  isWordUploadFile,
  type ConfirmedBrand,
  type BrandAsset,
  type CategoryKey,
} from './shared'
import { brandFromSlug } from './slug'

export default function BrandArchiveDetail() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { selectedPhaseId } = usePhase()
  const { showToast, showConfirm } = useToast()

  const [brands, setBrands] = useState<ConfirmedBrand[]>([])
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)

  const [assets, setAssets] = useState<BrandAsset[]>([])
  const [assetsLoading, setAssetsLoading] = useState(false)
  const [archiveMemo, setArchiveMemo] = useState('')
  const [uploadingCat, setUploadingCat] = useState<CategoryKey | null>(null)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [saving, setSaving] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null)
  const memoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const brand = brandFromSlug(brands, slug)
  const brandId = brand?.id ?? null

  const loadBrands = useCallback(async () => {
    if (!selectedPhaseId) { setBrands([]); setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('confirmed_brands')
      .select('id, brand_name, product, received, archive_memo')
      .eq('phase_id', selectedPhaseId)
      .order('brand_name')
    if (error) { showToast(error.message, 'error'); setLoading(false); return }
    setBrands((data ?? []) as ConfirmedBrand[])
    setLoading(false)
  }, [selectedPhaseId, showToast])

  const loadAssets = useCallback(async (id: string) => {
    setAssetsLoading(true)
    const { data: assetRows, error: assetErr } = await supabase
      .from('confirmed_brand_assets')
      .select('id, category, file_name, storage_path, file_size, mime_type, label, created_at')
      .eq('confirmed_brand_id', id)
      .order('sort_order')
      .order('created_at')
    if (assetErr) showToast(assetErr.message, 'error')
    setAssets((assetRows ?? []) as BrandAsset[])
    setAssetsLoading(false)
  }, [showToast])

  useEffect(() => { loadBrands() }, [loadBrands])

  useEffect(() => {
    if (!loading && brands.length && !brand) {
      navigate('/brand/confirmed/archive', { replace: true })
    }
  }, [loading, brands.length, brand, navigate])

  useEffect(() => {
    if (brandId) void loadAssets(brandId)
    else {
      setAssets([])
      setArchiveMemo('')
      setLogoUrl(null)
    }
  }, [brandId, loadAssets])

  useEffect(() => {
    setArchiveMemo(brand?.archive_memo ?? '')
  }, [brand?.id, brand?.archive_memo])

  const logoAsset = assets.find(a => a.category === 'logo')

  useEffect(() => {
    let cancelled = false

    if (!logoAsset) {
      setLogoUrl(null)
      return
    }

    const mime = logoAsset.mime_type ?? ''
    const name = logoAsset.file_name.toLowerCase()
    const previewable = mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(name)
    if (!previewable) {
      setLogoUrl(null)
      return
    }

    getSignedUrl(logoAsset.storage_path).then(({ url }) => {
      if (!cancelled) setLogoUrl(url)
    })

    return () => { cancelled = true }
  }, [logoAsset?.id, logoAsset?.storage_path, logoAsset?.file_name, logoAsset?.mime_type])

  async function deleteAsset(asset: BrandAsset, silent = false) {
    const { error: storageErr } = await supabase.storage.from(BUCKET).remove([asset.storage_path])
    if (storageErr && !storageErr.message.includes('Not found')) {
      showToast(storageErr.message, 'error')
    }
    const { error } = await supabase.from('confirmed_brand_assets').delete().eq('id', asset.id)
    if (error) { showToast(error.message, 'error'); return false }
    setAssets(prev => prev.filter(a => a.id !== asset.id))
    if (!silent) showToast('파일이 삭제되었습니다', 'success')
    return true
  }

  async function downloadAsset(asset: BrandAsset) {
    const { data, error } = await supabase.storage.from(BUCKET).download(asset.storage_path)
    if (error || !data) {
      showToast(error?.message?.includes('Invalid key')
        ? '파일 경로 오류입니다. 편집 모드에서 파일을 다시 업로드하세요.'
        : (error?.message ?? '다운로드 실패'), 'error')
      return
    }
    triggerBlobDownload(data, asset.file_name)
  }

  async function downloadAll() {
    if (!assets.length) { showToast('다운로드할 파일이 없습니다', 'error'); return }
    if (!brand) return
    setDownloadingAll(true)
    try {
      const zip = new JSZip()
      const brandFolder = sanitizeZipSegment(brand.brand_name)
      const folder = zip.folder(brandFolder)
      if (!folder) throw new Error('ZIP 폴더 생성 실패')
      const usedNames = new Set<string>()
      let ok = 0
      let failed = 0

      for (const cat of CATEGORIES) {
        const catAssets = assets.filter(a => a.category === cat.key)
        if (!catAssets.length) continue

        for (let index = 0; index < catAssets.length; index += 1) {
          const asset = catAssets[index]
          const { data, error } = await supabase.storage.from(BUCKET).download(asset.storage_path)
          if (error || !data) {
            failed += 1
            continue
          }
          let entryName = categoryZipFileName(cat.label, asset.file_name, index, catAssets.length)
          if (usedNames.has(entryName)) {
            const dot = entryName.lastIndexOf('.')
            const base = dot > 0 ? entryName.slice(0, dot) : entryName
            const ext = dot > 0 ? entryName.slice(dot) : ''
            let n = 2
            while (usedNames.has(`${base}_${n}${ext}`)) n += 1
            entryName = `${base}_${n}${ext}`
          }
          usedNames.add(entryName)
          folder.file(entryName, data)
          ok += 1
        }
      }

      if (ok === 0) {
        showToast(
          failed > 0
            ? 'ZIP에 담을 수 있는 파일이 없습니다. 경로 오류 파일은 편집 모드에서 다시 업로드하세요.'
            : '다운로드할 파일이 없습니다',
          'error',
        )
        return
      }

      const blob = await zip.generateAsync({ type: 'blob' })
      triggerBlobDownload(blob, `${brandFolder}_자료.zip`)
      showToast(
        failed > 0
          ? `${ok}개 파일 ZIP 저장 (${failed}개 실패 — 재업로드 필요)`
          : `${ok}개 파일 ZIP 다운로드`,
        'success',
      )
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'ZIP 생성 실패', 'error')
    } finally {
      setDownloadingAll(false)
    }
  }

  async function uploadFiles(category: CategoryKey, files: FileList | null, single: boolean) {
    if (!brandId || !selectedPhaseId || !files?.length) return
    setUploadingCat(category)
    try {
      if (single) {
        const existing = assets.filter(a => a.category === category)
        for (const a of existing) await deleteAsset(a, true)
      }

      const uploaded: BrandAsset[] = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (category === 'ingredients' && isWordUploadFile(file)) {
          showToast('전성분표는 PDF, Excel, 이미지만 업로드할 수 있습니다.', 'error')
          continue
        }
        const path = buildStoragePath(selectedPhaseId, brandId, category, file.name, i)
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || undefined,
        })
        if (upErr) { showToast(upErr.message, 'error'); continue }

        const { data: row, error: insErr } = await supabase
          .from('confirmed_brand_assets')
          .insert({
            confirmed_brand_id: brandId,
            category,
            file_name: file.name,
            storage_path: path,
            file_size: file.size,
            mime_type: file.type || null,
            sort_order: i,
          })
          .select('id, category, file_name, storage_path, file_size, mime_type, label, created_at')
          .single()

        if (insErr) {
          await supabase.storage.from(BUCKET).remove([path])
          showToast(insErr.message, 'error')
          continue
        }
        uploaded.push(row as BrandAsset)
      }

      if (uploaded.length) {
        setAssets(prev => {
          const without = single ? prev.filter(a => a.category !== category) : prev
          return [...without, ...uploaded]
        })
        showToast(`${uploaded.length}개 파일 업로드 완료`, 'success')
      }
    } finally {
      setUploadingCat(null)
    }
  }

  function saveMemo(value: string) {
    if (!brandId || !editMode) return
    setArchiveMemo(value)
    if (memoTimer.current) clearTimeout(memoTimer.current)
    memoTimer.current = setTimeout(async () => {
      const { error } = await supabase
        .from('confirmed_brands')
        .update({ archive_memo: value || null })
        .eq('id', brandId)
      if (error) showToast(error.message, 'error')
      else setBrands(prev => prev.map(b => b.id === brandId ? { ...b, archive_memo: value || null } : b))
    }, 700)
  }

  async function handleSave() {
    if (!brandId || saving) return
    if (uploadingCat) {
      showToast('업로드가 완료될 때까지 기다려 주세요', 'error')
      return
    }
    setSaving(true)
    if (memoTimer.current) clearTimeout(memoTimer.current)
    try {
      const { error } = await supabase
        .from('confirmed_brands')
        .update({ archive_memo: archiveMemo || null })
        .eq('id', brandId)
      if (error) {
        showToast(error.message, 'error')
        return
      }
      setBrands(prev => prev.map(b => b.id === brandId ? { ...b, archive_memo: archiveMemo || null } : b))
      setEditMode(false)
      showToast('저장되었습니다', 'success')
    } finally {
      setSaving(false)
    }
  }

  const assetsFor = (cat: CategoryKey) => assets.filter(a => a.category === cat)

  const countCategoryAssets = (cat: CategoryKey) => {
    const list = assetsFor(cat)
    if (cat === 'ingredients') return list.filter(a => !isWordAsset(a)).length
    return list.length
  }

  const galleryImages = useMemo(() => {
    const order: CategoryKey[] = [...VIEW_TOP_ROW, 'ingredients']
    const result: BrandAsset[] = []
    for (const cat of order) {
      for (const asset of assetsFor(cat)) {
        if (isPreviewableImageAsset(asset)) result.push(asset)
      }
    }
    return result
  }, [assets])

  function openGallery(assetId: string) {
    const idx = galleryImages.findIndex(a => a.id === assetId)
    if (idx >= 0) setGalleryIndex(idx)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spinner />
      </div>
    )
  }

  if (!brand) return null

  function renderViewAssets() {
    return (
      <div className="brand-archive-assets">
        <div className="brand-archive-asset-grid">
          {VIEW_TOP_ROW.map(key => {
            const cat = CATEGORIES.find(c => c.key === key)!
            const catAssets = assetsFor(key)
            return (
              <div key={key} className="brand-archive-asset-slot">
                <ViewCategoryHeader label={cat.label} viewHint={cat.viewHint} />
                {catAssets.length === 0 ? (
                  <ViewEmptyPlaceholder />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {catAssets.map(asset => (
                      <div key={asset.id}>
                        <AssetPreview asset={asset} variant="thumb" onImageClick={() => openGallery(asset.id)} />
                        <ViewAssetFooter asset={asset} onDownload={downloadAsset} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {(['ingredients'] as CategoryKey[]).map(key => {
          const cat = CATEGORIES.find(c => c.key === key)!
          const catAssets = assetsFor(key)
          return (
            <div key={key} className="brand-archive-asset-slot brand-archive-asset-slot--wide">
              <ViewCategoryHeader label={cat.label} viewHint={cat.viewHint} />
              {catAssets.length === 0 ? (
                <ViewEmptyPlaceholder />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {catAssets.map(asset => (
                    <div key={asset.id}>
                      <AssetPreview asset={asset} variant="full" onImageClick={() => openGallery(asset.id)} />
                      <ViewAssetFooter asset={asset} onDownload={downloadAsset} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  function renderEditAssets() {
    return (
      <div className="brand-archive-assets">
        {CATEGORIES.map(cat => {
          const catAssets = assetsFor(cat.key)
          const busy = uploadingCat === cat.key
          return (
            <section key={cat.key} className="brand-archive-edit-section">
              <div className="brand-archive-edit-section__head">
                <div>
                  <div className="brand-archive-cat-head__title">{cat.label}</div>
                  <div className="brand-archive-cat-head__hint">
                    {cat.hint} · {countCategoryAssets(cat.key)}개
                  </div>
                </div>
                <label className="cfg-btn" style={{ cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                  <Upload size={13} />
                  {busy ? '업로드 중…' : '업로드'}
                  <input
                    type="file"
                    accept={cat.accept}
                    multiple={!cat.single}
                    style={{ display: 'none' }}
                    disabled={busy}
                    onChange={e => {
                      uploadFiles(cat.key, e.target.files, cat.single)
                      e.target.value = ''
                    }}
                  />
                </label>
              </div>

              {catAssets.length === 0 ? (
                <div className="brand-archive-empty-slot" style={{ minHeight: 64 }}>등록된 파일 없음</div>
              ) : (
                <ul className="brand-archive-file-list">
                  {catAssets.map(asset => (
                    <li key={asset.id} className="brand-archive-file-item">
                      <div style={{ minWidth: 0 }}>
                        <div className="brand-archive-asset-footer__name">{asset.file_name}</div>
                        <div className="brand-archive-asset-footer__size">{formatBytes(asset.file_size)}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button type="button" className="cfg-btn cfg-btn--ghost" title="다운로드" onClick={() => downloadAsset(asset)}>
                          <Download size={14} />
                        </button>
                        <button type="button" className="cfg-btn cfg-btn--ghost" title="삭제" onClick={() => {
                          showConfirm(`"${asset.file_name}" 삭제할까요?`, () => { void deleteAsset(asset) })
                        }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}
        <div className="brand-archive-save-bar">
          <button
            type="button"
            className="cfg-btn"
            disabled={saving || !!uploadingCat}
            onClick={handleSave}
          >
            <Save size={13} />
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    )
  }

  const brandInitial = brand.brand_name.trim().charAt(0) || '?'

  const brandBar = (
    <div className="brand-archive-detail__brand-bar">
      <div className={`brand-archive-detail__avatar${logoUrl ? ' brand-archive-detail__avatar--logo' : ''}`}>
        {logoUrl ? <img src={logoUrl} alt={brand.brand_name} /> : brandInitial}
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="brand-archive-detail__name">{brand.brand_name}</div>
        <div className="brand-archive-detail__product">{brand.product || '제품명 없음'}</div>
      </div>
    </div>
  )

  return (
    <div className="brand-archive-detail">
      <div className="brand-archive-detail__header">
        <div className="brand-archive-detail__header-row">
          <Link to="/brand/confirmed/archive" className="brand-archive-detail__back">
            <ArrowLeft size={14} />
            목록
          </Link>

          <div className="brand-archive-detail__actions">
            {!editMode && (
              <button
                type="button"
                className="cfg-btn cfg-btn--ghost"
                onClick={() => setEditMode(true)}
              >
                <Pencil size={13} />
                편집
              </button>
            )}
          </div>
        </div>
      </div>

      {assetsLoading ? (
        <div className="brand-archive-detail__body">
          {!editMode && brandBar}
          <div style={{ display: 'flex', justifyContent: 'center', padding: 56 }}><Spinner /></div>
        </div>
      ) : (
        <div className="brand-archive-detail__body">
          {!editMode && brandBar}
          <ArchiveMemoPanel
            layout="top"
            editMode={editMode}
            archiveMemo={archiveMemo}
            onSave={saveMemo}
          />
          <div className="brand-archive-download-bar">
            <div className="brand-archive-download-bar__line" />
            <button
              type="button"
              className="cfg-btn"
              disabled={!assets.length || downloadingAll}
              onClick={downloadAll}
            >
              <Download size={13} />
              {downloadingAll ? '다운로드 중…' : '전체 다운로드'}
            </button>
          </div>
          {editMode ? renderEditAssets() : renderViewAssets()}
        </div>
      )}
      {galleryIndex !== null && galleryImages.length > 0 && (
        <ArchiveImageGalleryLightbox
          assets={galleryImages}
          currentIndex={galleryIndex}
          onClose={() => setGalleryIndex(null)}
          onChangeIndex={setGalleryIndex}
        />
      )}
    </div>
  )
}
