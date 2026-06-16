import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Trash2, Upload } from 'lucide-react'
import { supabase } from '../../../../lib/supabase'
import { usePhase } from '../../../../contexts/PhaseContext'
import { useToast } from '../../../../contexts/ToastContext'
import Spinner from '../../../../components/Spinner'

const BUCKET = 'brand-archive'

const CATEGORIES = [
  { key: 'logo',          label: '브랜드 로고',           hint: 'AI / PNG / SVG',  accept: '.ai,.png,.svg,image/png,image/svg+xml', single: true  },
  { key: 'product_main',  label: '제품 이미지 (대표)',    hint: '대표 사진 1장',   accept: 'image/*',                                 single: true  },
  { key: 'product_sub',   label: '제품 이미지 (서브)',    hint: '서브 사진 (복수)', accept: 'image/*',                                 single: false },
  { key: 'cutout',        label: '제품 누끼',             hint: '누끼 PNG 등',     accept: 'image/*',                                 single: false },
  { key: 'ingredients',   label: '전성분표',              hint: 'PDF / 이미지',    accept: '.pdf,image/*,application/pdf',            single: false },
] as const

type CategoryKey = typeof CATEGORIES[number]['key']

interface ConfirmedBrand {
  id:         string
  brand_name: string
  product:    string | null
  received:   boolean
}

interface BrandAsset {
  id:           string
  category:     CategoryKey
  file_name:    string
  storage_path: string
  file_size:    number | null
  mime_type:    string | null
  label:        string | null
  created_at:   string
}

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-()가-힣]/g, '_')
}

