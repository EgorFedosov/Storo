import { PagePrototype } from '../../../shared/ui/PagePrototype.tsx'

const checklist = [
  'Use /api/v1/admin/users with filters, paging and sorting.',
  'Moderation actions: block/unblock, grant/revoke admin, delete.',
  'Access should be protected by current-user permissions.',
] as const

export function AdminUsersPage() {
  return (
    <PagePrototype
      title="Admin Users"
      description="Admin panel for user moderation and role management."
      checklist={checklist}
    />
  )
}
