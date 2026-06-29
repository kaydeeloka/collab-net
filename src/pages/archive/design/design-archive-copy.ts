import { splitArchiveParagraphs } from '../season/season-collection-content'

export const DESIGN_ARCHIVE_DEFAULT_DESCRIPTION = [
  '시즌 키트 박스·컬렉션 카드·브로슈어 등 디자인 산출물을 업로드하고 폴더별로 아카이브합니다.',
]

export function getDesignArchiveHeroDescription(designArchiveDesc?: string | null): string {
  const paragraphs = splitArchiveParagraphs(designArchiveDesc)
  if (paragraphs.length) return paragraphs.join(' ')
  return DESIGN_ARCHIVE_DEFAULT_DESCRIPTION.join(' ')
}
