export const myInventoriesContract = {
  defaultPage: 1,
  defaultPageSize: 20,
  maxPageSize: 100,
  maxQueryLength: 200,
  defaultSortField: 'updatedAt',
  defaultSortDirection: 'desc',
} as const

export const inventoryRelations = ['owned', 'writable'] as const

export type InventoryRelation = (typeof inventoryRelations)[number]

export type UserInventoriesSortField =
  | 'updatedAt'
  | 'createdAt'
  | 'title'
  | 'itemsCount'

export type UserInventoriesSortDirection = 'asc' | 'desc'

export type UserInventoriesSortState = {
  field: UserInventoriesSortField
  direction: UserInventoriesSortDirection
}

export type UserInventoryRow = {
  id: string
  title: string
  category: {
    id: number
    name: string
  }
  owner: {
    id: string
    userName: string
    displayName: string
  }
  isPublic: boolean
  itemsCount: number
  createdAt: string
  updatedAt: string
}

export type UserInventoriesPageData = {
  relation: InventoryRelation
  items: ReadonlyArray<UserInventoryRow>
  page: number
  pageSize: number
  totalCount: number
  sort: UserInventoriesSortState
}

export type UserInventoriesQueryState = {
  query: string
  page: number
  pageSize: number
  sortField: UserInventoriesSortField
  sortDirection: UserInventoriesSortDirection
}

export function createDefaultUserInventoriesQueryState(): UserInventoriesQueryState {
  return {
    query: '',
    page: myInventoriesContract.defaultPage,
    pageSize: myInventoriesContract.defaultPageSize,
    sortField: myInventoriesContract.defaultSortField,
    sortDirection: myInventoriesContract.defaultSortDirection,
  }
}
