import { PagePrototype } from '../../../shared/ui/PagePrototype.tsx'

const checklist = [
  'Header search should trigger /api/v1/search/inventories or /api/v1/search/items.',
  'Keep table-first results with pagination and sort.',
  'Preserve query params in URL for shareable filters.',
] as const

export function SearchPage() {
  return (
    <PagePrototype
      title="Search"
      description="Shared search page layout for inventories and items."
      checklist={checklist}
    />
  )
}
