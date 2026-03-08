import type { ApiFailure, ApiRequestOptions, ApiResult, ApiSuccess } from './httpClient.ts'

export type ConcurrencyProblemCode =
  | 'concurrency_conflict'
  | 'if_match_required'
  | 'invalid_if_match'
  | 'missing_local_version'
  | 'unknown_concurrency_error'

type ContractConcurrencyCode = Extract<
ConcurrencyProblemCode,
  'concurrency_conflict' | 'if_match_required' | 'invalid_if_match'
>

const concurrencyProblemCodes = new Set<ContractConcurrencyCode>([
  'concurrency_conflict',
  'if_match_required',
  'invalid_if_match',
])

export type VersionStamp = {
  etag: string
  version: number | null
}

export type ConcurrencyProblem = {
  status: number
  code: ConcurrencyProblemCode
  message: string
}

export type ConcurrencyProblemUi = {
  title: string
  description: string
  requiresReload: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizePositiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : null
}

export function normalizeETag(rawETag: string | null | undefined): string | null {
  if (rawETag === null || rawETag === undefined) {
    return null
  }

  const normalizedValue = rawETag.trim()
  return normalizedValue.length > 0 ? normalizedValue : null
}

function extractVersionValue(payload: unknown): number | null {
  if (!isRecord(payload)) {
    return null
  }

  return normalizePositiveInteger(payload.version)
}

function toEtagFromVersion(version: number): string {
  return `"${String(version)}"`
}

export function extractVersionStamp<TData>(result: ApiSuccess<TData>): VersionStamp | null {
  const etag = normalizeETag(result.meta.etag)
  const version = extractVersionValue(result.data)

  if (etag === null && version === null) {
    return null
  }

  return {
    etag: etag ?? toEtagFromVersion(version!),
    version,
  }
}

export function withIfMatch(
  options: Omit<ApiRequestOptions, 'ifMatch'> = {},
  versionStamp: VersionStamp,
): ApiRequestOptions {
  return {
    ...options,
    ifMatch: versionStamp.etag,
  }
}

function toKnownConcurrencyCode(rawCode: string | null): ContractConcurrencyCode | null {
  if (rawCode === null) {
    return null
  }

  return concurrencyProblemCodes.has(rawCode as ContractConcurrencyCode)
    ? (rawCode as ContractConcurrencyCode)
    : null
}

function inferConcurrencyCode(failure: ApiFailure): ConcurrencyProblemCode | null {
  const byContractCode = toKnownConcurrencyCode(failure.problem?.code ?? null)
  if (byContractCode !== null) {
    return byContractCode
  }

  if (failure.status === 412) {
    return 'concurrency_conflict'
  }

  if (failure.status === 428) {
    return 'if_match_required'
  }

  if (failure.status === 400) {
    return 'invalid_if_match'
  }

  return null
}

export function getConcurrencyProblem(failure: ApiFailure): ConcurrencyProblem | null {
  const code = inferConcurrencyCode(failure)
  if (code === null) {
    return null
  }

  return {
    status: failure.status,
    code,
    message: failure.error.message,
  }
}

export function getConcurrencyProblemFromResult(result: ApiResult<unknown>): ConcurrencyProblem | null {
  if (result.ok) {
    return null
  }

  return getConcurrencyProblem(result)
}

export function createMissingVersionProblem(): ConcurrencyProblem {
  return {
    status: 0,
    code: 'missing_local_version',
    message: 'Latest resource version is missing. Reload the entity before saving.',
  }
}

export function describeConcurrencyProblem(problem: ConcurrencyProblem): ConcurrencyProblemUi {
  if (problem.code === 'concurrency_conflict') {
    return {
      title: 'Data was changed by another user',
      description: 'Reload the latest version and apply your changes again.',
      requiresReload: true,
    }
  }

  if (problem.code === 'if_match_required') {
    return {
      title: 'Missing version token',
      description: 'Save was rejected because If-Match is required. Reload the entity and retry.',
      requiresReload: true,
    }
  }

  if (problem.code === 'invalid_if_match') {
    return {
      title: 'Invalid version token',
      description: 'Saved version token is not valid anymore. Reload the entity and retry.',
      requiresReload: true,
    }
  }

  if (problem.code === 'missing_local_version') {
    return {
      title: 'Local version is not initialized',
      description: 'Load the latest entity data before sending any mutating request.',
      requiresReload: true,
    }
  }

  return {
    title: 'Concurrency request failed',
    description: problem.message,
    requiresReload: false,
  }
}
