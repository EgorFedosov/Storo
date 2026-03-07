import type { ProblemDetails } from '../types/problemDetails.ts'
import { parseProblemDetails } from './problemDetails.ts'

export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type ApiSuccess<TData> = {
  ok: true
  status: number
  data: TData
}

export type ApiFailure = {
  ok: false
  status: number
  problem: ProblemDetails | null
}

export type ApiResult<TData> = ApiSuccess<TData> | ApiFailure

export type ApiRequestOptions = {
  method?: RequestMethod
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
}

const jsonHeaders = {
  'Content-Type': 'application/json',
} as const

export async function apiRequest<TData>(path: string, options: ApiRequestOptions = {}): Promise<ApiResult<TData>> {
  const { method = 'GET', body, headers, signal } = options

  const response = await fetch(path, {
    method,
    credentials: 'include',
    signal,
    headers: {
      ...jsonHeaders,
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const contentType = response.headers.get('content-type') ?? ''
  const hasJsonPayload = contentType.includes('application/json')
  const payload = hasJsonPayload ? await response.json() : null

  if (response.ok) {
    return {
      ok: true,
      status: response.status,
      data: (payload ?? {}) as TData,
    }
  }

  return {
    ok: false,
    status: response.status,
    problem: parseProblemDetails(payload),
  }
}
