export interface OverviewField {
  label: string
  value: string
  sub?: string
}

export interface OverviewTimelineStep {
  period: string
  items: string[]
}

export interface SeasonCollectionOverviewData {
  heading: string
  fields: OverviewField[]
  timeline: OverviewTimelineStep[]
}

const TIMELINE_1차: OverviewTimelineStep[] = [
  {
    period: '26 Jan',
    items: [
      '키트 참여 브랜드 모집',
      '인플루언서 섭외 (총 3회 사전 컨택 진행)',
    ],
  },
  {
    period: '26 Feb',
    items: [
      '인플루언서 대상 콘텐츠 제작 가이드라인 전달',
      '키트 제작 및 발송',
    ],
  },
  {
    period: '26 Mar',
    items: [
      '업로드 콘텐츠 모니터링',
      '미업로드 인플루언서 대상 업로드 안내 2회',
    ],
  },
  {
    period: '26 Apr',
    items: [
      '최종 업로드 콘텐츠 확인',
      '결과 리포트 발송',
    ],
  },
]

const BASE_BY_PHASE: Record<string, { heading: string; fields: Omit<OverviewField, 'label'>[]; timeline: OverviewTimelineStep[] }> = {
  '1차': {
    heading: 'Mi Muse 시딩 프로젝트 개요',
    fields: [
      {
        value: 'Mi Muse 시딩 프로젝트',
        sub: '— 미국 뷰티 인플루언서 대상 K-뷰티 브랜드 시딩 캠페인',
      },
      {
        value: '복수의 K-뷰티 브랜드 제품을 하나의 시딩 키트로 구성하여 미국 현지 뷰티 인플루언서 및 매거진에 발송, 자연스러운 제품 노출 및 유기적 리뷰 콘텐츠 생성을 목표로 진행',
      },
      {
        value: '총 50건 발송',
        sub: '(인플루언서 44인 / 매거진 6개)',
      },
      {
        value: '오배송 6건 재발송 분량 포함 총 56건 발송',
        sub: '(26.03.14 전체 수령 완료)',
      },
    ],
    timeline: TIMELINE_1차,
  },
}

const FIELD_LABELS = [
  '프로젝트 명',
  '프로젝트 목적',
  '키트 발송 대상',
  '총 배송 수량',
  '참여 브랜드',
] as const

export function getSeasonCollectionOverview(
  phaseName: string,
  brandNames: string[],
): SeasonCollectionOverviewData {
  const base = BASE_BY_PHASE[phaseName]
  const brandLine = brandNames.length
    ? `${brandNames.length}개 브랜드 (${brandNames.join(', ')})`
    : '등록된 브랜드 없음'

  if (!base) {
    return {
      heading: `Mi Muse ${phaseName} 시딩 프로젝트 개요`,
      fields: [
        { label: '프로젝트 명', value: `Mi Muse ${phaseName} 시딩 프로젝트` },
        { label: '참여 브랜드', value: brandLine },
      ],
      timeline: [],
    }
  }

  const fields: OverviewField[] = base.fields.map((field, index) => ({
    label: FIELD_LABELS[index],
    ...field,
  }))

  fields.push({
    label: '참여 브랜드',
    value: brandLine,
  })

  return {
    heading: base.heading,
    fields,
    timeline: base.timeline,
  }
}

export function getSeasonCollectionOverviewLine(phaseName: string, brandNames: string[]): string {
  const brandList = brandNames.length ? brandNames.join(', ') : '—'
  const base = BASE_BY_PHASE[phaseName]

  if (phaseName === '1차') {
    return `미국 뷰티 인플루언서·매거진 대상 K-뷰티 시딩 캠페인 — 총 56건 발송 완료 (26.03.14) · ${brandNames.length}개 브랜드 (${brandList})`
  }

  if (base) {
    return `Mi Muse ${phaseName} 시딩 프로젝트 — ${brandNames.length}개 브랜드 (${brandList})`
  }

  return `Mi Muse ${phaseName} 시딩 프로젝트 — ${brandNames.length}개 브랜드 (${brandList})`
}
