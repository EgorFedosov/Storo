import type { ApiFailure, ApiResult, ApiSuccess } from '../../../shared/api/httpClient.ts'
import { apiRequest } from '../../../shared/api/httpClient.ts'
import { normalizeProblemDetails } from '../../../shared/api/problemDetails.ts'

export type CreateInventoryRequestPayload = {
  title: string
  categoryId: number
  descriptionMarkdown: string
  imageUrl: string | null
  isPublic: boolean
  tags: ReadonlyArray<string>
}

export type CreatedInventoryPayload = {
  id: string
  version: number
  etag: string | null
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

function normalizeCreateInventoryPayload(payload: unknown): Omit<CreatedInventoryPayload, 'etag'> | null {
  if (!isRecord(payload)) {
    return null
  }

  const id = normalizeNonEmptyString(payload.id)
  const version = normalizePositiveInteger(payload.version)

  if (id === null || version === null) {
    return null
  }

  return {
    id,
    version,
  }
}

function createInvalidPayloadFailure(result: ApiSuccess<unknown>): ApiFailure {
  const detail = 'Received invalid response format from /inventories.'
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

export async function createInventory(
  payload: CreateInventoryRequestPayload,
  signal?: AbortSignal,
): Promise<ApiResult<CreatedInventoryPayload>> {
  const result = await apiRequest<unknown>('/inventories', {
    method: 'POST',
    body: payload,
    signal,
  })

  if (!result.ok) {
    return result
  }

  const normalizedPayload = normalizeCreateInventoryPayload(result.data)
  if (normalizedPayload === null) {
    return createInvalidPayloadFailure(result)
  }

  return {
    ...result,
    data: {
      ...normalizedPayload,
      etag: result.meta.etag,
    },
  }
}
