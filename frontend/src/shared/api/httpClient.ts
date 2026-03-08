import type { NormalizedProblemDetails } from '../types/problemDetails.ts'
import { normalizeProblemDetails } from './problemDetails.ts'

export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type ApiErrorKind = 'http' | 'network' | 'aborted' | 'serialization' | 'invalid_json'
export type ApiQueryPrimitive = string | number | boolean | null | undefined
export type ApiQueryValue = ApiQueryPrimitive | ApiQueryPrimitive[]
export type ApiQueryParams = Record<string, ApiQueryValue>

export type ApiRequestOptions = {
  method?: RequestMethod
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
  query?: ApiQueryParams
  ifMatch?: string | null
}

export type ApiRequestMeta = {
  method: RequestMethod
  path: string
  url: string
}

export type ApiResponseMeta = ApiRequestMeta & {
  etag: string | null
}

export type ApiError = {
  kind: ApiErrorKind
  message: string
  problem: NormalizedProblemDetails | null
}

export type ApiSuccess<TData> = {
  ok: true
  status: number
  data: TData
  meta: ApiResponseMeta
}

export type ApiFailure = {
  ok: false
  status: number
  problem: NormalizedProblemDetails | null
  error: ApiError
  meta: ApiRequestMeta | ApiResponseMeta
}

export type ApiResult<TData> = ApiSuccess<TData> | ApiFailure

export type HttpClientConfig = {
  baseUrl: string
  fetchFn?: typeof fetch
}

export type HttpClient = {
  request<TData>(path: string, options?: ApiRequestOptions): Promise<ApiResult<TData>>
}

const defaultHeaders = {
  Accept: 'application/json',
} as const

let defaultClient = createHttpClient({ baseUrl: '/api/v1' })

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const normalizedName = name.toLowerCase()
  return Object.keys(headers).some((headerName) => headerName.toLowerCase() === normalizedName)
}

function normalizeIfMatch(value: string): string | null {
  const normalizedValue = value.trim()
  return normalizedValue.length > 0 ? normalizedValue : null
}

function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function normalizeBaseUrl(baseUrl: string): string {
  const trimmedBaseUrl = baseUrl.trim()

  if (trimmedBaseUrl.length === 0) {
    throw new Error('HTTP client baseUrl cannot be empty.')
  }

  return trimTrailingSlash(trimmedBaseUrl)
}

function resolveRequestUrl(baseUrl: string, path: string): string {
  if (isAbsoluteHttpUrl(path)) {
    return path
  }

  if (path.startsWith('/api/')) {
    return path
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${baseUrl}${normalizedPath}`
}

function appendQuery(url: string, query: ApiQueryParams | undefined): string {
  if (query === undefined) {
    return url
  }

  const params = new URLSearchParams()

  for (const [key, rawValue] of Object.entries(query)) {
    if (Array.isArray(rawValue)) {
      for (const nestedValue of rawValue) {
        if (nestedValue !== null && nestedValue !== undefined) {
          params.append(key, String(nestedValue))
        }
      }
      continue
    }

    if (rawValue !== null && rawValue !== undefined) {
      params.append(key, String(rawValue))
    }
  }

  const queryString = params.toString()
  if (queryString.length === 0) {
    return url
  }

  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}${queryString}`
}

function isNativeRequestBody(value: unknown): value is BodyInit {
  return (
    typeof value === 'string' ||
    value instanceof Blob ||
    value instanceof FormData ||
    value instanceof URLSearchParams ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value)
  )
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === 'AbortError'
  }

  if (typeof error === 'object' && error !== null && 'name' in error) {
    return (error as { name: unknown }).name === 'AbortError'
  }

  return false
}

type ParsedResponsePayload = {
  payload: unknown
  parseError: unknown | null
}

async function parseResponsePayload(response: Response): Promise<ParsedResponsePayload> {
  if (response.status === 204 || response.status === 205) {
    return {
      payload: null,
      parseError: null,
    }
  }

  const contentType = (response.headers.get('content-type') ?? '').toLowerCase()
  const isJsonPayload = contentType.includes('application/json') || contentType.includes('+json')
  const isTextPayload = contentType.startsWith('text/')

  if (isJsonPayload) {
    try {
      return {
        payload: await response.json(),
        parseError: null,
      }
    } catch (error) {
      return {
        payload: null,
        parseError: error,
      }
    }
  }

  if (isTextPayload) {
    try {
      const textPayload = await response.text()
      return {
        payload: textPayload.length > 0 ? textPayload : null,
        parseError: null,
      }
    } catch (error) {
      return {
        payload: null,
        parseError: error,
      }
    }
  }

  return {
    payload: null,
    parseError: null,
  }
}

