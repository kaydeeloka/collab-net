import type { SeasonCollectionKitCompositionData } from './season-collection-kit-composition'

interface Props {
  composition: SeasonCollectionKitCompositionData
}

export default function SeasonCollectionKitComposition({ composition }: Props) {
  const imageUrl = composition.imageUrl ?? null

  return (
    <section className="season-kit-composition">
      <h2 className="season-kit-composition__title">{composition.title}</h2>

      <div className="season-kit-composition__top">
        <div className="season-kit-composition__visual">
          {imageUrl ? (
            <img src={imageUrl} alt={composition.title} className="season-kit-composition__img" />
          ) : (
            <div className="season-kit-composition__placeholder">키트 구성 이미지 없음</div>
          )}
        </div>

        <div className="season-kit-composition__concept">
          <h3 className="season-kit-composition__concept-heading">{composition.conceptHeading}</h3>
          <div className="season-kit-composition__concept-copy">
            {composition.conceptParagraphs.map(paragraph => (
              <p key={paragraph.slice(0, 24)}>{paragraph}</p>
            ))}
          </div>
        </div>
      </div>

      <div className="season-kit-composition__bottom">
        <div className="season-kit-composition__block">
          <h3 className="season-kit-composition__block-heading">{composition.brandComponents.heading}</h3>
          <ul className="season-kit-composition__list">
            {composition.brandComponents.items.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="season-kit-composition__block">
          <h3 className="season-kit-composition__block-heading">{composition.museComponents.heading}</h3>
          <ul className="season-kit-composition__list">
            {composition.museComponents.items.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
