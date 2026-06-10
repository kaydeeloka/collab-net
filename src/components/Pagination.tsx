interface Props {
  page: number
  totalPages: number
  total: number
  startIdx: number
  endIdx: number
  onPrev: () => void
  onNext: () => void
}

export default function Pagination({ page, totalPages, total, startIdx, endIdx, onPrev, onNext }: Props) {
  if (total === 0) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 16px', borderTop: '1px solid var(--gray-2)',
      background: 'var(--gray-0)', borderBottomLeftRadius: 'var(--radius)', borderBottomRightRadius: 'var(--radius)',
    }}>
      <span style={{ fontSize: 12, color: 'var(--gray-5)' }}>
        {startIdx + 1}–{endIdx} / 전체 {total}개
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={onPrev} disabled={page <= 1}
          style={{
            padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8,
            border: '1px solid var(--gray-3)', background: '#fff',
            cursor: page <= 1 ? 'default' : 'pointer',
            color: page <= 1 ? 'var(--gray-3)' : 'var(--gray-7)',
          }}>
          ← 이전
        </button>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-6)', minWidth: 60, textAlign: 'center' }}>
          {page} / {totalPages}
        </span>
        <button onClick={onNext} disabled={page >= totalPages}
          style={{
            padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8,
            border: '1px solid var(--gray-3)', background: '#fff',
            cursor: page >= totalPages ? 'default' : 'pointer',
            color: page >= totalPages ? 'var(--gray-3)' : 'var(--gray-7)',
          }}>
          다음 →
        </button>
      </div>
    </div>
  )
}
