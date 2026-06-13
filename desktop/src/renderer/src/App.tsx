import { useEffect } from 'react'
import { Shell } from './components/Shell'
import { GateOpenCelebration } from './components/GateOpenCelebration'
import { WaiverModal } from './components/WaiverModal'
import { AgentRunBar } from './components/AgentRunBar'
import { useFm } from './state/store'
import { transport } from './transport'
import type { Persona } from './model/types'
import { ProductManagerView } from './views/ProductManagerView'
import { ProjectManagerView } from './views/ProjectManagerView'
import { EngineeringManagerView } from './views/EngineeringManagerView'
import { DeveloperView } from './views/DeveloperView'
import { DesignerView } from './views/DesignerView'
import { IntakeScreen } from './views/IntakeScreen'
import { PrdDraftScreen } from './views/PrdDraftScreen'
import { ReviewScreen } from './views/ReviewScreen'
import { HandoffScreen } from './views/HandoffScreen'

const VIEWS: Record<Persona, () => JSX.Element> = {
  pm: ProductManagerView,
  pgm: ProjectManagerView,
  em: EngineeringManagerView,
  dev: DeveloperView,
  design: DesignerView
}

export function App(): JSX.Element {
  const persona = useFm((s) => s.persona)
  const activeStage = useFm((s) => s.activeStage)
  const loadEngagement = useFm((s) => s.loadEngagement)
  const hydrate = useFm((s) => s.hydrate)
  const RoleView = VIEWS[persona]

  // Load the real engagement on mount; subscribe to any host-pushed refreshes.
  useEffect(() => {
    void loadEngagement()
    return transport.onSnapshot(hydrate)
  }, [loadEngagement, hydrate])
  // key the fade on whatever is actually on the surface
  const surfaceKey = activeStage === 'gap-analysis' ? persona : activeStage

  const surface =
    activeStage === 'intake' ? (
      <IntakeScreen />
    ) : activeStage === 'prd-draft' ? (
      <PrdDraftScreen />
    ) : activeStage === 'review' ? (
      <ReviewScreen />
    ) : activeStage === 'handoff' ? (
      <HandoffScreen />
    ) : (
      <RoleView />
    )

  return (
    <>
      <Shell>
        <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <AgentRunBar />
          <div key={surfaceKey} className="fm-fadein" style={{ flex: 1, minHeight: 0, display: 'flex' }}>
            {surface}
          </div>
        </div>
      </Shell>
      <WaiverModal />
      <GateOpenCelebration />
    </>
  )
}
