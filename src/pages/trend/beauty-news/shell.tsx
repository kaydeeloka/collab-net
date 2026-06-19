import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Archive, Newspaper } from 'lucide-react'
import { PageTabs } from '@/components/ui'

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
      <div className="page-banner">
        <span className="page-banner-deco">📊</span>
        <div>
          <div className="page-banner-title">트렌드 분석</div>
          <div className="page-banner-desc">뷰티 뉴스 AI 분석 및 틱톡 트렌드 리포트를 확인하세요.</div>
        </div>
      </div>

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
