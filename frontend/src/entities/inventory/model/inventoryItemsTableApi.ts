import { apiRequest } from '../../../shared/api/httpClient.ts'
import type { InventoryCustomFieldType } from './inventoryEditorTypes.ts'
import type {
  InventoryItemsTableCellValue,
  InventoryItemsTableColumn,
  InventoryItemsTablePage,
  InventoryItemsTableRow,
  InventoryItemsTableSortDirection,
  InventoryItemsTableSortField,
} from './inventoryItemsTableTypes.ts'

type InventoryItemsTableFailure = {
  ok: false
  status: number
  message: string
  validationErrors: Record<string, string[]>
}

type InventoryItemsTableSuccess = {
  ok: true
  data: InventoryItemsTablePage
}

export type InventoryItemsTableRequestResult = InventoryItemsTableSuccess | InventoryItemsTableFailure

export type InventoryItemsTableRequest = {
  page: number
  pageSize: number
  sortField: InventoryItemsTableSortField
  sortDirection: InventoryItemsTableSortDirection
}

const validFixedSortFields = new Set<InventoryItemsTableSortField>(['customId', 'createdAt', 'updatedAt'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalizedValue = value.trim()
  return normalizedValue.length > 0 ? normalizedValue : null
}

function normalizePositiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null
}

function normalizeNonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

function normalizeStringId(value: unknown): string | null {
  const normalizedValue = normalizeNonEmptyString(value)
  if (normalizedValue === null || !/^\d+$/.test(normalizedValue)) {
    return null
  }

  return normalizedValue
}

function normalizeSortField(value: unknown): InventoryItemsTableSortField | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalizedValue = value.trim()
  if (validFixedSortFields.has(normalizedValue as InventoryItemsTableSortField)) {
    return normalizedValue as InventoryItemsTableSortField
  }

  return /^field:[1-9]\d*$/.test(normalizedValue) ? normalizedValue as InventoryItemsTableSortField : null
}

