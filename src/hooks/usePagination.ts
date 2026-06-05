import { useState, useEffect } from 'react'

export function usePagination<T>(items: T[], pageSize = 25) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage   = Math.min(page, totalPages)
  const start      = (safePage - 1) * pageSize
  const pageItems  = items.slice(start, start + pageSize)

  // Reset to page 1 when data changes
  useEffect(() => { setPage(1) }, [items.length])

  return {
    page: safePage,
    totalPages,
    pageItems,
    setPage,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
    goNext:  () => setPage(p => Math.min(p + 1, totalPages)),
    goPrev:  () => setPage(p => Math.max(p - 1, 1)),
    total:    items.length,
    startIdx: start,
    endIdx:   Math.min(start + pageSize, items.length),
  }
}
