import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import { demoDb } from '@/lib/local-db'
import BeautyNewsShell from '../shell'
import ArchiveDetail from './detail'
import ArchiveList from './list'
import ArchiveSidebar from './sidebar'
import {
  type ArchiveItem,
  type ReportData,
  archiveItemSortDate,
  archiveMonthKey,
  reportFromRow,
} from './shared'
import { archiveDetailPath, findArchiveItemBySlug, parseArchiveSlug } from './slug'

const ARCHIVE_SELECT =
  'id, windows_start, windows_end, report_title, categories, keywords, created_at'

async function fetchArchiveItemByDate(date: string): Promise<ArchiveItem | null> {
  const { data, error } = await demoDb
    .from('beauty_news_archives')
    .select(ARCHIVE_SELECT)
  if (error || !data?.length) return null
  return (data as ArchiveItem[]).find(item => archiveItemSortDate(item) === date) ?? null
}

export default function BeautyNewsArchive() {
  const { slug } = useParams<{ slug?: string }>()
  const navigate = useNavigate()

  const [archiveItems, setArchiveItems] = useState<ArchiveItem[]>([])
  const [archiveListLoading, setArchiveListLoading] = useState(true)
  const [archiveFilterMonth, setArchiveFilterMonth] = useState<string | null>(null)

  const [detailItem, setDetailItem] = useState<ArchiveItem | null>(null)
  const [archiveReport, setArchiveReport] = useState<ReportData | null>(null)
  const [archiveReportLoading, setArchiveReportLoading] = useState(false)

  const slugDate = parseArchiveSlug(slug)
  const isDetail = Boolean(slugDate)
  const selectedKey = detailItem?.windows_start ?? ''

  const filteredArchiveItems = archiveFilterMonth
    ? archiveItems.filter(item => archiveMonthKey(item) === archiveFilterMonth)
    : archiveItems

  const refreshArchiveList = useCallback(async () => {
    setArchiveListLoading(true)
    try {
      const { data, error } = await demoDb
        .from('beauty_news_archives')
        .select(ARCHIVE_SELECT)
      if (error) throw error
      const sorted = [...(data || [])].sort((a, b) =>
        archiveItemSortDate(b as ArchiveItem).localeCompare(archiveItemSortDate(a as ArchiveItem)),
      ) as ArchiveItem[]
      setArchiveItems(sorted)
    } catch {}
    finally { setArchiveListLoading(false) }
  }, [])

  useEffect(() => {
    void refreshArchiveList()
  }, [refreshArchiveList])

  useEffect(() => {
    if (!slugDate) {
      setDetailItem(null)
      setArchiveReport(null)
      setArchiveReportLoading(false)
      return
    }

    let cancelled = false
    setArchiveReportLoading(true)

    async function loadDetail() {
      const fromList = findArchiveItemBySlug(archiveItems, slugDate!)
      const item = fromList ?? await fetchArchiveItemByDate(slugDate!)
      if (cancelled) return

      if (!item) {
        setDetailItem(null)
        setArchiveReport(null)
        setArchiveReportLoading(false)
        return
      }

      setDetailItem(item)

      const cached = archiveItems.find(a => a.windows_start === item.windows_start)
      if (cached?.categories != null && cached.categories !== '') {
        setArchiveReport(reportFromRow(cached, true))
        setArchiveReportLoading(false)
        return
      }

      try {
        const { data, error } = await demoDb
          .from('beauty_news_archives')
          .select('id, windows_start, windows_end, report_title, categories, keywords')
          .eq('windows_start', item.windows_start)
          .single()
        if (cancelled) return
        if (error || !data) throw new Error(error?.message || '불러오기 실패')
        setArchiveReport(reportFromRow(data, true))
      } catch (e: unknown) {
        if (!cancelled) {
          setArchiveReport({ ok: false, error: (e as Error).message || '오류' })
        }
      } finally {
        if (!cancelled) setArchiveReportLoading(false)
      }
    }

    void loadDetail()
    return () => { cancelled = true }
  }, [slugDate, archiveItems])

  if (slug && !slugDate) {
    return <Navigate to="/trend/beauty-news-archive" replace />
  }

  function openArchive(windowsStart: string) {
    const item = archiveItems.find(a => a.windows_start === windowsStart)
    if (!item) return
    navigate(archiveDetailPath(item))
  }

  return (
    <BeautyNewsShell tab="archive">
      {isDetail ? (
        <ArchiveDetail
          item={detailItem}
          report={archiveReport}
          loading={archiveReportLoading}
          onBack={() => navigate('/trend/beauty-news-archive')}
        />
      ) : (
        <div className="bn-archive-layout">
          <ArchiveSidebar
            items={archiveItems}
            loading={archiveListLoading}
            selectedKey={selectedKey}
            filterMonth={archiveFilterMonth}
            visibleCount={filteredArchiveItems.length}
            onFilterMonth={setArchiveFilterMonth}
            onSelect={openArchive}
          />
          <div className="bn-archive-main">
            <ArchiveList
              items={filteredArchiveItems}
              allItems={archiveItems}
              loading={archiveListLoading}
              filterMonth={archiveFilterMonth}
              onSelect={openArchive}
            />
          </div>
        </div>
      )}
    </BeautyNewsShell>
  )
}
