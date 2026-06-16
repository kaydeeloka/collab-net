import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Package, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usePhase } from '@/contexts/PhaseContext'
import { useToast } from '@/contexts/ToastContext'
import Spinner from '@/components/Spinner'
import {
  type ConfirmedBrand,
  type BrandAsset,
  getSignedUrl,
} from './shared'
import { archiveDetailPath } from './slug'

function ArchiveBrandCard({
  brand,
  detailPath,
}: {
  brand: ConfirmedBrand
  detailPath: string
}) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadThumb() {
      const { data } = await supabase
        .from('confirmed_brand_assets')
        .select('storage_path, category')
        .eq('confirmed_brand_id', brand.id)
        .in('category', ['logo', 'product_main'])
        .order('sort_order')
        .order('created_at')

      const rows = (data ?? []) as Pick<BrandAsset, 'storage_path' | 'category'>[]
      const pick = rows.find(r => r.category === 'product_main') ?? rows.find(r => r.category === 'logo')
      if (!pick) return

      const { url } = await getSignedUrl(pick.storage_path)
      if (!cancelled) setThumbUrl(url)
    }

    loadThumb()
    return () => { cancelled = true }
  }, [brand.id])

  return (
    <Link to={detailPath} className="brand-archive-card">
      <div className="brand-archive-card__media">
        {thumbUrl ? (
          <>
            <img src={thumbUrl} alt="" />
            <div className="brand-archive-card__media-overlay" />
          </>
        ) : (
          <Package size={48} className="brand-archive-card__placeholder" strokeWidth={1.2} />
        )}
        <span className={`brand-archive-card__status ${brand.received ? 'brand-archive-card__status--done' : 'brand-archive-card__status--pending'}`}>
          {brand.received ? '수령 완료' : '수령 대기'}
        </span>
      </div>

      <div className="brand-archive-card__body">
        <div className="brand-archive-card__title">{brand.brand_name}</div>
        <div className="brand-archive-card__product">{brand.product || '제품명 없음'}</div>
        <div className="brand-archive-card__footer">
          <span className="brand-archive-card__cta">
            상세 보기
            <ChevronRight size={15} />
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function BrandArchiveList() {
  const { selectedPhaseId } = usePhase()
  const { showToast } = useToast()
  const [brands, setBrands] = useState<ConfirmedBrand[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const loadBrands = useCallback(async () => {
    if (!selectedPhaseId) { setBrands([]); setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('confirmed_brands')
      .select('id, brand_name, product, received')
      .eq('phase_id', selectedPhaseId)
      .order('brand_name')
    if (error) { showToast(error.message, 'error'); setLoading(false); return }
    setBrands((data ?? []) as ConfirmedBrand[])
    setLoading(false)
  }, [selectedPhaseId, showToast])

  useEffect(() => { loadBrands() }, [loadBrands])

  const filtered = brands.filter(b => {
    if (!search) return true
    const q = search.toLowerCase()
    return b.brand_name.toLowerCase().includes(q) || (b.product ?? '').toLowerCase().includes(q)
  })

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spinner />
      </div>
    )
  }

  if (!brands.length) {
    return (
      <div className="brand-archive-empty">
        확정 브랜드가 없습니다.<br />
        <strong>브랜드 관리</strong> 탭에서 확정 브랜드를 먼저 추가하세요.
      </div>
    )
  }

  return (
    <div className="brand-archive-list">
      <div className="brand-archive-toolbar">
        <div className="brand-archive-search">
          <Search size={16} className="brand-archive-search-icon" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="브랜드, 제품명 검색…"
          />
        </div>
        <span className="brand-archive-count">
          {filtered.length}개 브랜드{search ? ` / ${brands.length}` : ''}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="brand-archive-empty">검색 결과가 없습니다</div>
      ) : (
        <div className="brand-archive-grid">
          {filtered.map(brand => (
            <ArchiveBrandCard
              key={brand.id}
              brand={brand}
              detailPath={archiveDetailPath(brand, brands)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
