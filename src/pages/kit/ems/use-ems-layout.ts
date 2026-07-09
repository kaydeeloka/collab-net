import { useOutletContext } from 'react-router-dom'

export interface EmsLayoutContext {
  refreshStats:       () => Promise<void>
  notifyReshipChange: () => void
  reshipVersion:      number
  trackingVersion:    number
}

export function useEmsLayout() {
  return useOutletContext<EmsLayoutContext>()
}
