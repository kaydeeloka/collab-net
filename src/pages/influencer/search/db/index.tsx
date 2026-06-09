import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../../lib/supabase'
import { usePhase } from '../../../../contexts/PhaseContext'
import { fmtNum } from '../../../../lib/utils'
import Spinner from '../../../../components/Spinner'

interface Influencer {
  id: string
  created_at: string
  handle: string
  display_name: string | null
  email: string | null
  followers: number
  following: number
  following_ratio: string | null
  engagement_rate: number
  profile_url: string | null
  outreach: string
  tiers: { rank: string; label: string; category: string } | null
}

const TIER_TABS = ['전체', '1순위', '2순위', '3순위', '4순위', '5순위']

const TIER_COLOR: Record<string, string> = {
  '1순위': '#6366f1',  // indigo
  '2순위': '#10b981',  // emerald
  '3순위': '#3b82f6',  // blue
  '4순위': '#f59e0b',  // amber
  '5순위': '#ec4899',  // pink
}

const OUTREACH_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  yes:       { bg: '#dbeafe', color: '#1d4ed8', label: '완료' },
  reply:     { bg: '#fef3c7', color: '#d97706', label: '답장' },
  negotiate: { bg: '#d1fae5', color: '#065f46', label: '협의중' },
  accept:    { bg: '#bbf7d0', color: '#14532d', label: '수락확정' },
  reject:    { bg: '#fee2e2', color: '#991b1b', label: '거절' },
  target:    { bg: '#ede9fe', color: '#6d28d9', label: '컨택예정' },
  default:   { bg: '#f1f5f9', color: '#64748b', label: '미발송' },
}

export default function SearchDbList() {
  const { activePhaseId } = usePhase()
  const [influencers, setInfluencers] = useState<Influencer[]>([])
  const [loading, setLoading]         = useState(false)
  const [tierTab, setTierTab]         = useState('전체')
  const [search, setSearch]           = useState('')

  useEffect(() => {
    if (!activePhaseId) return
    load()
  }, [activePhaseId])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('influencers')
      .select('id, created_at, handle, display_name, email, followers, following, following_ratio, engagement_rate, profile_url, outreach, tiers(rank, label, category)')
      .eq('phase_id', activePhaseId!)
      .order('created_at', { ascending: false })
    setInfluencers((data ?? []) as unknown as Influencer[])
    setLoading(false)
  }

  const deleteInfluencer = useCallback(async (id: string) => {
    if (!confirm('이 인플루언서를 삭제하시겠습니까?')) return
    await supabase.from('influencers').delete().eq('id', id)
    setInfluencers(prev => prev.filter(i => i.id !== id))
  }, [])

  const filtered = influencers.filter(inf => {
    const matchTier = tierTab === '전체' || inf.tiers?.rank === tierTab
    const q = search.toLowerCase()
    const matchSearch = !q || (inf.handle?.toLowerCase().includes(q)) || (inf.display_name?.toLowerCase().includes(q)) || (inf.email?.toLowerCase().includes(q))
    return matchTier && matchSearch
  })

  const kbeautyCount  = influencers.filter(i => i.tiers?.category === 'K-뷰티').length
  const beautyCount   = influencers.filter(i => i.tiers?.category === '일반뷰티').length
  const noTierCount   = influencers.filter(i => !i.tiers).length

  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">🗂️</span>
        <div>
          <div className="page-banner-title">DB 리스트</div>
          <div className="page-banner-desc">현재 차수의 전체 인플루언서 DB입니다. 순위별로 필터하세요.</div>
        </div>
      </div>

      <div className="cards">
        <div className="card"><div className="card-label">전체 DB</div><div className="card-value">{influencers.length || '—'}</div></div>
        <div className="card"><div className="card-label">K-뷰티</div><div className="card-value">{kbeautyCount || '—'}</div></div>
        <div className="card"><div className="card-label">일반뷰티</div><div className="card-value">{beautyCount || '—'}</div></div>
        {noTierCount > 0 && (
          <div className="card"><div className="card-label">순위 미배정</div><div className="card-value" style={{ color: 'var(--orange)' }}>{noTierCount}</div></div>
        )}
      </div>

      {/* Tier filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {TIER_TABS.map(tab => {
          const tc = TIER_COLOR[tab]
          const isActive = tierTab === tab
          return (
          <button
            key={tab}
            onClick={() => setTierTab(tab)}
            style={{
              padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 20, cursor: 'pointer',
              border: isActive && tc ? `2px solid ${tc}` : '2px solid transparent',
              background: isActive ? (tc ?? 'var(--blue-dk)') : 'var(--gray-1)',
              color:      isActive ? '#fff' : (tc ?? 'var(--gray-6)'),
            }}>
            {tab}
            {tab !== '전체' && (
              <span style={{ marginLeft: 5, opacity: 0.7 }}>
                {influencers.filter(i => i.tiers?.rank === tab).length}
              </span>
            )}
          </button>
          )
        })}

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="핸들 / 이름 / 이메일 검색"
          style={{ marginLeft: 'auto', padding: '5px 12px', fontSize: 12, borderRadius: 8, border: '1px solid var(--gray-3)', outline: 'none', minWidth: 200 }}
        />
      </div>

      <div className="table-wrap">
        {loading
          ? <div style={{ padding: 60, textAlign: 'center' }}><Spinner /></div>
          : (
          <table>
            <thead>
              <tr>
                <th>크리에이터</th>
                <th>이메일</th>
                <th style={{ textAlign: 'right' }}>팔로워</th>
                <th style={{ textAlign: 'right' }}>팔로잉비율</th>
                <th style={{ textAlign: 'right' }}>인게이지율</th>
                <th>카테고리</th>
                <th style={{ textAlign: 'center' }}>아웃리치</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
                : filtered.map(inf => {
                    const os        = OUTREACH_STYLE[inf.outreach] ?? OUTREACH_STYLE.default
                    const tierColor = inf.tiers?.rank ? TIER_COLOR[inf.tiers.rank] : undefined
                    return (
                      <tr key={inf.id} style={tierColor ? { borderLeft: `3px solid ${tierColor}` } : undefined}>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{inf.display_name || '—'}</div>
                          <a
                            href={inf.profile_url || `https://www.tiktok.com/@${inf.handle}`}
                            target="_blank" rel="noopener"
                            style={{ fontSize: 11, color: 'var(--blue-dk)', textDecoration: 'none' }}>
                            @{inf.handle}
                          </a>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--gray-6)' }}>{inf.email || '—'}</td>
                        <td style={{ textAlign: 'right', fontSize: 12, fontWeight: 600 }}>
                          {inf.followers ? fmtNum(String(inf.followers)) : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontSize: 12 }}>{inf.following_ratio || '—'}</td>
                        <td style={{ textAlign: 'right', fontSize: 12 }}>
                          {inf.engagement_rate ? `${inf.engagement_rate}%` : '—'}
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--gray-6)' }}>{inf.tiers?.category ?? '—'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{
                            padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                            background: os.bg, color: os.color,
                          }}>
                            {os.label}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => deleteInfluencer(inf.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-4)', fontSize: 15, lineHeight: 1, padding: '2px 6px', borderRadius: 4 }}
                            title="삭제">
                            ✕
                          </button>
                        </td>
                      </tr>
                    )
                  })
              }
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
