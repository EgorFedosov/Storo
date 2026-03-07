import type { NormalizedProblemDetails, ProblemDetails } from '../types/problemDetails.ts'

type NormalizeProblemDetailsOptions = {
  payload: unknown
  status: number
  fallbackTitle: string
  fallbackDetail: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function parseValidationErrors(value: unknown): Record<string, string[]> {
  if (!isRecord(value)) {
    return {}
  }

  const normalizedErrors: Record<string, string[]> = {}

  for (const [field, fieldErrors] of Object.entries(value)) {
    if (isStringArray(fieldErrors)) {
      normalizedErrors[field] = fieldErrors
      continue
    }

    if (typeof fieldErrors === 'string') {
      normalizedErrors[field] = [fieldErrors]
    }
  }

  return normalizedErrors
}

export function parseProblemDetails(payload: unknown): ProblemDetails | null {
  if (!isRecord(payload)) {
    return null
  }

  const hasKnownProblemField =
    typeof payload.type === 'string' ||
    typeof payload.title === 'string' ||
    typeof payload.status === 'number' ||
    typeof payload.detail === 'string' ||
    typeof payload.instance === 'string' ||
    typeof payload.code === 'string' ||
    isRecord(payload.errors)

  if (!hasKnownProblemField) {
    return null
  }

  const problem: ProblemDetails = { ...payload }

  if (!isRecord(problem.errors)) {
    delete problem.errors
  }

  if (typeof problem.code !== 'string') {
    delete problem.code
  }

  return problem
}

export function normalizeProblemDetails(options: NormalizeProblemDetailsOptions): NormalizedProblemDetails {
  const parsedProblem = parseProblemDetails(options.payload)
  const payloadRecord = isRecord(options.payload) ? options.payload : null
  const errorSource = parsedProblem?.errors ?? payloadRecord?.errors

  return {
    type: typeof parsedProblem?.type === 'string' ? parsedProblem.type : null,
    title: typeof parsedProblem?.title === 'string' ? parsedProblem.title : options.fallbackTitle,
    status: typeof parsedProblem?.status === 'number' ? parsedProblem.status : options.status,
    detail: typeof parsedProblem?.detail === 'string' ? parsedProblem.detail : options.fallbackDetail,
    instance: typeof parsedProblem?.instance === 'string' ? parsedProblem.instance : null,
    code:
      typeof parsedProblem?.code === 'string'
        ? parsedProblem.code
        : typeof payloadRecord?.code === 'string'
          ? payloadRecord.code
          : null,
    errors: parseValidationErrors(errorSource),
    raw: parsedProblem,
  }
}
