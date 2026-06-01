import { useEffect, useState } from 'react'
import { gasGet, gasPost } from '../lib/api'
import { useToast } from '../contexts/ToastContext'
import Spinner from '../components/Spinner'

interface ConfirmedData {
  ok?: boolean
  error?: string
  headers?: string[]
  rows?: string[][]
}

type UploadStatus = 'Pending' | 'Yes' | 'No' | 'all'

export default function Confirmed() {
  const { showToast } = useToast()
  const [data, setData] = useState<ConfirmedData | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [uploadFilter, setUploadFilter] = useState<UploadStatus>('all')
  const [syncMsg, setSyncMsg] = useState('')
  const [colMap, setColMap] = useState<Record<string, number>>({})

  useEffect(() => { loadConfirmed() }, [])

  async function loadConfirmed() {
    setLoading(true)
    try {
      const d: ConfirmedData = await gasGet('getConfirmedInfluencers')
      setData(d)
      const cm: Record<string, number> = {}
      ;(d.headers || []).forEach((h, i) => { cm[h.trim().toLowerCase()] = i })
      setColMap(cm)
      const now = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      setSyncMsg(`마지막 동기화: ${now}`)
    } catch (e: unknown) { setData({ error: (e as Error).message }) }
    setLoading(false)
  }

  function get(row: string[], key: string): string {
    const i = colMap[key.toLowerCase()]
    return i !== undefined ? (row[i] || '') : ''
  }

  async function updateField(email: string, field: string, value: string) {
    try {
      await gasPost({ action: 'updateConfirmedInfluencer', email, [field]: value })
    } catch (e: unknown) { showToast((e as Error).message, 'error') }
  }

  async function deleteRow(email: string) {
    if (!confirm(`「${email}」을 삭제하시겠습니까?`)) return
    try {
      const res: { ok?: boolean; error?: string } = await gasPost({ action: 'deleteConfirmedInfluencer', email })
      if (res.ok) { showToast('삭제 완료', 'success'); loadConfirmed() }
      else showToast(res.error || '오류', 'error')
    } catch (e: unknown) { showToast((e as Error).message, 'error') }
  }

  const rows = (data?.rows || []).filter(r => {
    if (uploadFilter !== 'all' && get(r, '콘텐츠 업로드') !== uploadFilter) return false
    if (search) {
      const q = search.toLowerCase()
      const text = [get(r, 'display name'), get(r, 'handle'), get(r, 'email')].join(' ').toLowerCase()
      if (!text.includes(q)) return false
    }
    return true
  })

  const total = data?.rows?.length || 0
  const uploaded = (data?.rows || []).filter(r => get(r, '콘텐츠 업로드') === 'Yes').length
  const pending = (data?.rows || []).filter(r => get(r, '콘텐츠 업로드') === 'Pending').length

  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">✅</span>
        <div>
          <div className="page-banner-title">확정 인플루언서 관리</div>
          <div className="page-banner-desc">아웃리치에서 수락된 인플루언서 목록입니다. 콘텐츠 업로드 현황과 포스트 링크를 관리합니다.</div>
        </div>
        <div className="page-banner-actions">
          <button className="page-banner-btn page-banner-btn--secondary" onClick={loadConfirmed}>
            {loading ? <Spinner sm /> : <span style={{ color: 'var(--blue-dk)' }}>↻</span>} 새로고침
          </button>
        </div>
      </div>

      {loading && <div className="loader"><Spinner />데이터 불러오는 중...</div>}

      {!loading && data && !data.error && (
        <>
          <div className="cards">
            <div className="card"><div className="card-label">총 확정 인플루언서</div><div className="card-value">{total}</div></div>
            <div className="card highlight"><div className="card-label">콘텐츠 업로드 완료</div><div className="card-value" style={{ color: 'var(--green)' }}>{uploaded}</div><div className="card-sub">{total ? Math.round(uploaded / total * 100) : 0}% 완료율</div></div>
            <div className="card"><div className="card-label">업로드 대기중</div><div className="card-value">{pending}</div></div>
            <div className="card"><div className="card-label">미업로드</div><div className="card-value">{total - uploaded - pending}</div></div>
          </div>

          <div className="ems-toolbar" style={{ marginTop: 16 }}>
            <div className="section-title section-title--inline">확정 인플루언서 목록</div>
            <span className="ems-sync-msg">{syncMsg}</span>
          </div>

          <div className="filters" style={{ marginBottom: 16, marginTop: 12 }}>
            <input type="text" placeholder="이름, 이메일, 핸들로 검색..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, minWidth: 200, maxWidth: 360 }} />
            <div className="filter-group">
              <label>콘텐츠 업로드:</label>
              {(['all', 'Pending', 'Yes', 'No'] as UploadStatus[]).map((v, i) => (
                <button key={v} className={'ems-filter-btn' + (uploadFilter === v ? ' active' : '')} onClick={() => setUploadFilter(v)}>
                  {['전체', '대기', '완료', '미업로드'][i]}
                </button>
              ))}
            </div>
          </div>

          {rows.length === 0
            ? <div className="empty">검색 결과가 없습니다.</div>
            : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>수락일</th><th>차수</th><th>순위</th><th>Handle</th><th>Display Name</th>
                      <th>Email</th><th>팔로워</th><th>참여율</th><th>협찬품</th>
                      <th>콘텐츠 업로드</th><th>업로드 날짜</th><th>포스트 링크</th><th>메모</th><th>삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const email = get(r, 'email')
                      const uploadVal = get(r, '콘텐츠 업로드') || 'Pending'
                      const profileUrl = get(r, 'profile url')
                      const postLink = get(r, '포스트 링크')
                      return (
                        <tr key={i}>
                          <td style={{ fontSize: 11, color: 'var(--gray-5)' }}>{get(r, '수락일')}</td>
                          <td><span style={{ display: 'inline-block', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 999, fontSize: 10, fontWeight: 700, padding: '1px 8px' }}>{get(r, '차수')}</span></td>
                          <td style={{ fontSize: 11, color: 'var(--gray-5)' }}>{get(r, '순위')}</td>
                          <td>
                            {profileUrl
                              ? <a href={profileUrl} target="_blank" style={{ color: 'var(--blue-dk)' }}>{get(r, 'handle')}</a>
                              : get(r, 'handle')}
                          </td>
                          <td style={{ fontWeight: 700 }}>{get(r, 'display name')}</td>
                          <td style={{ fontSize: 11 }}><a href={`mailto:${email}`} style={{ color: 'var(--blue-dk)' }}>{email}</a></td>
                          <td style={{ fontSize: 11 }}>{get(r, '팔로워')}</td>
                          <td style={{ fontSize: 11 }}>{get(r, 'engagement rate (%)')}</td>
                          <td style={{ fontSize: 11 }}>{get(r, '협찬품') || '—'}</td>
                          <td>
                            <select
                              value={uploadVal}
                              onChange={e => updateField(email, 'contentUpload', e.target.value)}
                              style={{ fontSize: 11, padding: '2px 6px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}
                            >
                              <option value="Pending">⏳ 대기</option>
                              <option value="Yes">✓ 완료</option>
                              <option value="No">✕ 미업로드</option>
                            </select>
                          </td>
                          <td>
                            <input type="text" placeholder="YYYY-MM-DD" defaultValue={get(r, '업로드 날짜')}
                              onBlur={e => updateField(email, 'uploadDate', e.target.value)}
                              style={{ fontSize: 11, border: '1px solid #e2e8f0', borderRadius: 6, padding: '2px 6px', width: '100%', minWidth: 90 }} />
                          </td>
                          <td>
                            <input type="url" placeholder="https://..." defaultValue={postLink}
                              onBlur={e => updateField(email, 'postLink', e.target.value)}
                              style={{ fontSize: 11, border: '1px solid #e2e8f0', borderRadius: 6, padding: '2px 6px', width: '100%', minWidth: 100 }} />
                            {postLink && <><br /><a href={postLink} target="_blank" style={{ color: 'var(--blue-dk)', fontSize: 11 }}>↗ 보기</a></>}
                          </td>
                          <td>
                            <input type="text" placeholder="메모..." defaultValue={get(r, '메모')}
                              onBlur={e => updateField(email, 'memo', e.target.value)}
                              style={{ fontSize: 11, border: '1px solid #e2e8f0', borderRadius: 6, padding: '2px 6px', width: '100%', minWidth: 80 }} />
                          </td>
                          <td>
                            <button onClick={() => deleteRow(email)}
                              style={{ fontSize: 10, padding: '2px 8px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer' }}>
                              삭제
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
        </>
      )}

      {!loading && data?.error && <div className="empty">오류: {data.error}</div>}
    </div>
  )
}
