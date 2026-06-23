import type { NavigateFunction } from 'react-router-dom'
import { archiveSectionPath, type ArchiveSection } from './archive-slug'

export async function setGlobalArchivePhase(
  phase: { id: string; name: string },
  section: ArchiveSection,
  switchPhase: (phaseId: string) => Promise<void>,
  navigate: NavigateFunction,
) {
  await switchPhase(phase.id)
  navigate(archiveSectionPath(phase, section))
}
