export interface NextStepField {
  label: string
  value: string
  sub?: string
}

export interface NextStepBlock {
  heading: string
  items: string[]
}

export interface SeasonNextStepData {
  title: string
  period: string
  fields: NextStepField[]
  strategies: NextStepBlock[]
  closing?: string
}

const NEXT_STEP_BY_PHASE: Record<string, SeasonNextStepData> = {
  '1차': {
    title: '2026 Q2 시딩 프로젝트',
    period: '7월 - 10월',
    fields: [
      { label: '프로젝트 기간', value: '7월 - 10월' },
      { label: '키트 발송 규모', value: '총 50건 발송', sub: '인플루언서 50명' },
      { label: '참여 브랜드', value: '4개 브랜드', sub: '협의 예정' },
    ],
    strategies: [
      {
        heading: '인플루언서 운영 강화',
        items: [
          '인플루언서 50명 규모 확보, 매거진 채널 운영 협의',
          '콘텐츠 업로드 이력 및 성과 데이터를 기반으로 운영 강화',
          '가이드라인 해시태그를 통해 인플루언서 콘텐츠를 추적 가능하도록 관리',
        ],
      },
      {
        heading: '콘텐츠 다양성 확보',
        items: [
          '인플루언서 자율성을 보장하되 일정 수준의 가이드라인 유지',
          '개별 제품에 대한 리뷰 필수 항목 안내 및 UGC 확보 유도',
        ],
      },
      {
        heading: '브랜드 노출 강화',
        items: [
          '팔로워 대비 조회수가 높은 인플루언서 우선 섭외',
          '미국 내 K-뷰티 관심 채널 노출 확대',
        ],
      },
    ],
    closing: 'Recharge — 지친 일상에서 잠시 벗어나 0%를 100%로 회복할 수 있도록, 따뜻한 마음으로 준비한 시즌 키트',
  },
}

export function getSeasonNextStep(phaseName: string): SeasonNextStepData {
  const base = NEXT_STEP_BY_PHASE[phaseName]
  if (base) return base

  return {
    title: '다음 시즌 시딩 프로젝트',
    period: '미정',
    fields: [
      { label: '프로젝트 기간', value: '협의 예정' },
      { label: '키트 발송 규모', value: '협의 예정' },
      { label: '참여 브랜드', value: '협의 예정' },
    ],
    strategies: [
      {
        heading: '운영 방향',
        items: ['이전 시즌 성과 데이터를 기반으로 운영 전략을 수립합니다.'],
      },
    ],
  }
}
