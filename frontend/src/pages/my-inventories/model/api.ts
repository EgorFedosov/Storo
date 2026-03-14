import { apiRequest, type ApiFailure } from '../../../shared/api/httpClient.ts'
import { toLocalizedCategoryName } from '../../../shared/lib/categoryName.ts'
import type {
  InventoryRelation,
  UserInventoryRow,
  UserInventoriesPageData,
  UserInventoriesQueryState,
  UserInventoriesSortDirection,
  UserInventoriesSortField,
} from './contracts.ts'

export type FetchCurrentUserInventoriesResult =
  | {
      ok: true
      data: UserInventoriesPageData
    }
  | {
      ok: false
      errorMessage: string
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

function normalizePositiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : null
}

function normalizeNonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : null
}

function normalizeUtcIsoDate(value: unknown): string | null {
  const normalizedValue = normalizeNonEmptyString(value)
  if (normalizedValue === null) {
    return null
  }

  return Number.isNaN(Date.parse(normalizedValue)) ? null : normalizedValue
}

function normalizeRelation(value: unknown): InventoryRelation | null {
  if (value === 'owned' || value === 'writable') {
    return value
  }

  return null
}

function normalizeSortField(value: unknown): UserInventoriesSortField | null {
  if (
    value === 'updatedAt' ||
    value === 'createdAt' ||
    value === 'title' ||
    value === 'itemsCount'
  ) {
    return value
  }

  return null
}

function normalizeSortDirection(value: unknown): UserInventoriesSortDirection | null {
  if (value === 'asc' || value === 'desc') {
    return value
  }

  return null
}

function normalizeInventoryRow(value: unknown): UserInventoriesPageData['items'][number] | null {
  if (!isRecord(value)) {
    return null
  }

  const id = normalizeNonEmptyString(value.id)
  const title = normalizeNonEmptyString(value.title)
  const category = isRecord(value.category) ? value.category : null
  const owner = isRecord(value.owner) ? value.owner : null
  const createdAt = normalizeUtcIsoDate(value.createdAt)
  const updatedAt = normalizeUtcIsoDate(value.updatedAt)

  if (id === null || title === null || category === null || owner === null || createdAt === null || updatedAt === null) {
    return null
  }

  const categoryId = normalizePositiveInteger(category.id)
  const categoryName = normalizeNonEmptyString(category.name)
  const ownerId = normalizeNonEmptyString(owner.id)
  const ownerUserName = normalizeNonEmptyString(owner.userName)
  const ownerDisplayName = normalizeNonEmptyString(owner.displayName)
  const itemsCount = normalizeNonNegativeInteger(value.itemsCount)

  if (
    categoryId === null ||
    categoryName === null ||
    ownerId === null ||
    ownerUserName === null ||
    ownerDisplayName === null ||
    itemsCount === null ||
    typeof value.isPublic !== 'boolean'
  ) {
    return null
  }

  return {
    id,
    title,
    category: {
      id: categoryId,
      name: toLocalizedCategoryName(categoryName),
    },
    owner: {
      id: ownerId,
      userName: ownerUserName,
      displayName: ownerDisplayName,
    },
    isPublic: value.isPublic,
    itemsCount,
    createdAt,
    updatedAt,
  }
}

function normalizeUserInventoriesPayload(
  payload: unknown,
  expectedRelation: InventoryRelation,
): UserInventoriesPageData | null {
  if (!isRecord(payload) || !Array.isArray(payload.items) || !isRecord(payload.sort)) {
    return null
  }

  const relation = normalizeRelation(payload.relation)
  const page = normalizePositiveInteger(payload.page)
  const pageSize = normalizePositiveInteger(payload.pageSize)
  const totalCount = normalizeNonNegativeInteger(payload.totalCount)
  const sortField = normalizeSortField(payload.sort.field)
  const sortDirection = normalizeSortDirection(payload.sort.direction)

  if (
    relation === null ||
    relation !== expectedRelation ||
    page === null ||
    pageSize === null ||
    totalCount === null ||
    sortField === null ||
    sortDirection === null
  ) {
    return null
  }

  const normalizedItems: UserInventoryRow[] = []

  for (const rawItem of payload.items) {
    const normalizedItem = normalizeInventoryRow(rawItem)
    if (normalizedItem === null) {
      return null
    }

    normalizedItems.push(normalizedItem)
  }

  return {
    relation,
    items: normalizedItems,
    page,
    pageSize,
    totalCount,
    sort: {
      field: sortField,
      direction: sortDirection,
    },
  }
}

function getFirstValidationErrorMessage(failure: ApiFailure): string | null {
  const validationErrors = failure.problem?.errors ?? {}

  for (const messages of Object.values(validationErrors)) {
    if (messages.length > 0) {
      return messages[0]
    }
  }

  return null
}

function normalizeFailureMessage(failure: ApiFailure): string {
  const validationErrorMessage = getFirstValidationErrorMessage(failure)
  if (validationErrorMessage !== null) {
    return validationErrorMessage
  }

  return failure.error.message
}

export async function fetchCurrentUserInventories(
  relation: InventoryRelation,
  queryState: UserInventoriesQueryState,
  signal?: AbortSignal,
): Promise<FetchCurrentUserInventoriesResult> {
  const normalizedQuery = queryState.query.trim()

  const response = await apiRequest<unknown>('/users/me/inventories', {
    signal,
    query: {
      relation,
      query: normalizedQuery.length > 0 ? normalizedQuery : undefined,
      sortField: queryState.sortField,
      sortDirection: queryState.sortDirection,
      page: queryState.page,
      pageSize: queryState.pageSize,
    },
  })

  if (!response.ok) {
    return {
      ok: false,
      errorMessage: normalizeFailureMessage(response),
    }
  }

  const normalizedPayload = normalizeUserInventoriesPayload(response.data, relation)
  if (normalizedPayload === null) {
    return {
      ok: false,
      errorMessage: 'Received invalid response format from /users/me/inventories.',
    }
  }

  return {
    ok: true,
    data: normalizedPayload,
  }
}
