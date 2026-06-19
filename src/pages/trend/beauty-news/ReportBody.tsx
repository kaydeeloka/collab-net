import { Newspaper, Sparkles } from 'lucide-react'
import type { ReportData } from './archive-shared'

export default function ReportBody({ data }: { data: ReportData }) {
  const keywords = data.keywords || []

  return (
    <div>
      {(data.categories || []).map((cat, ci) => {
        const items = cat.items ?? []
        const count = cat.count != null ? cat.count : items.length
        return (
          <div key={ci} className="bn-cat">
            <div className="bn-cat-title">
              <span className="bn-cat-title-icon"><Newspaper size={15} strokeWidth={2.2} /></span>
              {cat.name}
            </div>
            <div className="bn-cat-count">
              이번 주 트렌드 시그널이 감지된 뉴스는 총 <span className="bn-cat-count-num">{count}</span>건입니다.
            </div>
            {items.map((item, ii) => (
              <div key={ii} className="bn-article">
                <div className="bn-article-header">
                  {item.link
                    ? <a className="bn-article-link" href={item.link} target="_blank" rel="noopener">{item.title}</a>
                    : <span className="bn-article-link">{item.title}</span>
                  }
                </div>
                {(item.source || item.pubDate) && (
                  <div className="bn-source">
                    {[item.source, item.pubDate].filter(Boolean).join(' · ')}
                  </div>
                )}
                <div className="bn-article-summary">{item.summary}</div>
              </div>
            ))}
          </div>
        )
      })}
      {keywords.length > 0 && (
        <div className="bn-keywords-section">
          <div className="bn-keywords-title">
            <Sparkles size={15} strokeWidth={2.2} className="bn-keywords-title-icon" />
            트렌드 키워드
          </div>
          {keywords.map((kw, i) => (
            <div key={i} className="bn-keyword-item">
              <div className="bn-keyword-tag">{kw.tag}</div>
              <div className="bn-keywords-body">{kw.explanation}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
