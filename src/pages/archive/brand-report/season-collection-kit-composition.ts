export interface KitCompositionBlock {
  heading: string
  items: string[]
}

export interface SeasonCollectionKitCompositionData {
  title: string
  imageUrl?: string | null
  conceptHeading: string
  conceptParagraphs: string[]
  brandComponents: KitCompositionBlock
  museComponents: KitCompositionBlock
}

const KIT_COMPOSITION_BY_PHASE: Record<string, SeasonCollectionKitCompositionData> = {
  '1차': {
    title: 'Mi Muse 시딩 키트 구성',
    imageUrl: '/img/kit.png',
    conceptHeading: '2026 VOL.1 콘셉트',
    conceptParagraphs: [
      '한국의 설날 문화에서 영감을 받은 시즌 큐레이션입니다.',
      '설날은 한 해의 시작을 축하하며 주변 사람들과 마음과 인사를 나누는 시간입니다.',
      '이러한 설날의 분위기에서 출발하여, 키트를 받는 크리에이터가 마치 설날 선물을 받은 듯한 느낌을 받을 수 있도록 컬렉션이 디자인되었습니다.',
    ],
    brandComponents: {
      heading: '브랜드 구성품',
      items: [
        '각 브랜드 소개, 제품 소개, 구매 QR 코드가 포함된 브로슈어',
        '전성분이 기재된 라벨',
      ],
    },
    museComponents: {
      heading: 'Mi Muse 구성품',
      items: [
        '한국 전통 요소가 담긴 외부 패키징',
        'Mi Muse 소개가 담긴 컬렉션 카드',
      ],
    },
  },
}

export function getSeasonCollectionKitComposition(phaseName: string): SeasonCollectionKitCompositionData {
  const base = KIT_COMPOSITION_BY_PHASE[phaseName]
  if (base) return base

  return {
    title: `Mi Muse ${phaseName} 시딩 키트 구성`,
    conceptHeading: `${phaseName} 콘셉트`,
    conceptParagraphs: [
      `${phaseName} 시즌 시딩 키트는 참여 브랜드 제품과 Mi Muse 브랜딩 소재로 구성됩니다.`,
    ],
    brandComponents: {
      heading: '브랜드 구성품',
      items: ['브랜드·제품 소개 브로슈어', '전성분 라벨'],
    },
    museComponents: {
      heading: 'Mi Muse 구성품',
      items: ['시즌 패키징', '컬렉션 카드'],
    },
  }
}
