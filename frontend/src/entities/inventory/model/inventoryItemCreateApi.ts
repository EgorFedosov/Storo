import { normalizeETag } from '../../../shared/api/concurrency.ts'
import { apiRequest } from '../../../shared/api/httpClient.ts'
import type { InventoryCustomFieldType } from './inventoryEditorTypes.ts'

export type InventoryItemFieldValue = string | number | boolean | null

export type InventoryItemUserSummary = {
  id: string
  userName: string
  displayName: string
}

export type InventoryItemDetails = {
  id: string
  inventory: {
    id: string
    title: string
  }
  customId: string
  version: number
  fixedFields: {
    createdAt: string
    updatedAt: string
    createdBy: InventoryItemUserSummary | null
    updatedBy: InventoryItemUserSummary | null
  }
  fields: ReadonlyArray<{
    fieldId: string
    fieldType: InventoryCustomFieldType
    title: string
    description: string
    value: InventoryItemFieldValue
  }>
  like: {
    count: number
    likedByCurrentUser: boolean
  }
  permissions: {
    canEdit: boolean
    canDelete: boolean
    canLike: boolean
  }
}

export type CreateInventoryItemFieldPayload = {
  fieldId: string
  value: InventoryItemFieldValue
}

export type CreateInventoryItemRequestPayload = {
  customId: string | null
  fields: ReadonlyArray<CreateInventoryItemFieldPayload>
}

type CreateInventoryItemSuccess = {
  ok: true
  item: InventoryItemDetails
  etag: string | null
}

type CreateInventoryItemFailure = {
  ok: false
  status: number
  code: string | null
  message: string
  validationErrors: Record<string, string[]>
}

export type CreateInventoryItemRequestResult = CreateInventoryItemSuccess | CreateInventoryItemFailure

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

function normalizeItemFieldValue(value: unknown): InventoryItemFieldValue | null {
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

function normalizeItemUserSummary(value: unknown): InventoryItemUserSummary | null {
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

function normalizeItemDetailsPayload(payload: unknown): InventoryItemDetails | null {
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

  const normalizedFields: Array<InventoryItemDetails['fields'][number]> = []
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
      || value === null && rawField.value !== null
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

  const {
    canEdit,
    canDelete,
    canLike,
  } = payload.permissions

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

export async function createInventoryItem(
  inventoryId: string,
  payload: CreateInventoryItemRequestPayload,
  signal: AbortSignal,
): Promise<CreateInventoryItemRequestResult> {
  const response = await apiRequest<unknown>(`/inventories/${inventoryId}/items`, {
    method: 'POST',
    body: payload,
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
      message: 'Received invalid response format from /inventories/{id}/items.',
      validationErrors: {},
    }
  }

  return {
    ok: true,
    item: normalizedItem,
    etag: normalizeETag(response.meta.etag),
  }
}