function createApiFailure(
  status: number,
  meta: ApiRequestMeta | ApiResponseMeta,
  kind: ApiErrorKind,
  message: string,
  problem: NormalizedProblemDetails | null,
): ApiFailure {
  return {
    ok: false,
    status,
    problem,
    error: {
      kind,
      message,
      problem,
    },
    meta,
  }
}

export function createHttpClient(config: HttpClientConfig): HttpClient {
  const normalizedBaseUrl = normalizeBaseUrl(config.baseUrl)
  const fetchFn = config.fetchFn ?? fetch

  return {
    async request<TData>(path: string, options: ApiRequestOptions = {}): Promise<ApiResult<TData>> {
      const method = options.method ?? 'GET'
      const requestUrl = appendQuery(resolveRequestUrl(normalizedBaseUrl, path), options.query)
      const requestMeta: ApiRequestMeta = {
        method,
        path,
        url: requestUrl,
      }

      const requestHeaders: Record<string, string> = {
        ...defaultHeaders,
        ...(options.headers ?? {}),
      }

      if (options.ifMatch !== undefined && options.ifMatch !== null) {
        const normalizedIfMatch = normalizeIfMatch(options.ifMatch)
        if (normalizedIfMatch === null) {
          const problem = normalizeProblemDetails({
            payload: null,
            status: 0,
            fallbackTitle: 'Client Request Error',
            fallbackDetail: 'If-Match token must be a non-empty string.',
          })

          return createApiFailure(
            0,
            requestMeta,
            'serialization',
            'If-Match token must be a non-empty string.',
            problem,
          )
        }

        requestHeaders['If-Match'] = normalizedIfMatch
      }

      let requestBody: BodyInit | undefined

      if (options.body !== undefined) {
        if (isNativeRequestBody(options.body)) {
          requestBody = options.body
        } else {
          try {
            requestBody = JSON.stringify(options.body)
          } catch {
            const problem = normalizeProblemDetails({
              payload: null,
              status: 0,
              fallbackTitle: 'Client Request Error',
              fallbackDetail: 'Failed to serialize request body to JSON.',
            })

            return createApiFailure(
              0,
              requestMeta,
              'serialization',
              'Failed to serialize request body to JSON.',
              problem,
            )
          }

          if (!hasHeader(requestHeaders, 'Content-Type')) {
            requestHeaders['Content-Type'] = 'application/json'
          }
        }
      }

      try {
        const response = await fetchFn(requestUrl, {
          method,
          credentials: 'include',
          signal: options.signal,
          headers: requestHeaders,
          body: requestBody,
        })

        const responseMeta: ApiResponseMeta = {
          ...requestMeta,
          etag: response.headers.get('etag'),
        }

        const { payload, parseError } = await parseResponsePayload(response)

        if (parseError !== null && response.ok) {
          const problem = normalizeProblemDetails({
            payload: null,
            status: response.status,
            fallbackTitle: 'Invalid JSON Response',
            fallbackDetail: 'Response body is not a valid JSON payload.',
          })

          return createApiFailure(
            response.status,
            responseMeta,
            'invalid_json',
            'Response body is not a valid JSON payload.',
            problem,
          )
        }

        if (response.ok) {
          return {
            ok: true,
            status: response.status,
            data: (payload ?? {}) as TData,
            meta: responseMeta,
          }
        }

        const fallbackDetail =
          typeof payload === 'string' && payload.trim().length > 0
            ? payload
            : parseError instanceof Error
              ? parseError.message
              : null

        const problem = normalizeProblemDetails({
          payload,
          status: response.status,
          fallbackTitle: response.statusText || 'HTTP Error',
          fallbackDetail,
        })

        const errorMessage =
          problem.detail ??
          problem.title ??
          `Request failed with status ${response.status}.`

        return createApiFailure(
          response.status,
          responseMeta,
          'http',
          errorMessage,
          problem,
        )
      } catch (error) {
        const requestWasAborted = isAbortError(error)
        const kind: ApiErrorKind = requestWasAborted ? 'aborted' : 'network'
        const fallbackTitle = requestWasAborted ? 'Request Aborted' : 'Network Error'
        const fallbackDetail =
          error instanceof Error ? error.message : 'Unexpected network error.'

        const problem = normalizeProblemDetails({
          payload: null,
          status: 0,
          fallbackTitle,
          fallbackDetail,
        })

        return createApiFailure(
          0,
          requestMeta,
          kind,
          fallbackDetail,
          problem,
        )
      }
    },
  }
}

export function configureApiClient(config: HttpClientConfig): void {
  defaultClient = createHttpClient(config)
}

export async function apiRequest<TData>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiResult<TData>> {
  return defaultClient.request<TData>(path, options)
}
