import { apiRequest, type ApiRequestOptions, type ApiResult } from '../../../shared/api/httpClient.ts'

export type CreateInventoryImageUploadPresignPayload = {
  filename: string
  contentType: string
  size: number
}

export type ImageUploadContract = {
  url: string
  method: string
  headers: Record<string, string>
  formFields: Record<string, string>
  expiresAtUtc: string
}

export type InventoryImageUploadPresignPayload = {
  upload: ImageUploadContract
  publicUrl: string
}

export type UploadFileToStorageOptions = {
  upload: ImageUploadContract
  file: File
  signal?: AbortSignal
  onProgress?: (percent: number) => void
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

function normalizeStringMap(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) {
    return null
  }

  const normalized: Record<string, string> = {}
  for (const [key, rawValue] of Object.entries(value)) {
    if (typeof rawValue !== 'string') {
      return null
    }

    normalized[key] = rawValue
  }

  return normalized
}

function normalizePresignPayload(payload: unknown): InventoryImageUploadPresignPayload | null {
  if (!isRecord(payload) || !isRecord(payload.upload)) {
    return null
  }

  const publicUrl = normalizeNonEmptyString(payload.publicUrl)
  const url = normalizeNonEmptyString(payload.upload.url)
  const method = normalizeNonEmptyString(payload.upload.method)
  const headers = normalizeStringMap(payload.upload.headers)
  const formFields = normalizeStringMap(payload.upload.formFields)
  const expiresAtUtc = normalizeNonEmptyString(payload.upload.expiresAtUtc)

  if (
    publicUrl === null
    || url === null
    || method === null
    || headers === null
    || formFields === null
    || expiresAtUtc === null
  ) {
    return null
  }

  return {
    publicUrl,
    upload: {
      url,
      method,
      headers,
      formFields,
      expiresAtUtc,
    },
  }
}

function createAbortError(): Error {
  if (typeof DOMException === 'function') {
    return new DOMException('Image upload was aborted.', 'AbortError')
  }

  const abortError = new Error('Image upload was aborted.')
  abortError.name = 'AbortError'
  return abortError
}

function normalizeUploadMethod(rawMethod: string): 'PUT' | 'POST' | null {
  const normalizedMethod = rawMethod.trim().toUpperCase()

  if (normalizedMethod === 'PUT' || normalizedMethod === 'POST') {
    return normalizedMethod
  }

  return null
}

function normalizeProgressPercent(loaded: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) {
    return 0
  }

  const rawPercent = Math.round((loaded / total) * 100)
  return Math.max(0, Math.min(100, rawPercent))
}

export async function requestInventoryImageUploadPresign(
  payload: CreateInventoryImageUploadPresignPayload,
  options: ApiRequestOptions = {},
): Promise<ApiResult<InventoryImageUploadPresignPayload>> {
  const response = await apiRequest<unknown>('/uploads/images/presign', {
    ...options,
    method: 'POST',
    body: payload,
  })

  if (!response.ok) {
    return response
  }

  const normalizedPayload = normalizePresignPayload(response.data)
  if (normalizedPayload === null) {
    return {
      ok: false,
      status: response.status,
      problem: null,
      error: {
        kind: 'invalid_json',
        message: 'Received invalid response format from /uploads/images/presign.',
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

export async function uploadFileToStorage({
  upload,
  file,
  signal,
  onProgress,
}: UploadFileToStorageOptions): Promise<void> {
  const method = normalizeUploadMethod(upload.method)
  if (method === null) {
    throw new Error(`Unsupported upload method "${upload.method}".`)
  }

  if (signal?.aborted) {
    throw createAbortError()
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    const handleAbort = () => {
      xhr.abort()
    }

    if (signal !== undefined) {
      signal.addEventListener('abort', handleAbort, { once: true })
    }

    const cleanup = () => {
      if (signal !== undefined) {
        signal.removeEventListener('abort', handleAbort)
      }
    }

    xhr.open(method, upload.url, true)

    for (const [headerName, headerValue] of Object.entries(upload.headers)) {
      xhr.setRequestHeader(headerName, headerValue)
    }

    xhr.upload.onprogress = (event) => {
      if (onProgress === undefined) {
        return
      }

      if (event.lengthComputable) {
        onProgress(normalizeProgressPercent(event.loaded, event.total))
      }
    }

    xhr.onerror = () => {
      cleanup()
      reject(new Error('Image upload failed due to a network error.'))
    }

    xhr.onabort = () => {
      cleanup()
      reject(createAbortError())
    }

    xhr.onload = () => {
      cleanup()
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100)
        resolve()
        return
      }

      reject(new Error(`Image upload failed with status ${String(xhr.status)}.`))
    }

    if (method === 'POST') {
      const formData = new FormData()
      for (const [fieldName, fieldValue] of Object.entries(upload.formFields)) {
        formData.append(fieldName, fieldValue)
      }
      formData.append('file', file)
      xhr.send(formData)
      return
    }

    xhr.send(file)
  })
}
