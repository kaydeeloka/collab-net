import type { SeasonCollectionOverviewData } from './season-collection-overview'

interface Props {
  overview: SeasonCollectionOverviewData
  kitImageUrl: string | null
}

export default function SeasonCollectionOverview({ overview, kitImageUrl }: Props) {
  return (
    <section className="season-overview">
      <div className="season-overview__head">
        <h2 className="season-overview__title">{overview.heading}</h2>
      </div>

      <div className="season-overview__body">
        <div className="season-overview__visual">
          {kitImageUrl ? (
            <img src={kitImageUrl} alt="Mi Muse kit" className="season-overview__kit-img" />
          ) : (
            <div className="season-overview__kit-placeholder">키트 이미지 없음</div>
          )}
        </div>

        <dl className="season-overview__fields">
          {overview.fields.map(field => (
            <div key={field.label} className="season-overview__field">
              <dt className="season-overview__field-label">{field.label}</dt>
              <dd className="season-overview__field-value">
                <span>{field.value}</span>
                {field.sub && <span className="season-overview__field-sub">{field.sub}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {overview.timeline.length > 0 && (
        <div className="season-overview__timeline">
          <h3 className="season-overview__timeline-heading">진행 프로세스</h3>
          <div className="season-overview__timeline-track">
            {overview.timeline.map(step => (
              <div key={step.period} className="season-overview__timeline-step">
                <div className="season-overview__timeline-period">{step.period}</div>
                <ul className="season-overview__timeline-list">
                  {step.items.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
