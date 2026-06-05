import { useState } from 'react'
import { useToast } from '../../../../contexts/ToastContext'
import { addToContactList } from '../../../../lib/contactList'
import { fmtNum } from '../../../../lib/utils'

interface DbInfluencer {
  rank: string
  handle: string
  name: string
  email: string
  followers: string
  engagement: string
  category: string
}

const SAMPLE_DATA: DbInfluencer[] = []

export default function SearchDbList() {
  const { showToast } = useToast()
  const [added, setAdded] = useState<Set<string>>(new Set())

  function handleAddToContact(inf: DbInfluencer) {
    const ok = addToContactList({
      name: inf.name,
      handle: inf.handle,
      email: inf.email,
      followers: inf.followers,
      avgViews: '',
    })
    if (ok) {
      setAdded(prev => new Set(prev).add(inf.handle))
      showToast(`${inf.name || inf.handle} 컨택 예정에 추가됨`, 'success')
    } else {
      showToast('이미 추가된 인플루언서입니다.', 'info')
    }
  }

  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">🗂️</span>
        <div>
          <div className="page-banner-title">DB 리스트</div>
          <div className="page-banner-desc">리스트업된 전체 인플루언서 DB를 조회합니다. 컨택 대상을 선택해 컨택 예정에 추가하세요.</div>
        </div>
      </div>

      <div className="cards">
        <div className="card"><div className="card-label">전체 DB</div><div className="card-value">{SAMPLE_DATA.length || '—'}</div></div>
        <div className="card"><div className="card-label">K-뷰티</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">일반뷰티</div><div className="card-value">—</div></div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>순위</th>
              <th>플랫폼</th>
              <th>핸들</th>
              <th>인플루언서명</th>
              <th>이메일</th>
              <th style={{ textAlign: 'right' }}>팔로워</th>
              <th style={{ textAlign: 'right' }}>인게이지먼트율</th>
              <th>카테고리</th>
              <th style={{ textAlign: 'center' }}>컨택</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_DATA.length === 0
              ? <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
              : SAMPLE_DATA.map((inf, i) => (
                  <tr key={inf.handle}>
                    <td style={{ color: 'var(--gray-4)', fontSize: 12 }}>{inf.rank || i + 1}</td>
                    <td><span className="platform-badge platform-tiktok">TikTok</span></td>
                    <td style={{ fontSize: 12 }}>
                      <a href={`https://www.tiktok.com/@${inf.handle}`} target="_blank" rel="noopener"
                        style={{ color: 'var(--blue-dk)', textDecoration: 'none', fontWeight: 500 }}>
                        @{inf.handle}
                      </a>
                    </td>
                    <td style={{ fontWeight: 600, fontSize: 13 }}>{inf.name || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--gray-6)' }}>{inf.email || '—'}</td>
                    <td style={{ textAlign: 'right', fontSize: 12, fontWeight: 600 }}>{inf.followers ? fmtNum(inf.followers) : '—'}</td>
                    <td style={{ textAlign: 'right', fontSize: 12 }}>{inf.engagement || '—'}</td>
                    <td style={{ fontSize: 12 }}>{inf.category || '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => handleAddToContact(inf)}
                        disabled={added.has(inf.handle)}
                        style={{
                          padding: '4px 12px', fontSize: 11, fontWeight: 700, borderRadius: 6, cursor: added.has(inf.handle) ? 'default' : 'pointer',
                          background: added.has(inf.handle) ? 'var(--gray-1)' : 'var(--blue-dk)',
                          color: added.has(inf.handle) ? 'var(--gray-4)' : '#fff',
                          border: added.has(inf.handle) ? '1px solid var(--gray-3)' : 'none',
                        }}>
                        {added.has(inf.handle) ? '추가됨' : '컨택 대상'}
                      </button>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}
