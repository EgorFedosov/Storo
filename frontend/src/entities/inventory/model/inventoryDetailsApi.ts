import { apiRequest } from '../../../shared/api/httpClient.ts'
import { toLocalizedCategoryName } from '../../../shared/lib/categoryName.ts'
import type { InventoryDetails } from './types.ts'

type InventoryDetailsFailure = {
  ok: false
  status: number
  message: string
  validationErrors: Record<string, string[]>
}

type InventoryDetailsSuccess = {
  ok: true
  data: InventoryDetails
  etag: string | null
}

export type InventoryDetailsRequestResult = InventoryDetailsSuccess | InventoryDetailsFailure

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

function normalizeOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null
  }

  return normalizeNonEmptyString(value)
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

function normalizeStringId(value: unknown): string | null {
  const normalizedValue = normalizeNonEmptyString(value)
  if (normalizedValue === null || !/^\d+$/.test(normalizedValue)) {
    return null
  }

  return normalizedValue
}

function normalizeUtcIsoDate(value: unknown): string | null {
  const normalizedValue = normalizeNonEmptyString(value)
  if (normalizedValue === null) {
    return null
  }

  return Number.isNaN(Date.parse(normalizedValue)) ? null : normalizedValue
}

function normalizeCategory(payload: unknown): InventoryDetails['header']['category'] | null {
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
    name: toLocalizedCategoryName(name),
  }
}

function normalizeHeader(payload: unknown): InventoryDetails['header'] | null {
  if (!isRecord(payload)) {
    return null
  }

  const title = normalizeNonEmptyString(payload.title)
  const descriptionMarkdown = normalizeString(payload.descriptionMarkdown)
  const category = normalizeCategory(payload.category)
  const imageUrl = normalizeOptionalString(payload.imageUrl)
  const isPublic = typeof payload.isPublic === 'boolean' ? payload.isPublic : null
  const createdAt = normalizeUtcIsoDate(payload.createdAt)
  const updatedAt = normalizeUtcIsoDate(payload.updatedAt)

  if (
    title === null
    || descriptionMarkdown === null
    || category === null
    || isPublic === null
    || createdAt === null
    || updatedAt === null
  ) {
    return null
  }

  return {
    title,
    descriptionMarkdown,
    category,
    imageUrl,
    isPublic,
    createdAt,
    updatedAt,
  }
}

function normalizeCreator(payload: unknown): InventoryDetails['creator'] | null {
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

function normalizeTags(payload: unknown): InventoryDetails['tags'] | null {
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

function normalizeSummary(payload: unknown): InventoryDetails['summary'] | null {
  if (!isRecord(payload)) {
    return null
  }

  const itemsCount = normalizeNonNegativeInteger(payload.itemsCount)
  if (itemsCount === null) {
    return null
  }

  return {
    itemsCount,
  }
}

function normalizePermissions(payload: unknown): InventoryDetails['permissions'] | null {
  if (!isRecord(payload)) {
    return null
  }

  const {
    canEditInventory,
    canManageAccess,
    canManageCustomFields,
    canManageCustomIdTemplate,
    canWriteItems,
    canComment,
    canLike,
  } = payload

  if (
    typeof canEditInventory !== 'boolean'
    || typeof canManageAccess !== 'boolean'
    || typeof canManageCustomFields !== 'boolean'
    || typeof canManageCustomIdTemplate !== 'boolean'
    || typeof canWriteItems !== 'boolean'
    || typeof canComment !== 'boolean'
    || typeof canLike !== 'boolean'
  ) {
    return null
  }

  return {
    canEditInventory,
    canManageAccess,
    canManageCustomFields,
    canManageCustomIdTemplate,
    canWriteItems,
    canComment,
    canLike,
  }
}

function normalizeInventoryDetailsPayload(payload: unknown): InventoryDetails | null {
  if (!isRecord(payload)) {
    return null
  }

  const id = normalizeStringId(payload.id)
  const version = normalizePositiveInteger(payload.version)
  const header = normalizeHeader(payload.header)
  const creator = normalizeCreator(payload.creator)
  const tags = normalizeTags(payload.tags)
  const summary = normalizeSummary(payload.summary)
  const permissions = normalizePermissions(payload.permissions)

  if (
    id === null
    || version === null
    || header === null
    || creator === null
    || tags === null
    || summary === null
    || permissions === null
  ) {
    return null
  }

  return {
    id,
    version,
    header,
    creator,
    tags,
    summary,
    permissions,
  }
}

function normalizeETag(rawValue: string | null): string | null {
  if (rawValue === null) {
    return null
  }

  const normalizedValue = rawValue.trim()
  return normalizedValue.length > 0 ? normalizedValue : null
}

function pickFirstValidationError(validationErrors: Record<string, string[]>): string | null {
  for (const errors of Object.values(validationErrors)) {
    if (errors.length > 0) {
      return errors[0]
    }
  }

  return null
}

export async function requestInventoryDetails(
  inventoryId: string,
  signal: AbortSignal,
): Promise<InventoryDetailsRequestResult> {
  const response = await apiRequest<unknown>(`/inventories/${inventoryId}`, {
    signal,
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

  const normalizedPayload = normalizeInventoryDetailsPayload(response.data)
  if (normalizedPayload === null) {
    return {
      ok: false,
      status: response.status,
      message: 'Received invalid response format from /inventories/{id}.',
      validationErrors: {},
    }
  }

  return {
    ok: true,
    data: normalizedPayload,
    etag: normalizeETag(response.meta.etag),
  }
}
