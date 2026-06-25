import { splitArchiveParagraphs } from '../brand-report/season-collection-content'

export const DESIGN_ARCHIVE_DEFAULT_DESCRIPTION = [
  '시딩 키트 결과 리포트를 작성하고, 브랜드 리포트·디자인 산출물 등 앱 아카이브 페이지에 필요한 데이터를 생성·관리하는 공간입니다.',
  '키트 박스, 컬렉션 카드, 브로슈어 이미지와 폴더별 자료를 업로드해 시즌 아카이브를 완성하세요.',
]

export function getDesignArchiveHeroDescription(designArchiveDesc?: string | null): string {
  const paragraphs = splitArchiveParagraphs(designArchiveDesc)
  if (paragraphs.length) return paragraphs.join(' ')
  return DESIGN_ARCHIVE_DEFAULT_DESCRIPTION.join(' ')
}
