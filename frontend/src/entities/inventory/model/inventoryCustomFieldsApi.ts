import { extractVersionStamp, normalizeETag, type VersionStamp } from '../../../shared/api/concurrency.ts'
import type { ApiFailure, ApiRequestOptions, ApiResult, ApiSuccess } from '../../../shared/api/httpClient.ts'
import { apiRequest } from '../../../shared/api/httpClient.ts'
import { normalizeProblemDetails } from '../../../shared/api/problemDetails.ts'
import type { InventoryCustomFieldType, InventoryEditorCustomField } from './inventoryEditorTypes.ts'

export type ReplaceInventoryCustomFieldRequest = {
  id: string | null
  fieldType: InventoryCustomFieldType
  title: string
  description: string
  showInTable: boolean
}

export type ReplaceInventoryCustomFieldsRequestPayload = {
  fields: ReadonlyArray<ReplaceInventoryCustomFieldRequest>
}

export type ReplaceInventoryCustomFieldsResponsePayload = {
  version: number
  fields: ReadonlyArray<InventoryEditorCustomField>
  etag: string | null
  versionStamp: VersionStamp
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizePositiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : null
}

function normalizeString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function normalizeStringId(value: unknown): string | null {
  const rawId = normalizeString(value)
  if (rawId === null) {
    return null
  }

  const normalizedId = rawId.trim()
  return /^\d+$/.test(normalizedId) ? normalizedId : null
}

function normalizeCustomFieldType(value: unknown): InventoryCustomFieldType | null {
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

function normalizeCustomFields(payload: unknown): ReadonlyArray<InventoryEditorCustomField> | null {
  if (!Array.isArray(payload)) {
    return null
  }

  const normalizedFields: InventoryEditorCustomField[] = []
  const seenIds = new Set<string>()

  for (const rawField of payload) {
    if (!isRecord(rawField)) {
      return null
    }

    const id = normalizeStringId(rawField.id)
    const fieldType = normalizeCustomFieldType(rawField.fieldType)
    const title = normalizeString(rawField.title)
    const description = normalizeString(rawField.description)
    const showInTable = typeof rawField.showInTable === 'boolean' ? rawField.showInTable : null

    if (
      id === null
      || fieldType === null
      || title === null
      || description === null
      || showInTable === null
      || seenIds.has(id)
    ) {
      return null
    }

    seenIds.add(id)
    normalizedFields.push({
      id,
      fieldType,
      title,
      description,
      showInTable,
    })
  }

  return normalizedFields
}

function normalizeResponsePayload(payload: unknown): Omit<ReplaceInventoryCustomFieldsResponsePayload, 'etag' | 'versionStamp'> | null {
  if (!isRecord(payload)) {
    return null
  }

  const version = normalizePositiveInteger(payload.version)
  const fields = normalizeCustomFields(payload.fields)

  if (version === null || fields === null) {
    return null
  }

  return {
    version,
    fields,
  }
}

function createInvalidPayloadFailure(result: ApiSuccess<unknown>, detail: string): ApiFailure {
  const problem = normalizeProblemDetails({
    payload: null,
    status: result.status,
    fallbackTitle: 'Invalid JSON Response',
    fallbackDetail: detail,
  })

  return {
    ok: false,
    status: result.status,
    problem,
    error: {
      kind: 'invalid_json',
      message: detail,
      problem,
    },
    meta: result.meta,
  }
}

export async function replaceInventoryCustomFields(
  inventoryId: string,
  payload: ReplaceInventoryCustomFieldsRequestPayload,
  options: ApiRequestOptions = {},
): Promise<ApiResult<ReplaceInventoryCustomFieldsResponsePayload>> {
  const result = await apiRequest<unknown>(`/inventories/${inventoryId}/custom-fields`, {
    ...options,
    method: 'PUT',
    body: payload,
  })

  if (!result.ok) {
    return result
  }

  const normalizedPayload = normalizeResponsePayload(result.data)
  if (normalizedPayload === null) {
    return createInvalidPayloadFailure(
      result,
      'Received invalid response format from /inventories/{id}/custom-fields.',
    )
  }

  const versionStamp = extractVersionStamp(result)
  if (versionStamp === null) {
    return createInvalidPayloadFailure(
      result,
      'Missing version/ETag in /inventories/{id}/custom-fields response.',
    )
  }

  return {
    ...result,
    data: {
      ...normalizedPayload,
      etag: normalizeETag(result.meta.etag),
      versionStamp,
    },
  }
}
