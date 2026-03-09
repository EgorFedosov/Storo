export type AdminUsersBlockedFilter = 'all' | 'true' | 'false'
export type AdminUsersRoleFilter = 'all' | 'admin' | 'user'
export type AdminUsersSortField = 'updatedAt' | 'createdAt' | 'userName' | 'email'
export type AdminUsersSortDirection = 'asc' | 'desc'
export type AdminModerationStatus = 'blocked' | 'unblocked' | 'admin_granted' | 'admin_revoked'
export type AdminModerationAction = 'block' | 'unblock' | 'grant_admin' | 'revoke_admin' | 'delete'

export type AdminUsersQueryState = Readonly<{
  blocked: AdminUsersBlockedFilter
  role: AdminUsersRoleFilter
  query: string | null
  page: number
  pageSize: number
  sortField: AdminUsersSortField
  sortDirection: AdminUsersSortDirection
}>

export type AdminUsersSortState = Readonly<{
  field: AdminUsersSortField
  direction: AdminUsersSortDirection
}>

export type AdminUserListItem = Readonly<{
  id: string
  email: string
  userName: string
  displayName: string
  isBlocked: boolean
  roles: readonly string[]
  createdAt: string
  updatedAt: string
}>

export type AdminUsersPage = Readonly<{
  items: readonly AdminUserListItem[]
  page: number
  pageSize: number
  totalCount: number
  sort: AdminUsersSortState
}>

export type AdminModerationResult = Readonly<{
  userId: string
  status: AdminModerationStatus
  changed: boolean
}>

export type AdminModerationMutationResult = Readonly<{
  userId: string
  action: AdminModerationAction
  status: AdminModerationStatus | null
  changed: boolean
}>

export const adminUsersContract = {
  defaultPage: 1,
  defaultPageSize: 20,
  maxPageSize: 100,
  maxQueryLength: 200,
  defaultBlockedFilter: 'all',
  defaultRoleFilter: 'all',
  defaultSortField: 'updatedAt',
  defaultSortDirection: 'desc',
} as const

export const adminUsersBlockedFilterValues: readonly AdminUsersBlockedFilter[] = ['all', 'true', 'false']
export const adminUsersRoleFilterValues: readonly AdminUsersRoleFilter[] = ['all', 'admin', 'user']
export const adminUsersSortFieldValues: readonly AdminUsersSortField[] = ['updatedAt', 'createdAt', 'userName', 'email']
export const adminUsersSortDirectionValues: readonly AdminUsersSortDirection[] = ['asc', 'desc']
