import { Shell } from './components/Shell'
import { GateOpenCelebration } from './components/GateOpenCelebration'
import { useFm } from './state/store'
import type { Persona } from './model/types'
import { ProductManagerView } from './views/ProductManagerView'
import { ProjectManagerView } from './views/ProjectManagerView'
import { EngineeringManagerView } from './views/EngineeringManagerView'
import { DeveloperView } from './views/DeveloperView'
import { DesignerView } from './views/DesignerView'
import { PrdDraftScreen } from './views/PrdDraftScreen'
import { ReviewScreen } from './views/ReviewScreen'

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
  const RoleView = VIEWS[persona]
  // key the fade on whatever is actually on the surface
  const surfaceKey = activeStage === 'gap-analysis' ? persona : activeStage

  const surface =
    activeStage === 'prd-draft' ? (
      <PrdDraftScreen />
    ) : activeStage === 'review' ? (
      <ReviewScreen />
    ) : (
      <RoleView />
    )

  return (
    <>
      <Shell>
        <div key={surfaceKey} className="fm-fadein" style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          {surface}
        </div>
      </Shell>
      <GateOpenCelebration />
    </>
  )
}
