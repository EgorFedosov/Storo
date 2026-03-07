import { PagePrototype } from '../../../shared/ui/PagePrototype.tsx'

const checklist = [
  'Connect GET /api/v1/home and render latest/popular tables.',
  'Click tag -> navigate to search inventories by tag.',
  'Show guest-safe read-only view.',
] as const

export function HomePage() {
  return (
    <PagePrototype
      title="Home"
      description="Public entry point with latest inventories, top popular inventories and tag cloud."
      checklist={checklist}
    />
  )
}
