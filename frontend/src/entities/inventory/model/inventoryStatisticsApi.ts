import { apiRequest } from '../../../shared/api/httpClient.ts'
import type { InventoryStatistics } from './inventoryStatisticsTypes.ts'

type InventoryStatisticsFailure = {
  ok: false
  status: number
  message: string
  validationErrors: Record<string, string[]>
}

type InventoryStatisticsSuccess = {
  ok: true
  data: InventoryStatistics
}

export type InventoryStatisticsRequestResult = InventoryStatisticsSuccess | InventoryStatisticsFailure

type NullableFiniteNumberParseResult =
  | {
    ok: true
    value: number | null
  }
  | {
    ok: false
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

function normalizeNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null
  }

  return typeof value === 'string' ? value : null
}

function normalizeNonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
}

function normalizeStringId(value: unknown): string | null {
  const normalizedValue = normalizeNonEmptyString(value)
  if (normalizedValue === null || !/^\d+$/.test(normalizedValue)) {
    return null
  }

  return normalizedValue
}

function normalizeUtcIsoDate(value: unknown): string | null {
  const normalizedValue = normalizeNonEmptyString(value)
  if (normalizedValue === null) {
    return null
  }

  return Number.isNaN(Date.parse(normalizedValue)) ? null : normalizedValue
}

function parseNullableFiniteNumber(value: unknown): NullableFiniteNumberParseResult {
  if (value === null) {
    return {
      ok: true,
      value: null,
    }
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { ok: false }
  }

  return {
    ok: true,
    value,
  }
}

function normalizeNumericFields(payload: unknown): InventoryStatistics['numericFields'] | null {
  if (!Array.isArray(payload)) {
    return null
  }

  const normalizedFields: Array<InventoryStatistics['numericFields'][number]> = []
  const seenFieldIds = new Set<string>()

  for (const rawField of payload) {
    if (!isRecord(rawField)) {
      return null
    }

    const fieldId = normalizeStringId(rawField.fieldId)
    const title = normalizeNonEmptyString(rawField.title)
    const min = parseNullableFiniteNumber(rawField.min)
    const max = parseNullableFiniteNumber(rawField.max)
    const avg = parseNullableFiniteNumber(rawField.avg)

    if (
      fieldId === null
      || title === null
      || seenFieldIds.has(fieldId)
      || !min.ok
      || !max.ok
      || !avg.ok
    ) {
      return null
    }

    seenFieldIds.add(fieldId)
    normalizedFields.push({
      fieldId,
      title,
      min: min.value,
      max: max.value,
      avg: avg.value,
    })
  }

  return normalizedFields
}

function normalizeStringFields(payload: unknown): InventoryStatistics['stringFields'] | null {
  if (!Array.isArray(payload)) {
    return null
  }

  const normalizedFields: Array<InventoryStatistics['stringFields'][number]> = []
  const seenFieldIds = new Set<string>()

  for (const rawField of payload) {
    if (!isRecord(rawField)) {
      return null
    }

    const fieldId = normalizeStringId(rawField.fieldId)
    const title = normalizeNonEmptyString(rawField.title)
    const mostFrequentValue = normalizeNullableString(rawField.mostFrequentValue)
    const mostFrequentCount = normalizeNonNegativeInteger(rawField.mostFrequentCount)

    if (
      fieldId === null
      || title === null
      || mostFrequentCount === null
      || seenFieldIds.has(fieldId)
    ) {
      return null
    }

    seenFieldIds.add(fieldId)
    normalizedFields.push({
      fieldId,
      title,
      mostFrequentValue,
      mostFrequentCount,
    })
  }

  return normalizedFields
}

function normalizeInventoryStatisticsPayload(payload: unknown): InventoryStatistics | null {
  if (!isRecord(payload)) {
    return null
  }

  const inventoryId = normalizeStringId(payload.inventoryId)
  const updatedAt = normalizeUtcIsoDate(payload.updatedAt)
  const itemsCount = normalizeNonNegativeInteger(payload.itemsCount)
  const numericFields = normalizeNumericFields(payload.numericFields)
  const stringFields = normalizeStringFields(payload.stringFields)

  if (
    inventoryId === null
    || updatedAt === null
    || itemsCount === null
    || numericFields === null
    || stringFields === null
  ) {
    return null
  }

  return {
    inventoryId,
    updatedAt,
    itemsCount,
    numericFields,
    stringFields,
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

export async function requestInventoryStatistics(
  inventoryId: string,
  signal: AbortSignal,
): Promise<InventoryStatisticsRequestResult> {
  const response = await apiRequest<unknown>(`/inventories/${inventoryId}/statistics`, {
    signal,
  })

  if (!response.ok) {
    const validationErrors = response.problem?.errors ?? {}
    const firstValidationError = pickFirstValidationError(validationErrors)

    return {
      ok: false,
      status: response.status,
      message: firstValidationError ?? response.error.message,
      validationErrors,
    }
  }

  const normalizedPayload = normalizeInventoryStatisticsPayload(response.data)
  if (normalizedPayload === null) {
    return {
      ok: false,
      status: response.status,
      message: 'Received invalid response format from /inventories/{id}/statistics.',
      validationErrors: {},
    }
  }

  return {
    ok: true,
    data: normalizedPayload,
  }
}
