import { extractVersionStamp, normalizeETag, type VersionStamp } from '../../../shared/api/concurrency.ts'
import { apiRequest, type ApiRequestOptions, type ApiResult, type ApiSuccess } from '../../../shared/api/httpClient.ts'
import type { InventoryCustomFieldType } from '../../inventory/model/inventoryEditorTypes.ts'
import type { ItemDetails, ItemFieldValue, ItemUserSummary, UpdateItemPayload } from './types.ts'

type ItemLifecycleFailure = {
  ok: false
  status: number
  code: string | null
  message: string
  validationErrors: Record<string, string[]>
}

type ItemLifecycleSuccess = {
  ok: true
  data: ItemDetails
  etag: string | null
  versionStamp: VersionStamp
}

export type ItemDetailsRequestResult = ItemLifecycleSuccess | ItemLifecycleFailure

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

function normalizeStringId(value: unknown): string | null {
  const normalizedValue = normalizeNonEmptyString(value)
  if (normalizedValue === null || !/^\d+$/.test(normalizedValue)) {
    return null
  }

  return normalizedValue
}

function normalizePositiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null
}

function normalizeNonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

function normalizeUtcIsoDate(value: unknown): string | null {
  const normalizedValue = normalizeNonEmptyString(value)
  if (normalizedValue === null) {
    return null
  }

  return Number.isNaN(Date.parse(normalizedValue)) ? null : normalizedValue
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

function normalizeItemFieldValue(value: unknown): ItemFieldValue | null {
  if (value === null) {
    return null
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'boolean') {
    return value
  }

  return null
}

function normalizeItemUserSummary(value: unknown): ItemUserSummary | null {
  if (value === null) {
    return null
  }

  if (!isRecord(value)) {
    return null
  }

  const id = normalizeStringId(value.id)
  const userName = normalizeNonEmptyString(value.userName)
  const displayName = normalizeNonEmptyString(value.displayName)

  if (id === null || userName === null || displayName === null) {
    return null
  }

  return {
    id,
    userName,
    displayName,
  }
}

function normalizeItemDetailsPayload(payload: unknown): ItemDetails | null {
  if (!isRecord(payload)) {
    return null
  }

  const id = normalizeStringId(payload.id)
  const customId = normalizeNonEmptyString(payload.customId)
  const version = normalizePositiveInteger(payload.version)

  if (id === null || customId === null || version === null) {
    return null
  }

  if (!isRecord(payload.inventory)) {
    return null
  }

  const inventoryId = normalizeStringId(payload.inventory.id)
  const inventoryTitle = normalizeNonEmptyString(payload.inventory.title)
  if (inventoryId === null || inventoryTitle === null) {
    return null
  }

  if (!isRecord(payload.fixedFields)) {
    return null
  }

  const createdAt = normalizeUtcIsoDate(payload.fixedFields.createdAt)
  const updatedAt = normalizeUtcIsoDate(payload.fixedFields.updatedAt)
  const createdBy = normalizeItemUserSummary(payload.fixedFields.createdBy)
  const updatedBy = normalizeItemUserSummary(payload.fixedFields.updatedBy)

  if (createdAt === null || updatedAt === null) {
    return null
  }

  if (!Array.isArray(payload.fields)) {
    return null
  }

  const normalizedFields: Array<ItemDetails['fields'][number]> = []
  const seenFieldIds = new Set<string>()

  for (const rawField of payload.fields) {
    if (!isRecord(rawField)) {
      return null
    }

    const fieldId = normalizeStringId(rawField.fieldId)
    const fieldType = normalizeFieldType(rawField.fieldType)
    const title = normalizeNonEmptyString(rawField.title)
    const description = normalizeString(rawField.description)
    const value = normalizeItemFieldValue(rawField.value)

    if (
      fieldId === null
      || fieldType === null
      || title === null
      || description === null
      || (value === null && rawField.value !== null)
      || seenFieldIds.has(fieldId)
    ) {
      return null
    }

    seenFieldIds.add(fieldId)
    normalizedFields.push({
      fieldId,
      fieldType,
      title,
      description,
      value,
    })
  }

  if (!isRecord(payload.like)) {
    return null
  }

  const likeCount = normalizeNonNegativeInteger(payload.like.count)
  const likedByCurrentUser = typeof payload.like.likedByCurrentUser === 'boolean'
    ? payload.like.likedByCurrentUser
    : null

  if (likeCount === null || likedByCurrentUser === null) {
    return null
  }

  if (!isRecord(payload.permissions)) {
    return null
  }

  const { canEdit, canDelete, canLike } = payload.permissions
  if (
    typeof canEdit !== 'boolean'
    || typeof canDelete !== 'boolean'
    || typeof canLike !== 'boolean'
  ) {
    return null
  }

  return {
    id,
    inventory: {
      id: inventoryId,
      title: inventoryTitle,
    },
    customId,
    version,
    fixedFields: {
      createdAt,
      updatedAt,
      createdBy,
      updatedBy,
    },
    fields: normalizedFields,
    like: {
      count: likeCount,
      likedByCurrentUser,
    },
    permissions: {
      canEdit,
      canDelete,
      canLike,
    },
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

function createInvalidPayloadFailure<TData>(
  response: ApiSuccess<unknown>,
  message: string,
): ApiResult<TData> {
  return {
    ok: false,
    status: response.status,
    problem: null,
    error: {
      kind: 'invalid_json',
      message,
      problem: null,
    },
    meta: response.meta,
  }
}

export async function requestItemDetails(
  itemId: string,
  signal: AbortSignal,
): Promise<ItemDetailsRequestResult> {
  const response = await apiRequest<unknown>(`/items/${itemId}`, {
    signal,
  })

  if (!response.ok) {
    const validationErrors = response.problem?.errors ?? {}
    const firstValidationError = pickFirstValidationError(validationErrors)

    return {
      ok: false,
      status: response.status,
      code: response.problem?.code ?? null,
      message: firstValidationError ?? response.error.message,
      validationErrors,
    }
  }

  const normalizedItem = normalizeItemDetailsPayload(response.data)
  if (normalizedItem === null) {
    return {
      ok: false,
      status: response.status,
      code: null,
      message: 'Received invalid response format from /items/{id}.',
      validationErrors: {},
    }
  }

  const versionStamp = extractVersionStamp(response)
  if (versionStamp === null) {
    return {
      ok: false,
      status: response.status,
      code: null,
      message: 'Missing version/ETag in /items/{id} response.',
      validationErrors: {},
    }
  }

  return {
    ok: true,
    data: normalizedItem,
    etag: normalizeETag(response.meta.etag),
    versionStamp,
  }
}

export async function updateItem(
  itemId: string,
  payload: UpdateItemPayload,
  options: ApiRequestOptions = {},
): Promise<ApiResult<ItemDetails>> {
  const response = await apiRequest<unknown>(`/items/${itemId}`, {
    ...options,
    method: 'PUT',
    body: payload,
  })

  if (!response.ok) {
    return response
  }

  const normalizedPayload = normalizeItemDetailsPayload(response.data)
  if (normalizedPayload === null) {
    return createInvalidPayloadFailure(
      response,
      'Received invalid response format from PUT /items/{id}.',
    )
  }

  return {
    ...response,
    data: normalizedPayload,
  }
}

export async function deleteItem(
  itemId: string,
  options: ApiRequestOptions = {},
): Promise<ApiResult<null>> {
  const response = await apiRequest<unknown>(`/items/${itemId}`, {
    ...options,
    method: 'DELETE',
  })

  if (!response.ok) {
    return response
  }

  return {
    ...response,
    data: null,
  }
}
