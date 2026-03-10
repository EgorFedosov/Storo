import { apiRequest } from '../../../shared/api/httpClient.ts'

export type ItemLikeState = {
  itemId: string
  count: number
  likedByCurrentUser: boolean
}

export type ItemLikeMutationSuccess = {
  ok: true
  data: ItemLikeState
}

export type ItemLikeMutationFailure = {
  ok: false
  status: number
  code: string | null
  message: string
  validationErrors: Record<string, string[]>
}

export type ItemLikeMutationResult = ItemLikeMutationSuccess | ItemLikeMutationFailure

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

function normalizeStringId(value: unknown): string | null {
  const normalizedValue = normalizeNonEmptyString(value)
  if (normalizedValue === null || !/^\d+$/.test(normalizedValue)) {
    return null
  }

  return normalizedValue
}

function normalizeNonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

function normalizeLikeState(payload: unknown): ItemLikeState | null {
  if (!isRecord(payload)) {
    return null
  }

  const itemId = normalizeStringId(payload.itemId)
  const count = normalizeNonNegativeInteger(payload.count)
  const likedByCurrentUser = typeof payload.likedByCurrentUser === 'boolean'
    ? payload.likedByCurrentUser
    : null

  if (itemId === null || count === null || likedByCurrentUser === null) {
    return null
  }

  return {
    itemId,
    count,
    likedByCurrentUser,
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

async function mutateItemLike(
  itemId: string,
  method: 'PUT' | 'DELETE',
  signal?: AbortSignal,
): Promise<ItemLikeMutationResult> {
  const response = await apiRequest<unknown>(`/items/${itemId}/like`, {
    method,
    signal,
  })

  if (!response.ok) {
    const validationErrors = response.problem?.errors ?? {}
    const firstValidationError = pickFirstValidationError(validationErrors)

    return {
      ok: false,
      status: response.status,
      code: response.problem?.code ?? null,
      message: firstValidationError ?? response.error.message,
      validationErrors,
    }
  }

  const normalizedPayload = normalizeLikeState(response.data)
  if (normalizedPayload === null) {
    return {
      ok: false,
      status: response.status,
      code: null,
      message: `Received invalid response format from ${method} /items/{id}/like.`,
      validationErrors: {},
    }
  }

  return {
    ok: true,
    data: normalizedPayload,
  }
}

export async function setItemLike(itemId: string, signal?: AbortSignal): Promise<ItemLikeMutationResult> {
  return mutateItemLike(itemId, 'PUT', signal)
}

export async function removeItemLike(itemId: string, signal?: AbortSignal): Promise<ItemLikeMutationResult> {
  return mutateItemLike(itemId, 'DELETE', signal)
}