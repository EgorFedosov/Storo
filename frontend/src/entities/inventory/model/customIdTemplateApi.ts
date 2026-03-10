import type { ApiFailure, ApiRequestOptions, ApiResult, ApiSuccess } from '../../../shared/api/httpClient.ts'
import { apiRequest } from '../../../shared/api/httpClient.ts'
import { normalizeProblemDetails } from '../../../shared/api/problemDetails.ts'
import type { InventoryCustomIdPartType } from './inventoryEditorTypes.ts'

export type InventoryCustomIdTemplateMutationPart = {
  partType: InventoryCustomIdPartType
  fixedText: string | null
  formatPattern: string | null
}

export type InventoryCustomIdTemplateMutationPayload = {
  isEnabled: boolean
  parts: ReadonlyArray<InventoryCustomIdTemplateMutationPart>
}

export type InventoryCustomIdTemplateMutationResponse = {
  isEnabled: boolean
  parts: ReadonlyArray<InventoryCustomIdTemplateMutationPart>
  derivedValidationRegex: string | null
  preview: {
    sampleCustomId: string
    warnings: ReadonlyArray<string>
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function normalizeOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null
  }

  return normalizeString(value)
}

function normalizePartType(value: unknown): InventoryCustomIdPartType | null {
  if (
    value === 'fixed_text'
    || value === 'random_20_bit'
    || value === 'random_32_bit'
    || value === 'random_6_digit'
    || value === 'random_9_digit'
    || value === 'guid'
    || value === 'datetime'
    || value === 'sequence'
  ) {
    return value
  }

  return null
}

function normalizeMutationPart(payload: unknown): InventoryCustomIdTemplateMutationPart | null {
  if (!isRecord(payload)) {
    return null
  }

  const partType = normalizePartType(payload.partType)
  const fixedText = normalizeOptionalString(payload.fixedText)
  const formatPattern = normalizeOptionalString(payload.formatPattern)

  if (partType === null) {
    return null
  }

  return {
    partType,
    fixedText,
    formatPattern,
  }
}

function normalizeMutationParts(payload: unknown): ReadonlyArray<InventoryCustomIdTemplateMutationPart> | null {
  if (!Array.isArray(payload)) {
    return null
  }

  const normalizedParts: InventoryCustomIdTemplateMutationPart[] = []
  for (const rawPart of payload) {
    const normalizedPart = normalizeMutationPart(rawPart)
    if (normalizedPart === null) {
      return null
    }

    normalizedParts.push(normalizedPart)
  }

  return normalizedParts
}

function normalizePreview(payload: unknown): InventoryCustomIdTemplateMutationResponse['preview'] | null {
  if (!isRecord(payload) || !Array.isArray(payload.warnings)) {
    return null
  }

  const sampleCustomId = normalizeString(payload.sampleCustomId)
  if (sampleCustomId === null) {
    return null
  }

  const warnings: string[] = []
  for (const rawWarning of payload.warnings) {
    const warning = normalizeString(rawWarning)
    if (warning === null) {
      return null
    }

    warnings.push(warning)
  }

  return {
    sampleCustomId,
    warnings,
  }
}

function normalizeMutationResponse(payload: unknown): InventoryCustomIdTemplateMutationResponse | null {
  if (!isRecord(payload)) {
    return null
  }

  const isEnabled = typeof payload.isEnabled === 'boolean' ? payload.isEnabled : null
  const parts = normalizeMutationParts(payload.parts)
  const derivedValidationRegex = normalizeOptionalString(payload.derivedValidationRegex)
  const preview = normalizePreview(payload.preview)

  if (isEnabled === null || parts === null || preview === null) {
    return null
  }

  return {
    isEnabled,
    parts,
    derivedValidationRegex,
    preview,
  }
}

function createInvalidPayloadFailure(result: ApiSuccess<unknown>, path: string): ApiFailure {
  const detail = `Received invalid response format from ${path}.`
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

export async function previewInventoryCustomIdTemplate(
  inventoryId: string,
  payload: InventoryCustomIdTemplateMutationPayload,
  signal?: AbortSignal,
): Promise<ApiResult<InventoryCustomIdTemplateMutationResponse>> {
  const path = `/inventories/${inventoryId}/custom-id-template/preview`
  const result = await apiRequest<unknown>(path, {
    method: 'POST',
    body: payload,
    signal,
  })

  if (!result.ok) {
    return result
  }

  const normalizedPayload = normalizeMutationResponse(result.data)
  if (normalizedPayload === null) {
    return createInvalidPayloadFailure(result, path)
  }

  return {
    ...result,
    data: normalizedPayload,
  }
}

export async function saveInventoryCustomIdTemplate(
  inventoryId: string,
  payload: InventoryCustomIdTemplateMutationPayload,
  options: ApiRequestOptions = {},
): Promise<ApiResult<InventoryCustomIdTemplateMutationResponse>> {
  const path = `/inventories/${inventoryId}/custom-id-template`
  const result = await apiRequest<unknown>(path, {
    ...options,
    method: 'PUT',
    body: payload,
  })

  if (!result.ok) {
    return result
  }

  const normalizedPayload = normalizeMutationResponse(result.data)
  if (normalizedPayload === null) {
    return createInvalidPayloadFailure(result, path)
  }

  return {
    ...result,
    data: normalizedPayload,
  }
}