function formatBytes(n: number | null | undefined) {
  if (!n) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export default function BrandConfirmedArchive() {
  const { selectedPhaseId } = usePhase()
  const { showToast } = useToast()

  const [brands, setBrands] = useState<ConfirmedBrand[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [assets, setAssets] = useState<BrandAsset[]>([])
  const [assetsLoading, setAssetsLoading] = useState(false)
  const [archiveMemo, setArchiveMemo] = useState('')
  const [uploadingCat, setUploadingCat] = useState<CategoryKey | null>(null)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const memoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedBrand = brands.find(b => b.id === selectedId) ?? null

  const loadBrands = useCallback(async () => {
    if (!selectedPhaseId) { setBrands([]); setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('confirmed_brands')
      .select('id, brand_name, product, received')
      .eq('phase_id', selectedPhaseId)
      .order('brand_name')
    if (error) { showToast(error.message, 'error'); setLoading(false); return }
    const list = (data ?? []) as ConfirmedBrand[]
    setBrands(list)
    setSelectedId(prev => (prev && list.some(b => b.id === prev) ? prev : list[0]?.id ?? null))
    setLoading(false)
  }, [selectedPhaseId, showToast])

  const loadAssets = useCallback(async (brandId: string) => {
    setAssetsLoading(true)
    const [{ data: assetRows, error: assetErr }, { data: metaRow, error: metaErr }] = await Promise.all([
      supabase
        .from('confirmed_brand_assets')
        .select('id, category, file_name, storage_path, file_size, mime_type, label, created_at')
        .eq('confirmed_brand_id', brandId)
        .order('sort_order')
        .order('created_at'),
      supabase
        .from('confirmed_brand_archive_meta')
        .select('archive_memo')
        .eq('confirmed_brand_id', brandId)
        .maybeSingle(),
    ])
    if (assetErr) showToast(assetErr.message, 'error')
    if (metaErr) showToast(metaErr.message, 'error')
    setAssets((assetRows ?? []) as BrandAsset[])
    setArchiveMemo(metaRow?.archive_memo ?? '')
    setAssetsLoading(false)
  }, [showToast])

  useEffect(() => { loadBrands() }, [loadBrands])

  useEffect(() => {
    if (selectedId) loadAssets(selectedId)
    else { setAssets([]); setArchiveMemo('') }
  }, [selectedId, loadAssets])

  async function deleteAsset(asset: BrandAsset, silent = false) {
    const { error: storageErr } = await supabase.storage.from(BUCKET).remove([asset.storage_path])
    if (storageErr) { showToast(storageErr.message, 'error'); return false }
    const { error } = await supabase.from('confirmed_brand_assets').delete().eq('id', asset.id)
    if (error) { showToast(error.message, 'error'); return false }
    setAssets(prev => prev.filter(a => a.id !== asset.id))
    if (!silent) showToast('파일이 삭제되었습니다', 'success')
    return true
  }

  async function downloadAsset(asset: BrandAsset) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(asset.storage_path, 3600)
    if (error || !data?.signedUrl) { showToast(error?.message ?? '다운로드 URL 생성 실패', 'error'); return }
    const a = document.createElement('a')
    a.href = data.signedUrl
    a.download = asset.file_name
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  async function downloadAll() {
    if (!assets.length) { showToast('다운로드할 파일이 없습니다', 'error'); return }
    setDownloadingAll(true)
    try {
      for (const asset of assets) {
        await downloadAsset(asset)
        await new Promise(r => setTimeout(r, 350))
      }
      showToast(`${assets.length}개 파일 다운로드 시작`, 'success')
    } finally {
      setDownloadingAll(false)
    }
  }

  async function uploadFiles(category: CategoryKey, files: FileList | null, single: boolean) {
    if (!selectedId || !selectedPhaseId || !files?.length) return
    setUploadingCat(category)
    try {
      if (single) {
        const existing = assets.filter(a => a.category === category)
        for (const a of existing) await deleteAsset(a, true)
      }


      const uploaded: BrandAsset[] = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const path = `${selectedPhaseId}/${selectedId}/${category}/${Date.now()}_${i}_${sanitizeFileName(file.name)}`
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
          cacheControl: '3600',
          upsert: false,
        })
        if (upErr) { showToast(upErr.message, 'error'); continue }

        const { data: row, error: insErr } = await supabase
          .from('confirmed_brand_assets')
          .insert({
            confirmed_brand_id: selectedId,
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
    if (!selectedId) return
    setArchiveMemo(value)
    if (memoTimer.current) clearTimeout(memoTimer.current)
    memoTimer.current = setTimeout(async () => {
      const { error } = await supabase
        .from('confirmed_brand_archive_meta')
        .upsert({ confirmed_brand_id: selectedId, archive_memo: value || null, updated_at: new Date().toISOString() })
      if (error) showToast(error.message, 'error')
    }, 700)
  }

  const filteredBrands = brands.filter(b => {
    if (!search) return true
    const q = search.toLowerCase()
    return b.brand_name.toLowerCase().includes(q) || (b.product ?? '').toLowerCase().includes(q)
  })

  const assetsFor = (cat: CategoryKey) => assets.filter(a => a.category === cat)

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spinner />
      </div>
    )
  }

  if (!brands.length) {
    return (
      <div style={{
        background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)',
        padding: 48, textAlign: 'center', color: 'var(--gray-5)', fontSize: 13, lineHeight: 1.7,
      }}>
        확정 브랜드가 없습니다.<br />
        <strong>브랜드 관리</strong> 탭에서 확정 브랜드를 먼저 추가하세요.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 16, minHeight: 520, alignItems: 'stretch' }}>
      {/* Brand list */}
      <div style={{
        width: 260, flexShrink: 0, background: 'var(--gray-0)', borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow)', padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
          확정 브랜드 ({brands.length})
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="브랜드 검색…"
          style={{
            width: '100%', padding: '7px 10px', border: '1px solid var(--gray-3)', borderRadius: 8,
            fontSize: 12, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
          }}
        />
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filteredBrands.map(b => {
            const active = b.id === selectedId
            const count = b.id === selectedId ? assets.length : undefined
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedId(b.id)}
                style={{
                  textAlign: 'left', padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                  border: active ? '1px solid var(--teal)' : '1px solid var(--gray-2)',
                  background: active ? 'var(--teal-lt)' : 'var(--gray-0)',
                  fontFamily: 'inherit',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: active ? 'var(--teal-dk)' : 'var(--gray-7)' }}>
                  {b.brand_name}
                </div>
                {b.product && (
                  <div style={{ fontSize: 11, color: 'var(--gray-5)', marginTop: 2 }}>{b.product}</div>
                )}
                {active && count != null && (
                  <div style={{ fontSize: 10, color: 'var(--gray-4)', marginTop: 4 }}>파일 {count}개</div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Asset panel */}
      <div style={{
        flex: 1, background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)',
        padding: 20, minWidth: 0,
      }}>
        {!selectedBrand ? (
          <div style={{ color: 'var(--gray-5)', fontSize: 13, textAlign: 'center', padding: 40 }}>브랜드를 선택하세요</div>
        ) : assetsLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner /></div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--gray-7)' }}>{selectedBrand.brand_name}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-5)', marginTop: 4 }}>
                  브랜드별 자료 업로드 · 다운로드
                </div>
              </div>
              <button
                type="button"
                className="cfg-btn"
                disabled={!assets.length || downloadingAll}
                onClick={downloadAll}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Download size={14} />
                {downloadingAll ? '다운로드 중…' : '전체 다운로드'}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {CATEGORIES.map(cat => {
                const catAssets = assetsFor(cat.key)
                const busy = uploadingCat === cat.key
                return (
                  <section
                    key={cat.key}
                    style={{
                      border: '1px solid var(--gray-2)', borderRadius: 10, padding: 14,
                      background: 'var(--gray-0)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-7)' }}>{cat.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--gray-5)', marginTop: 2 }}>{cat.hint}</div>
                      </div>
                      <label className="cfg-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                        <Upload size={14} />
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
                      <div style={{ fontSize: 12, color: 'var(--gray-4)', padding: '8px 0' }}>등록된 파일 없음</div>
                    ) : (
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {catAssets.map(asset => (
                          <li
                            key={asset.id}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                              padding: '8px 10px', borderRadius: 8, background: 'var(--gray-1)',
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {asset.file_name}
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--gray-5)', marginTop: 2 }}>
                                {formatBytes(asset.file_size)}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                              <button type="button" className="cfg-btn cfg-btn--ghost" title="다운로드" onClick={() => downloadAsset(asset)}>
                                <Download size={14} />
                              </button>
                              <button type="button" className="cfg-btn cfg-btn--ghost" title="삭제" onClick={() => {
                                if (confirm(`"${asset.file_name}" 삭제할까요?`)) deleteAsset(asset)
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

              <section style={{ border: '1px solid var(--gray-2)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-7)', marginBottom: 8 }}>기타 메모</div>
                <textarea
                  value={archiveMemo}
                  onChange={e => saveMemo(e.target.value)}
                  placeholder="브랜드 자료 관련 메모 (링크, 요청사항, 참고사항 등)"
                  rows={4}
                  style={{
                    width: '100%', padding: '10px 12px', border: '1px solid var(--gray-3)', borderRadius: 8,
                    fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                />
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
