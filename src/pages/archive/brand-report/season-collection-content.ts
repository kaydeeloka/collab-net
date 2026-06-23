export interface SeasonCollectionCopy {
  volume: string
  title: string
  intro: string[]
  kitHeading: string
}

export const SEASON_COLLECTION_COPY: Record<string, SeasonCollectionCopy> = {
  '1차': {
    volume: '2026 VOL.1',
    title: 'A Seollal collection',
    intro: [
      'The Mi Muse for this season is a curated collection inspired by Korea\'s traditional New Year, Seollal.',
      'Seollal marks the beginning of a new year and is a time to share warm sentiments and exchange greetings with loved ones. Starting from this cultural context, Mi Muse has designed this collection to give creators the feeling of receiving a Seollal gift the moment they open the kit.',
    ],
    kitHeading: 'What Was Inside the Kit',
  },
}

export function conceptTitleFromProjectConcept(projectConcept?: string | null) {
  const paragraphs = splitArchiveParagraphs(projectConcept)
  return paragraphs[0] ?? ''
}

export function splitArchiveParagraphs(text: string | null | undefined): string[] {
  const trimmed = text?.trim()
  if (!trimmed) return []
  return trimmed.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
}

export function getSeasonCollectionCopy(
  phaseName: string,
  brandCount: number,
  projectConcept?: string | null,
  archiveDesc?: string | null,
): SeasonCollectionCopy {
  const base = SEASON_COLLECTION_COPY[phaseName] ?? {
    volume: phaseName === '2차' ? '2026 VOL.2' : `2026 ${phaseName}`,
    title: `Mi Muse ${phaseName} Collection`,
    intro: [
      `The Mi Muse ${phaseName} season brings together curated indie K-Beauty partners for creators.`,
      'Each brand was selected to deliver a thoughtful kit experience — from product storytelling to everyday rituals creators can share with their audience.',
    ],
    kitHeading: 'What Was Inside the Kit',
  }

  let copy = base

  const concept = projectConcept?.trim()
  if (concept) {
    const paragraphs = splitArchiveParagraphs(concept)
    if (paragraphs.length === 1) {
      copy = { ...copy, title: paragraphs[0] }
    } else if (paragraphs.length > 1) {
      copy = { ...copy, title: paragraphs[0], intro: paragraphs.slice(1) }
    }
  }

  const introParagraphs = splitArchiveParagraphs(archiveDesc)
  if (introParagraphs.length) {
    copy = { ...copy, intro: introParagraphs }
  }

  return copy
}