function normalizeCellValue(value: unknown): InventoryItemsTableCellValue | null {
  if (value === null) {
    return null
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  return null
}

function normalizeFieldType(value: unknown): InventoryCustomFieldType | null {
  if (
    value === 'single_line'
    || value === 'multi_line'
    || value === 'number'
    || value === 'link'
    || value === 'bool'
  ) {
    return value
  }

  return null
}

function normalizeColumns(payload: unknown): ReadonlyArray<InventoryItemsTableColumn> | null {
  if (!Array.isArray(payload)) {
    return null
  }

  const normalizedColumns: InventoryItemsTableColumn[] = []
  const seenKeys = new Set<string>()

  for (const rawColumn of payload) {
    if (!isRecord(rawColumn)) {
      return null
    }

    const key = normalizeNonEmptyString(rawColumn.key)
    const title = normalizeNonEmptyString(rawColumn.title)
    const kind = rawColumn.kind === 'fixed' || rawColumn.kind === 'custom'
      ? rawColumn.kind
      : null

    if (key === null || title === null || kind === null || seenKeys.has(key)) {
      return null
    }

    seenKeys.add(key)

    if (kind === 'fixed') {
      normalizedColumns.push({
        key,
        title,
        kind,
        fieldId: null,
        fieldType: null,
      })
      continue
    }

    const fieldId = normalizeStringId(rawColumn.fieldId)
    const fieldType = normalizeFieldType(rawColumn.fieldType)
    if (fieldId === null || fieldType === null || key !== `field:${fieldId}`) {
      return null
    }

    normalizedColumns.push({
      key,
      title,
      kind,
      fieldId,
      fieldType,
    })
  }

  return normalizedColumns
}

function normalizeLike(payload: unknown): InventoryItemsTableRow['like'] | null {
  if (!isRecord(payload)) {
    return null
  }

  const count = normalizeNonNegativeInteger(payload.count)
  const likedByCurrentUser = typeof payload.likedByCurrentUser === 'boolean'
    ? payload.likedByCurrentUser
    : null

  if (count === null || likedByCurrentUser === null) {
    return null
  }

  return {
    count,
    likedByCurrentUser,
  }
}

function normalizeCells(
  payload: unknown,
  columns: ReadonlyArray<InventoryItemsTableColumn>,
): Record<string, InventoryItemsTableCellValue> | null {
  if (!isRecord(payload)) {
    return null
  }

  const normalizedCells: Record<string, InventoryItemsTableCellValue> = {}

  for (const column of columns) {
    const rawValue = payload[column.key]
    if (rawValue === undefined) {
      return null
    }

    const normalizedValue = normalizeCellValue(rawValue)
    if (normalizedValue === null && rawValue !== null) {
      return null
    }

    normalizedCells[column.key] = normalizedValue
  }

  return normalizedCells
}

function normalizeRows(
  payload: unknown,
  columns: ReadonlyArray<InventoryItemsTableColumn>,
): ReadonlyArray<InventoryItemsTableRow> | null {
  if (!Array.isArray(payload)) {
    return null
  }

  const normalizedRows: InventoryItemsTableRow[] = []
  const seenItemIds = new Set<string>()

  for (const rawRow of payload) {
    if (!isRecord(rawRow)) {
      return null
    }

    const itemId = normalizeStringId(rawRow.itemId)
    const version = normalizePositiveInteger(rawRow.version)
    const cells = normalizeCells(rawRow.cells, columns)
    const like = normalizeLike(rawRow.like)

    if (itemId === null || version === null || cells === null || like === null || seenItemIds.has(itemId)) {
      return null
    }

    seenItemIds.add(itemId)
    normalizedRows.push({
      itemId,
      version,
      cells,
      like,
    })
  }

  return normalizedRows
}

function normalizeInventoryItemsTablePayload(payload: unknown): InventoryItemsTablePage | null {
  if (!isRecord(payload)) {
    return null
  }

  const inventoryId = normalizeStringId(payload.inventoryId)
  const version = normalizePositiveInteger(payload.version)
  const columns = normalizeColumns(payload.columns)
  const page = normalizePositiveInteger(payload.page)
  const pageSize = normalizePositiveInteger(payload.pageSize)
  const totalCount = normalizeNonNegativeInteger(payload.totalCount)

  if (
    inventoryId === null
    || version === null
    || columns === null
    || page === null
    || pageSize === null
    || totalCount === null
  ) {
    return null
  }

  const rows = normalizeRows(payload.rows, columns)
  if (rows === null) {
    return null
  }

  return {
    inventoryId,
    version,
    columns,
    rows,
    page,
    pageSize,
    totalCount,
  }
}

function pickFirstValidationError(validationErrors: Record<string, string[]>): string | null {
  for (const errors of Object.values(validationErrors)) {
    if (errors.length > 0) {
      return errors[0]
    }
  }

  return null
}

function toFailure(
  status: number,
  message: string,
  validationErrors: Record<string, string[]>,
): InventoryItemsTableFailure {
  return {
    ok: false,
    status,
    message,
    validationErrors,
  }
}

export function isInventoryItemsTableSortField(value: string): value is InventoryItemsTableSortField {
  return normalizeSortField(value) !== null
}

export async function requestInventoryItemsTable(
  inventoryId: string,
  request: InventoryItemsTableRequest,
  signal: AbortSignal,
): Promise<InventoryItemsTableRequestResult> {
  const response = await apiRequest<unknown>(`/inventories/${inventoryId}/items`, {
    signal,
    query: {
      page: request.page,
      pageSize: request.pageSize,
      sortField: request.sortField,
      sortDirection: request.sortDirection,
    },
  })

  if (!response.ok) {
    const validationErrors = response.problem?.errors ?? {}
    const firstValidationError = pickFirstValidationError(validationErrors)

    return toFailure(
      response.status,
      firstValidationError ?? response.error.message,
      validationErrors,
    )
  }

  const normalizedPayload = normalizeInventoryItemsTablePayload(response.data)
  if (normalizedPayload === null) {
    return toFailure(
      response.status,
      'Received invalid response format from /inventories/{id}/items.',
      {},
    )
  }

  return {
    ok: true,
    data: normalizedPayload,
  }
}
