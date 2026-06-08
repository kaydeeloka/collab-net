import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Phase {
  id: string
  name: string
  is_active: boolean
  started_at: string | null
  ended_at: string | null
}

interface PhaseContextValue {
  activePhaseId: string | null
  phases: Phase[]
  loading: boolean
  switchPhase: (phaseId: string) => Promise<void>
}

const PhaseContext = createContext<PhaseContextValue>({
  activePhaseId: null,
  phases: [],
  loading: true,
  switchPhase: async () => {},
})

export function PhaseProvider({ children }: { children: React.ReactNode }) {
  const [activePhaseId, setActivePhaseId] = useState<string | null>(null)
  const [phases, setPhases] = useState<Phase[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const [{ data: cfg }, { data: phaseList }] = await Promise.all([
        supabase.from('app_config').select('value').eq('key', 'active_phase_id').single(),
        supabase.from('phases').select('*').order('started_at', { ascending: true }),
      ])

      if (cfg?.value) setActivePhaseId(cfg.value as string)
      if (phaseList)  setPhases(phaseList as Phase[])
      setLoading(false)
    })()
  }, [])

  async function switchPhase(phaseId: string) {
    await supabase.from('app_config').upsert({ key: 'active_phase_id', value: phaseId, updated_at: new Date().toISOString() })
    setActivePhaseId(phaseId)
  }

  return (
    <PhaseContext.Provider value={{ activePhaseId, phases, loading, switchPhase }}>
      {children}
    </PhaseContext.Provider>
  )
}

export function usePhase() {
  return useContext(PhaseContext)
}
