import { PagePrototype } from '../../../shared/ui/PagePrototype.tsx'

const checklist = [
  'Render item fixed fields + dynamic custom fields.',
  'Support edit/delete with optimistic locking (If-Match).',
  'Like/unlike actions should update counters optimistically.',
] as const

export function ItemPage() {
  return (
    <PagePrototype
      title="Item"
      description="Item details/edit page built from inventory-driven dynamic schema."
      checklist={checklist}
    />
  )
}
