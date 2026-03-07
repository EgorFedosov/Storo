import { PagePrototype } from '../../../shared/ui/PagePrototype.tsx'

const checklist = [
  'Load details + editor model via /api/v1/inventories/{id} and /edit.',
  'Tabs: items, discussion, settings, custom id, access, custom fields, statistics.',
  'Mutations must send If-Match and update local ETag.',
] as const

export function InventoryPage() {
  return (
    <PagePrototype
      title="Inventory"
      description="Main workspace with tab-based editor and autosave for owner/admin flows."
      checklist={checklist}
    />
  )
}
