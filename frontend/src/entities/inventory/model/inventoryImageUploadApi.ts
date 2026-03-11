import { apiRequest, type ApiRequestOptions, type ApiResult } from '../../../shared/api/httpClient.ts'

export type InventoryFileUploadPayload = {
  publicUrl: string
  objectPath: string
  fileName: string
  contentType: string
  size: number
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
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.trunc(value)
  }

  return null
}

function normalizeUploadPayload(payload: unknown): InventoryFileUploadPayload | null {
  if (!isRecord(payload)) {
    return null
  }

  const publicUrl = normalizeNonEmptyString(payload.publicUrl)
  const objectPath = normalizeNonEmptyString(payload.objectPath)
  const fileName = normalizeNonEmptyString(payload.fileName)
  const contentType = normalizeNonEmptyString(payload.contentType)
  const size = normalizePositiveInteger(payload.size)

  if (
    publicUrl === null
    || objectPath === null
    || fileName === null
    || contentType === null
    || size === null
  ) {
    return null
  }

  return {
    publicUrl,
    objectPath,
    fileName,
    contentType,
    size,
  }
}

export async function uploadInventoryFile(
  file: File,
  options: ApiRequestOptions = {},
): Promise<ApiResult<InventoryFileUploadPayload>> {
  const formData = new FormData()
  formData.append('file', file, file.name)

  const response = await apiRequest<unknown>('/uploads/files', {
    ...options,
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    return response
  }

  const normalizedPayload = normalizeUploadPayload(response.data)
  if (normalizedPayload === null) {
    return {
      ok: false,
      status: response.status,
      problem: null,
      error: {
        kind: 'invalid_json',
        message: 'Received invalid response format from /uploads/files.',
        problem: null,
      },
      meta: response.meta,
    }
  }

  return {
    ...response,
    data: normalizedPayload,
  }
}

export async function deleteInventoryFile(
  publicUrl: string,
  options: ApiRequestOptions = {},
): Promise<ApiResult<null>> {
  const response = await apiRequest<unknown>('/uploads/files', {
    ...options,
    method: 'DELETE',
    body: { publicUrl },
  })

  if (!response.ok) {
    return response
  }

  return {
    ...response,
    data: null,
  }
}
