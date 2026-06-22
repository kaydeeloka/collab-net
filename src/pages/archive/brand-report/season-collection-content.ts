export interface SeasonCollectionCopy {
  volume: string
  title: string
  intro: string[]
  kitHeading: string
  kitIntro: (brandCount: number) => string
}

const DEFAULT_KIT_INTRO = (n: number) =>
  `This Mi Muse collection brings together ${n} indie K-Beauty brand${n === 1 ? '' : 's'}, each chosen to carry the warmth of a seasonal gift into daily life.`

export const SEASON_COLLECTION_COPY: Record<string, SeasonCollectionCopy> = {
  '1차': {
    volume: '2026 VOL.1',
    title: 'A Seollal collection',
    intro: [
      'The Mi Muse for this season is a curated collection inspired by Korea\'s traditional New Year, Seollal.',
      'Seollal marks the beginning of a new year and is a time to share warm sentiments and exchange greetings with loved ones. Starting from this cultural context, Mi Muse has designed this collection to give creators the feeling of receiving a Seollal gift the moment they open the kit.',
    ],
    kitHeading: 'What Was Inside the Kit',
    kitIntro: n =>
      n === 4
        ? 'The first Mi Muse collection brought together 4 indie K-Beauty brands, each chosen to carry the warmth of a Seollal gift into daily life.'
        : DEFAULT_KIT_INTRO(n),
  },
}

export function getSeasonCollectionCopy(phaseName: string, brandCount: number): SeasonCollectionCopy {
  const copy = SEASON_COLLECTION_COPY[phaseName]
  if (copy) return copy

  const vol = phaseName === '2차' ? '2026 VOL.2' : `2026 ${phaseName}`
  return {
    volume: vol,
    title: `Mi Muse ${phaseName} Collection`,
    intro: [
      `The Mi Muse ${phaseName} season brings together curated indie K-Beauty partners for creators.`,
      'Each brand was selected to deliver a thoughtful kit experience — from product storytelling to everyday rituals creators can share with their audience.',
    ],
    kitHeading: 'What Was Inside the Kit',
    kitIntro: DEFAULT_KIT_INTRO,
  }
}
