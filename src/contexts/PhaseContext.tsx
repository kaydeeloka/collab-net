import { createContext, useContext, useState } from 'react'
interface Phase {
  id: string
  name: string
  is_active: boolean
  started_at: string | null
  ended_at: string | null
  kit_send_date: string | null
  google_sheets_url: string | null
  project_concept: string | null
  collection_img: string | null
  archive_desc: string | null
  design_theme_img: string | null
  design_kit_box_img: string | null
  design_collection_card_img: string | null
  design_brochure_img: string | null
  design_archive_desc: string | null
}

interface PhaseContextValue {
  selectedPhaseId: string | null  // persisted viewing choice (app_config)
  viewPhaseId:     string | null  // phase used for data queries
  activePhaseId:   string | null  // date-based: today is between started_at and ended_at
  phases: Phase[]
  loading: boolean
  switchPhase: (phaseId: string) => Promise<void>
  refreshPhases: () => Promise<Phase[]>
}

const PhaseContext = createContext<PhaseContextValue>({
  selectedPhaseId: null,
  viewPhaseId:     null,
  activePhaseId:   null,
  phases: [],
  loading: true,
  switchPhase: async () => {},
  refreshPhases: async () => [],
})

export function PhaseProvider({ children }: { children: React.ReactNode }) {
  const demoPhase: Phase = {
    id: 'demo-dashboard',
    name: 'Demo · Dashboard',
    is_active: true,
    started_at: '2026-11-01',
    ended_at: '2026-12-31',
    kit_send_date: '2026-11-20',
    google_sheets_url: null,
    project_concept: 'Demo data for the Collab-Net dashboard',
    collection_img: null,
    archive_desc: null,
    design_theme_img: null,
    design_kit_box_img: null,
    design_collection_card_img: null,
    design_brochure_img: null,
    design_archive_desc: null,
  }
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(demoPhase.id)
  const [viewPhaseId, setViewPhaseId] = useState<string | null>(demoPhase.id)
  const [phases] = useState<Phase[]>([demoPhase])
  const loading = false
  const activePhaseId = demoPhase.id

  async function switchPhase(phaseId: string) {
    setSelectedPhaseId(phaseId)
    setViewPhaseId(phaseId)
  }

  async function refreshPhases() {
    return phases
  }

  return (
    <PhaseContext.Provider value={{ selectedPhaseId, viewPhaseId, activePhaseId, phases, loading, switchPhase, refreshPhases }}>
      {children}
    </PhaseContext.Provider>
  )
}

export function usePhase() {
  return useContext(PhaseContext)
}
