import type { NavigateFunction } from 'react-router-dom'
import { archiveSectionPath, archiveBasePath, type ArchiveSection } from './archive-slug'

export async function setGlobalArchivePhase(
  phase: { id: string; name: string },
  section: ArchiveSection,
  switchPhase: (phaseId: string) => Promise<void>,
  navigate: NavigateFunction,
) {
  await switchPhase(phase.id)
  const path = section === 'season'
    ? `${archiveBasePath(phase)}/season-web`
    : archiveSectionPath(phase, section)
  navigate(path)
}
