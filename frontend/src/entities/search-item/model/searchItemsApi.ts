import { apiRequest } from '../../../shared/api/httpClient.ts'

export type SearchItemsSortField = 'relevance' | 'updatedAt' | 'createdAt' | 'customId'
export type SearchItemsSortDirection = 'asc' | 'desc'

export type SearchItemsSort = {
  field: SearchItemsSortField
  direction: SearchItemsSortDirection
}

export type SearchItemInventorySummary = {
  id: string
  title: string
}

export type SearchItemSummary = {
  id: string
  customId: string
  inventory: SearchItemInventorySummary
  createdAt: string
  updatedAt: string
}

export type SearchItemsPage = {
  items: ReadonlyArray<SearchItemSummary>
  page: number
  pageSize: number
  totalCount: number
  sort: SearchItemsSort
}

export type SearchItemsRequest = {
  q: string
  page: number
  pageSize: number
  sort: string
}

export type SearchItemsRequestResult =
  | {
      ok: true
      data: SearchItemsPage
    }
  | {
      ok: false
      errorMessage: string
    }

const validSortFields: ReadonlyArray<SearchItemsSortField> = ['relevance', 'updatedAt', 'createdAt', 'customId']
const validSortDirections: ReadonlyArray<SearchItemsSortDirection> = ['asc', 'desc']

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
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return value
  }

  if (typeof value !== 'string') {
    return null
  }

  const normalizedValue = value.trim()
  if (!/^[1-9]\d*$/.test(normalizedValue)) {
    return null
  }

  const parsedValue = Number(normalizedValue)
  return Number.isSafeInteger(parsedValue) ? parsedValue : null
}

function normalizeNonNegativeInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return value
  }

  if (typeof value !== 'string') {
    return null
  }

  const normalizedValue = value.trim()
  if (!/^(0|[1-9]\d*)$/.test(normalizedValue)) {
    return null
  }

  const parsedValue = Number(normalizedValue)
  return Number.isSafeInteger(parsedValue) ? parsedValue : null
}

function normalizeId(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalizedValue = value.trim()
    return normalizedValue.length > 0 ? normalizedValue : null
  }

  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return String(value)
  }

  return null
}

function normalizeIsoUtcDate(value: unknown): string | null {
  const normalizedValue = normalizeNonEmptyString(value)
  if (normalizedValue === null) {
    return null
  }

  return Number.isNaN(Date.parse(normalizedValue)) ? null : normalizedValue
}

function normalizeSortField(value: unknown): SearchItemsSortField | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalizedValue = value.trim()
  return validSortFields.includes(normalizedValue as SearchItemsSortField)
    ? (normalizedValue as SearchItemsSortField)
    : null
}

function normalizeSortDirection(value: unknown): SearchItemsSortDirection | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalizedValue = value.trim().toLowerCase()
  return validSortDirections.includes(normalizedValue as SearchItemsSortDirection)
    ? (normalizedValue as SearchItemsSortDirection)
    : null
}

function normalizeSearchItemInventory(payload: unknown): SearchItemInventorySummary | null {
  if (!isRecord(payload)) {
    return null
  }

  const id = normalizeId(payload.id)
  const title = normalizeNonEmptyString(payload.title)

  if (id === null || title === null) {
    return null
  }

  return {
    id,
    title,
  }
}

function normalizeSearchItem(payload: unknown): SearchItemSummary | null {
  if (!isRecord(payload)) {
    return null
  }

  const id = normalizeId(payload.id)
  const customId = normalizeNonEmptyString(payload.customId)
  const inventory = normalizeSearchItemInventory(payload.inventory)
  const createdAt = normalizeIsoUtcDate(payload.createdAt)
  const updatedAt = normalizeIsoUtcDate(payload.updatedAt)

  if (id === null || customId === null || inventory === null || createdAt === null || updatedAt === null) {
    return null
  }

  return {
    id,
    customId,
    inventory,
    createdAt,
    updatedAt,
  }
}

function normalizeSearchItemsPayload(payload: unknown): SearchItemsPage | null {
  if (!isRecord(payload) || !Array.isArray(payload.items) || !isRecord(payload.sort)) {
    return null
  }

  const page = normalizePositiveInteger(payload.page)
  const pageSize = normalizePositiveInteger(payload.pageSize)
  const totalCount = normalizeNonNegativeInteger(payload.totalCount)
  const sortField = normalizeSortField(payload.sort.field)
  const sortDirection = normalizeSortDirection(payload.sort.direction)

  if (page === null || pageSize === null || totalCount === null || sortField === null || sortDirection === null) {
    return null
  }

  const items = payload.items
    .map(normalizeSearchItem)
    .filter((item): item is SearchItemSummary => item !== null)

  if (items.length !== payload.items.length) {
    return null
  }

  return {
    items,
    page,
    pageSize,
    totalCount,
    sort: {
      field: sortField,
      direction: sortDirection,
    },
  }
}

export async function searchItems(request: SearchItemsRequest, signal: AbortSignal): Promise<SearchItemsRequestResult> {
  const response = await apiRequest<unknown>('/search/items', {
    signal,
    query: {
      q: request.q,
      page: request.page,
      pageSize: request.pageSize,
      sort: request.sort,
    },
  })

  if (!response.ok) {
    return {
      ok: false,
      errorMessage: response.error.message,
    }
  }

  const normalizedPayload = normalizeSearchItemsPayload(response.data)
  if (normalizedPayload === null) {
    return {
      ok: false,
      errorMessage: 'Received invalid response format from /search/items.',
    }
  }

  return {
    ok: true,
    data: normalizedPayload,
  }
}
