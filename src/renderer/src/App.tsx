import { Shell } from './components/Shell'
import { useFm } from './state/store'
import type { Persona } from './model/types'
import { ProductManagerView } from './views/ProductManagerView'
import { ProjectManagerView } from './views/ProjectManagerView'
import { EngineeringManagerView } from './views/EngineeringManagerView'
import { DeveloperView } from './views/DeveloperView'
import { DesignerView } from './views/DesignerView'

const VIEWS: Record<Persona, () => JSX.Element> = {
  pm: ProductManagerView,
  pgm: ProjectManagerView,
  em: EngineeringManagerView,
  dev: DeveloperView,
  design: DesignerView
}

export function App(): JSX.Element {
  const persona = useFm((s) => s.persona)
  const View = VIEWS[persona]
  return (
    <Shell>
      <div key={persona} className="fm-fadein" style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <View />
      </div>
    </Shell>
  )
}
