import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Archive, Newspaper } from 'lucide-react'
import { PageTabs } from '@/components/ui'
import { PageHeroBanner, PageHeroBannerContent } from '@/components/PageHeroBanner'

export default function BeautyNewsShell({
  tab,
  children,
}: {
  tab: 'news' | 'archive'
  children: ReactNode
}) {
  const navigate = useNavigate()

  return (
    <div className="page">
      <PageHeroBanner>
        <PageHeroBannerContent
          title="뷰티 뉴스 브리핑"
          description="최신 뷰티 뉴스를 AI로 요약·분석합니다. 주간 브리핑을 매월 이메일로 자동으로 발송합니다."
        />
      </PageHeroBanner>

      <PageTabs
        tabs={[
          { id: 'news', label: '이번 주 뉴스', icon: <Newspaper size={15} strokeWidth={2.2} /> },
          { id: 'archive', label: '아카이브', icon: <Archive size={15} strokeWidth={2.2} /> },
        ]}
        active={tab}
        onChange={id => {
          navigate(id === 'archive' ? '/trend/beauty-news-archive' : '/trend/beauty-news')
        }}
      />

      {children}
    </div>
  )
}
