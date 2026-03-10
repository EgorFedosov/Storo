import type { InventoryCustomFieldType } from './inventoryEditorTypes.ts'

export type InventoryItemsTableColumnKind = 'fixed' | 'custom'
export type InventoryItemsTableSortDirection = 'asc' | 'desc'
export type InventoryItemsTableSortField = 'customId' | 'createdAt' | 'updatedAt' | `field:${string}`
export type InventoryItemsTableCellValue = string | number | boolean | null

export type InventoryItemsTableColumn = {
  key: string
  title: string
  kind: InventoryItemsTableColumnKind
  fieldId: string | null
  fieldType: InventoryCustomFieldType | null
}

export type InventoryItemsTableRowLike = {
  count: number
  likedByCurrentUser: boolean
}

export type InventoryItemsTableRow = {
  itemId: string
  version: number
  cells: Record<string, InventoryItemsTableCellValue>
  like: InventoryItemsTableRowLike
}

export type InventoryItemsTablePage = {
  inventoryId: string
  version: number
  columns: ReadonlyArray<InventoryItemsTableColumn>
  rows: ReadonlyArray<InventoryItemsTableRow>
  page: number
  pageSize: number
  totalCount: number
}
