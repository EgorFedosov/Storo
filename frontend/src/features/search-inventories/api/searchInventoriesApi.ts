import { apiRequest } from '../../../shared/api/httpClient.ts'

export type SearchInventoriesQuery = {
  q: string | null
  tag: string | null
  page: number
  pageSize: number
  sort: string | null
}

export type SearchInventoriesSortField = 'relevance' | 'updatedAt' | 'createdAt' | 'title'
export type SearchSortDirection = 'asc' | 'desc'

export type SearchInventoriesSort = {
  field: SearchInventoriesSortField
  direction: SearchSortDirection
}

export type SearchInventorySummary = {
  id: string
  title: string
  descriptionMarkdown: string
  category: {
    id: number
    name: string
  }
  creator: {
    id: string
    userName: string
    displayName: string
  }
  tags: ReadonlyArray<{
    id: string
    name: string
  }>
  imageUrl: string | null
  isPublic: boolean
  itemsCount: number
  createdAt: string
  updatedAt: string
}

export type SearchInventoriesResponse = {
  items: ReadonlyArray<SearchInventorySummary>
  page: number
  pageSize: number
  totalCount: number
  sort: SearchInventoriesSort
}

export type SearchInventoriesRequestResult =
  | {
      ok: true
      data: SearchInventoriesResponse
    }
  | {
      ok: false
      status: number
      message: string
      validationErrors: Record<string, string[]>
    }

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

function normalizeString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function normalizePositiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
}

function normalizeNonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
}

function normalizeUtcDateTime(value: unknown): string | null {
  const normalizedValue = normalizeNonEmptyString(value)
  if (normalizedValue === null) {
    return null
  }

  return Number.isNaN(Date.parse(normalizedValue)) ? null : normalizedValue
}

function normalizeStringId(value: unknown): string | null {
  const normalizedValue = normalizeNonEmptyString(value)
  if (normalizedValue === null || !/^\d+$/.test(normalizedValue)) {
    return null
  }

  return normalizedValue
}

function normalizeSortField(value: unknown): SearchInventoriesSortField | null {
  if (value === 'relevance' || value === 'updatedAt' || value === 'createdAt' || value === 'title') {
    return value
  }

  return null
}

function normalizeSortDirection(value: unknown): SearchSortDirection | null {
  return value === 'asc' || value === 'desc' ? value : null
}

function normalizeSearchInventoriesSort(payload: unknown): SearchInventoriesSort | null {
  if (!isRecord(payload)) {
    return null
  }

  const field = normalizeSortField(payload.field)
  const direction = normalizeSortDirection(payload.direction)
  if (field === null || direction === null) {
    return null
  }

  return {
    field,
    direction,
  }
}

function normalizeInventoryCategory(payload: unknown): SearchInventorySummary['category'] | null {
  if (!isRecord(payload)) {
    return null
  }

  const id = normalizePositiveInteger(payload.id)
  const name = normalizeNonEmptyString(payload.name)
  if (id === null || name === null) {
    return null
  }

  return {
    id,
    name,
  }
}

function normalizeInventoryCreator(payload: unknown): SearchInventorySummary['creator'] | null {
  if (!isRecord(payload)) {
    return null
  }

  const id = normalizeStringId(payload.id)
  const userName = normalizeNonEmptyString(payload.userName)
  const displayName = normalizeNonEmptyString(payload.displayName)
  if (id === null || userName === null || displayName === null) {
    return null
  }

  return {
    id,
    userName,
    displayName,
  }
}

function normalizeInventoryTags(payload: unknown): ReadonlyArray<{ id: string; name: string }> | null {
  if (!Array.isArray(payload)) {
    return null
  }

  const normalizedTags: Array<{ id: string; name: string }> = []
  const seenTagIds = new Set<string>()

  for (const rawTag of payload) {
    if (!isRecord(rawTag)) {
      return null
    }

    const id = normalizeStringId(rawTag.id)
    const name = normalizeNonEmptyString(rawTag.name)
    if (id === null || name === null || seenTagIds.has(id)) {
      return null
    }

    seenTagIds.add(id)
    normalizedTags.push({ id, name })
  }

  return normalizedTags
}

function normalizeInventorySummary(payload: unknown): SearchInventorySummary | null {
  if (!isRecord(payload)) {
    return null
  }

  const id = normalizeStringId(payload.id)
  const title = normalizeNonEmptyString(payload.title)
  const descriptionMarkdown = normalizeString(payload.descriptionMarkdown)
  const category = normalizeInventoryCategory(payload.category)
  const creator = normalizeInventoryCreator(payload.creator)
  const tags = normalizeInventoryTags(payload.tags)
  const imageUrl = payload.imageUrl === null ? null : normalizeNonEmptyString(payload.imageUrl)
  const isPublic = typeof payload.isPublic === 'boolean' ? payload.isPublic : null
  const itemsCount = normalizeNonNegativeInteger(payload.itemsCount)
  const createdAt = normalizeUtcDateTime(payload.createdAt)
  const updatedAt = normalizeUtcDateTime(payload.updatedAt)

  if (
    id === null
    || title === null
    || descriptionMarkdown === null
    || category === null
    || creator === null
    || tags === null
    || isPublic === null
    || itemsCount === null
    || createdAt === null
    || updatedAt === null
  ) {
    return null
  }

  return {
    id,
    title,
    descriptionMarkdown,
    category,
    creator,
    tags,
    imageUrl,
    isPublic,
    itemsCount,
    createdAt,
    updatedAt,
  }
}

function normalizeSearchInventoriesPayload(payload: unknown): SearchInventoriesResponse | null {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    return null
  }

  const page = normalizePositiveInteger(payload.page)
  const pageSize = normalizePositiveInteger(payload.pageSize)
  const totalCount = normalizeNonNegativeInteger(payload.totalCount)
  const sort = normalizeSearchInventoriesSort(payload.sort)
  if (page === null || pageSize === null || totalCount === null || sort === null) {
    return null
  }

  const items: SearchInventorySummary[] = []
  for (const rawItem of payload.items) {
    const normalizedItem = normalizeInventorySummary(rawItem)
    if (normalizedItem === null) {
      return null
    }

    items.push(normalizedItem)
  }

  return {
    items,
    page,
    pageSize,
    totalCount,
    sort,
  }
}

function pickFirstValidationError(validationErrors: Record<string, string[]>): string | null {
  for (const messages of Object.values(validationErrors)) {
    if (messages.length > 0) {
      return messages[0]
    }
  }

  return null
}

export async function requestSearchInventories(
  query: SearchInventoriesQuery,
  signal: AbortSignal,
): Promise<SearchInventoriesRequestResult> {
  const response = await apiRequest<unknown>('/search/inventories', {
    signal,
    query: {
      q: query.q,
      tag: query.tag,
      page: query.page,
      pageSize: query.pageSize,
      sort: query.sort,
    },
  })

  if (!response.ok) {
    const validationErrors = response.problem?.errors ?? {}
    const firstValidationError = pickFirstValidationError(validationErrors)

    return {
      ok: false,
      status: response.status,
      message: firstValidationError ?? response.error.message,
      validationErrors,
    }
  }

  const normalizedPayload = normalizeSearchInventoriesPayload(response.data)
  if (normalizedPayload === null) {
    return {
      ok: false,
      status: response.status,
      message: 'Received invalid response format from /search/inventories.',
      validationErrors: {},
    }
  }

  return {
    ok: true,
    data: normalizedPayload,
  }
}
