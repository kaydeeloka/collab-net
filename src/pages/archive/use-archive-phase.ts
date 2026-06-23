import { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePhase } from '@/contexts/PhaseContext'
import { phaseFromArchiveSlug } from './archive-slug'

export function useArchivePhase() {
  const { phaseName } = useParams<{ phaseName: string }>()
  const navigate = useNavigate()
  const { phases, loading: phasesLoading, switchPhase, viewPhaseId } = usePhase()

  const phase = useMemo(
    () => phaseFromArchiveSlug(phases, phaseName),
    [phases, phaseName],
  )

  useEffect(() => {
    if (phase && phase.id !== viewPhaseId) {
      void switchPhase(phase.id)
    }
  }, [phase, viewPhaseId, switchPhase])

  useEffect(() => {
    if (!phasesLoading && phaseName && !phase) {
      navigate('/archive', { replace: true })
    }
  }, [phasesLoading, phase, phaseName, navigate])

  return { phase, phasesLoading }
}
