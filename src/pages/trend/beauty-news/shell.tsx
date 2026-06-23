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
          title="트렌드 분석"
          description="뷰티 뉴스 AI 분석 및 틱톡 트렌드 리포트를 확인하세요."
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
