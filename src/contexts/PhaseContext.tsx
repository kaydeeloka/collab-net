import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Phase {
  id: string
  name: string
  is_active: boolean
  started_at: string | null
  ended_at: string | null
  kit_send_date: string | null
  google_sheets_url: string | null
}

interface PhaseContextValue {
  selectedPhaseId: string | null  // user's current viewing choice
  activePhaseId:   string | null  // date-based: today is between started_at and ended_at
  phases: Phase[]
  loading: boolean
  switchPhase: (phaseId: string) => Promise<void>
}

const PhaseContext = createContext<PhaseContextValue>({
  selectedPhaseId: null,
  activePhaseId:   null,
  phases: [],
  loading: true,
  switchPhase: async () => {},
})

export function PhaseProvider({ children }: { children: React.ReactNode }) {
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null)
  const [phases,          setPhases]          = useState<Phase[]>([])
  const [loading,         setLoading]         = useState(true)

  useEffect(() => {
    ;(async () => {
      const [{ data: cfg }, { data: phaseList }] = await Promise.all([
        supabase.from('app_config').select('value').eq('key', 'active_phase_id').single(),
        supabase.from('phases').select('*').order('started_at', { ascending: true }),
      ])

      if (cfg?.value) setSelectedPhaseId(cfg.value as string)
      if (phaseList)  setPhases(phaseList as Phase[])
      setLoading(false)
    })()
  }, [])

  // Compute date-based active phase
  const today = new Date().toISOString().split('T')[0]
  const activePhaseId = phases.find(p => {
    if (!p.started_at || !p.ended_at) return false
    const start = p.started_at.split('T')[0]
    const end   = p.ended_at.split('T')[0]
    return today >= start && today <= end
  })?.id ?? null

  async function switchPhase(phaseId: string) {
    await supabase.from('app_config').upsert({ key: 'active_phase_id', value: phaseId, updated_at: new Date().toISOString() })
    setSelectedPhaseId(phaseId)
  }

  return (
    <PhaseContext.Provider value={{ selectedPhaseId, activePhaseId, phases, loading, switchPhase }}>
      {children}
    </PhaseContext.Provider>
  )
}

export function usePhase() {
  return useContext(PhaseContext)
}
