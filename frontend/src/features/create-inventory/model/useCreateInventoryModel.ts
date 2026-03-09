import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiFailure } from '../../../shared/api/httpClient.ts'
import { createInventory, type CreateInventoryRequestPayload } from './createInventoryApi.ts'

export const createInventoryContract = {
  maxTitleLength: 200,
  maxDescriptionLength: 10_000,
  maxImageUrlLength: 2_048,
  maxTagLength: 100,
} as const

export type CreateInventoryInput = {
  title: string
  categoryId: number
  descriptionMarkdown: string
  imageUrl: string | null
  isPublic: boolean
  tags: ReadonlyArray<string>
}

export type CreateInventorySubmitResult =
  | {
      ok: true
      inventoryId: string
      version: number
      etag: string | null
    }
  | {
      ok: false
      cancelled: boolean
      errorMessage: string | null
      fieldErrors: Record<string, string[]>
    }

function normalizeTags(tags: ReadonlyArray<string>): string[] {
  const uniqueTagsByLowerCase = new Set<string>()
  const normalizedTags: string[] = []

  for (const rawTag of tags) {
    const normalizedTag = rawTag.trim()
    if (normalizedTag.length === 0) {
      continue
    }

    const key = normalizedTag.toLocaleLowerCase()
    if (uniqueTagsByLowerCase.has(key)) {
      continue
    }

    uniqueTagsByLowerCase.add(key)
    normalizedTags.push(normalizedTag)
  }

  return normalizedTags
}

function toRequestPayload(input: CreateInventoryInput): CreateInventoryRequestPayload {
  const normalizedImageUrl = input.imageUrl === null
    ? null
    : input.imageUrl.trim().length > 0
      ? input.imageUrl.trim()
      : null

  return {
    title: input.title.trim(),
    categoryId: input.categoryId,
    descriptionMarkdown: input.descriptionMarkdown,
    imageUrl: normalizedImageUrl,
    isPublic: input.isPublic,
    tags: normalizeTags(input.tags),
  }
}

function getFirstValidationErrorMessage(failure: ApiFailure): string | null {
  const validationErrors = failure.problem?.errors ?? {}

  for (const messages of Object.values(validationErrors)) {
    if (messages.length > 0) {
      return messages[0]
    }
  }

  return null
}

function normalizeCreateInventoryFailureMessage(failure: ApiFailure): string {
  if (failure.status === 401) {
    return 'Sign in to create inventories.'
  }

  if (failure.status === 403) {
    return 'You do not have permission to create inventories.'
  }

  const validationMessage = getFirstValidationErrorMessage(failure)
  if (validationMessage !== null) {
    return validationMessage
  }

  return failure.error.message
}

function normalizeUnexpectedError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim()
  }

  return 'Failed to create inventory.'
}

export function useCreateInventoryModel() {
  const requestSequenceRef = useRef(0)
  const requestAbortControllerRef = useRef<AbortController | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      requestAbortControllerRef.current?.abort()
    }
  }, [])

  const resetSubmitError = useCallback(() => {
    setSubmitErrorMessage(null)
  }, [])

  const submit = useCallback(
    async (input: CreateInventoryInput): Promise<CreateInventorySubmitResult> => {
      requestSequenceRef.current += 1
      const requestId = requestSequenceRef.current

      requestAbortControllerRef.current?.abort()
      const abortController = new AbortController()
      requestAbortControllerRef.current = abortController

      setIsSubmitting(true)
      setSubmitErrorMessage(null)

      try {
        const result = await createInventory(toRequestPayload(input), abortController.signal)

        if (
          abortController.signal.aborted
          || requestId !== requestSequenceRef.current
        ) {
          return {
            ok: false,
            cancelled: true,
            errorMessage: null,
            fieldErrors: {},
          }
        }

        if (!result.ok) {
          const errorMessage = normalizeCreateInventoryFailureMessage(result)
          const fieldErrors = result.problem?.errors ?? {}

          setSubmitErrorMessage(errorMessage)
          return {
            ok: false,
            cancelled: false,
            errorMessage,
            fieldErrors,
          }
        }

        setSubmitErrorMessage(null)
        return {
          ok: true,
          inventoryId: result.data.id,
          version: result.data.version,
          etag: result.data.etag,
        }
      } catch (error) {
        if (
          abortController.signal.aborted
          || requestId !== requestSequenceRef.current
        ) {
          return {
            ok: false,
            cancelled: true,
            errorMessage: null,
            fieldErrors: {},
          }
        }

        const errorMessage = normalizeUnexpectedError(error)
        setSubmitErrorMessage(errorMessage)

        return {
          ok: false,
          cancelled: false,
          errorMessage,
          fieldErrors: {},
        }
      } finally {
        if (
          !abortController.signal.aborted
          && requestId === requestSequenceRef.current
        ) {
          setIsSubmitting(false)
        }
      }
    },
    [],
  )

  return {
    isSubmitting,
    submitErrorMessage,
    resetSubmitError,
    submit,
  }
}
