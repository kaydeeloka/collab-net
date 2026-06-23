import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getDateActivePhaseId, normalizePhaseId } from '@/lib/phase'
import { supabaseNow } from '@/lib/kst-time'

interface Phase {
  id: string
  name: string
  is_active: boolean
  started_at: string | null
  ended_at: string | null
  kit_send_date: string | null
  google_sheets_url: string | null
  project_concept: string | null
}

interface PhaseContextValue {
  selectedPhaseId: string | null  // persisted viewing choice (app_config)
  viewPhaseId:     string | null  // phase used for data queries
  activePhaseId:   string | null  // date-based: today is between started_at and ended_at
  phases: Phase[]
  loading: boolean
  switchPhase: (phaseId: string) => Promise<void>
}

const PhaseContext = createContext<PhaseContextValue>({
  selectedPhaseId: null,
  viewPhaseId:     null,
  activePhaseId:   null,
  phases: [],
  loading: true,
  switchPhase: async () => {},
})

export function PhaseProvider({ children }: { children: React.ReactNode }) {
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null)
  const [viewPhaseId,     setViewPhaseId]     = useState<string | null>(null)
  const [phases,          setPhases]          = useState<Phase[]>([])
  const [loading,         setLoading]         = useState(true)

  useEffect(() => {
    ;(async () => {
      const [{ data: cfg }, { data: phaseList }] = await Promise.all([
        supabase.from('app_config').select('value').eq('key', 'active_phase_id').maybeSingle(),
        supabase.from('phases').select('*').order('started_at', { ascending: true }),
      ])

      const list = (phaseList || []) as Phase[]
      setPhases(list)

      const savedId    = normalizePhaseId(cfg?.value)
      const dateActive = getDateActivePhaseId(list)
      // Prefer date-active phase (e.g. 2차) over stale saved config (e.g. 1차)
      const initialId  = dateActive ?? savedId ?? null

      setSelectedPhaseId(initialId)
      setViewPhaseId(initialId)

      if (dateActive && dateActive !== savedId) {
        await supabase.from('app_config').upsert({
          key: 'active_phase_id',
          value: dateActive,
          updated_at: supabaseNow(),
        })
      }

      setLoading(false)
    })()
  }, [])

  const activePhaseId = getDateActivePhaseId(phases)

  async function switchPhase(phaseId: string) {
    await supabase.from('app_config').upsert({
      key: 'active_phase_id',
      value: phaseId,
      updated_at: supabaseNow(),
    })
    setSelectedPhaseId(phaseId)
    setViewPhaseId(phaseId)
  }

  return (
    <PhaseContext.Provider value={{ selectedPhaseId, viewPhaseId, activePhaseId, phases, loading, switchPhase }}>
      {children}
    </PhaseContext.Provider>
  )
}

export function usePhase() {
  return useContext(PhaseContext)
}
