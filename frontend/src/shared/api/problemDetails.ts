import type { ProblemDetails } from '../types/problemDetails.ts'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function parseProblemDetails(payload: unknown): ProblemDetails | null {
  if (!isObject(payload)) {
    return null
  }

  const hasCoreField =
    typeof payload.title === 'string' ||
    typeof payload.detail === 'string' ||
    typeof payload.status === 'number'

  if (!hasCoreField) {
    return null
  }

  return payload as ProblemDetails
}
