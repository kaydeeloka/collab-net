import type { SeasonNextStepData } from './season-collection-next-step'
import SeasonReportSlide from './SeasonReportSlide'

interface Props {
  data: SeasonNextStepData
}

export default function SeasonNextStep({ data }: Props) {
  return (
    <SeasonReportSlide eyebrow="Next Step" title={data.title}>
      <section className="season-next-step">
        <dl className="season-next-step__fields">
          {data.fields.map(field => (
            <div key={field.label} className="season-next-step__field">
              <dt className="season-next-step__field-label">{field.label}</dt>
              <dd className="season-next-step__field-value">
                <span>{field.value}</span>
                {field.sub && <span className="season-next-step__field-sub">{field.sub}</span>}
              </dd>
            </div>
          ))}
        </dl>

        <div className="season-next-step__strategies">
          {data.strategies.map(block => (
            <div key={block.heading} className="season-next-step__block">
              <h3 className="season-next-step__block-heading">{block.heading}</h3>
              <ul className="season-next-step__list">
                {block.items.map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {data.closing && <p className="season-next-step__closing">{data.closing}</p>}
      </section>
    </SeasonReportSlide>
  )
}
