import { PagePrototype } from '../../../shared/ui/PagePrototype.tsx'

const checklist = [
  'Split views by relation: owned and writable.',
  'Use /api/v1/users/me/inventories with sort/page/query.',
  'Actions come from permissions; keep row UI compact.',
] as const

export function MyInventoriesPage() {
  return (
    <PagePrototype
      title="My Inventories"
      description="Personal inventory tables and quick entry points to editor and details screens."
      checklist={checklist}
    />
  )
}
