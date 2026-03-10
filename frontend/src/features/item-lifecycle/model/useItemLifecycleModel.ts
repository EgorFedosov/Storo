import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCurrentUser } from '../../auth/model/useCurrentUser.ts'
import {
  deleteItem,
  requestItemDetails,
  updateItem,
} from '../../../entities/item/model/itemLifecycleApi.ts'

import { removeItemLike, setItemLike } from '../../../entities/item/model/itemLikesApi.ts'
import type { ItemDetails, UpdateItemPayload } from '../../../entities/item/model/types.ts'
import {
  getConcurrencyProblem,
  normalizeETag,
  type ConcurrencyProblem,
} from '../../../shared/api/concurrency.ts'
import type { ApiFailure } from '../../../shared/api/httpClient.ts'
import { useVersionedMutationModel } from '../../../shared/ui/model/useVersionedMutationModel.ts'

type ValidationErrors = Record<string, string[]>

type ItemLifecycleStatus = 'idle' | 'loading' | 'ready' | 'error'

type ItemLifecycleState = {
  status: ItemLifecycleStatus
  item: ItemDetails | null
  etag: string | null
  errorMessage: string | null
  errorStatus: number | null
}

export type ItemLifecycleUpdateDraft = {
  customId: string
  fields: Record<string, unknown>
}

type ItemLifecycleUpdateResult = {
  ok: boolean
  fieldErrors: ValidationErrors
}

type ItemLifecycleDeleteResult = {
  ok: boolean
  redirectPath: string | null
}

export type ItemLifecycleModel = ItemLifecycleState & {
  isAuthenticated: boolean
  isBlocked: boolean
  isUpdating: boolean
  isDeleting: boolean
  isLikeUpdating: boolean
  updateErrorMessage: string | null
  updateFieldErrors: ValidationErrors
  deleteErrorMessage: string | null
  likeErrorMessage: string | null
  concurrencyProblem: ConcurrencyProblem | null
  canEdit: boolean
  canDelete: boolean
  canLike: boolean
  retryLoad: () => void
  reloadLatest: () => void
  clearMutationErrors: () => void
  clearConcurrencyProblem: () => void
  submitUpdate: (draft: ItemLifecycleUpdateDraft) => Promise<ItemLifecycleUpdateResult>
  submitDelete: () => Promise<ItemLifecycleDeleteResult>
  submitLike: (shouldLike: boolean) => Promise<boolean>
}

export const itemLifecycleContract = {
  maxCustomIdLength: 500,
  maxSingleLineLength: 1_000,
  maxMultiLineLength: 10_000,
  maxLinkLength: 2_048,
  maxNumberDecimals: 4,
  minNumberValue: -99_999_999_999_999.9999,
  maxNumberValue: 99_999_999_999_999.9999,
} as const

const itemIdPattern = /^[1-9]\d*$/

const initialState: ItemLifecycleState = {
  status: 'idle',
  item: null,
  etag: null,
  errorMessage: null,
  errorStatus: null,
}

function normalizeOptionalText(rawValue: unknown): string | null {
  if (typeof rawValue !== 'string') {
    return null
  }

  return rawValue.trim().length > 0 ? rawValue : null
}

function normalizeNumber(rawValue: unknown): number | null {
  if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
    return null
  }

  return rawValue
}

function countNumberDecimals(value: number): number {
  const normalizedValue = value.toString()
  const decimalSeparatorIndex = normalizedValue.indexOf('.')
  if (decimalSeparatorIndex < 0) {
    return 0
  }

  return normalizedValue.length - decimalSeparatorIndex - 1
}

function hasAnyErrors(errors: ValidationErrors): boolean {
  return Object.values(errors).some((messages) => messages.length > 0)
}

function firstError(errors: ValidationErrors): string | null {
  for (const messages of Object.values(errors)) {
    if (messages.length > 0) {
      return messages[0]
    }
  }

  return null
}

function normalizeLoadFailureMessage(status: number, message: string): string {
  if (status === 404) {
    return 'Item was not found.'
  }

  if (status === 400) {
    return message
  }

  if (status === 0) {
    return message.trim().length > 0
      ? message
      : 'Item request failed before reaching API.'
  }

  return message
}

function firstValidationFailureMessage(failure: ApiFailure): string | null {
  const validationErrors = failure.problem?.errors ?? {}
  for (const messages of Object.values(validationErrors)) {
    if (messages.length > 0) {
      return messages[0]
    }
  }

  return null
}

function toUpdateFailureMessage(failure: ApiFailure): string {
  if (failure.status === 401) {
    return 'Sign in to update items.'
  }

  if (failure.status === 403) {
    return 'You do not have permission to update this item.'
  }

  if (failure.status === 404) {
    return 'Item was not found.'
  }

  if (failure.problem?.code === 'duplicate_custom_id' || failure.status === 409) {
    return 'customId is already used in this inventory. Enter another value and retry.'
  }

  return firstValidationFailureMessage(failure) ?? failure.error.message
}

function toDeleteFailureMessage(failure: ApiFailure): string {
  if (failure.status === 401) {
    return 'Sign in to delete items.'
  }

  if (failure.status === 403) {
    return 'You do not have permission to delete this item.'
  }

  if (failure.status === 404) {
    return 'Item was not found or already deleted.'
  }

  return firstValidationFailureMessage(failure) ?? failure.error.message
}

function toLikeFailureMessage(failure: {
  status: number
  message: string
  validationErrors: ValidationErrors
}): string {
  if (failure.status === 401) {
    return 'Sign in to like items.'
  }

  if (failure.status === 403) {
    return 'You do not have permission to like this item.'
  }

  if (failure.status === 404) {
    return 'Item was not found.'
  }

  if (failure.status === 400) {
    const firstValidationMessage = firstError(failure.validationErrors)
    if (firstValidationMessage !== null) {
      return firstValidationMessage
    }
  }

  if (failure.status === 0) {
    return failure.message.trim().length > 0
      ? failure.message
      : 'Like request failed before reaching API.'
  }

  return failure.message
}

function validateDraft(
  draft: ItemLifecycleUpdateDraft,
  item: ItemDetails,
): ValidationErrors {
  const errors: ValidationErrors = {}

  const normalizedCustomId = draft.customId.trim()
  if (normalizedCustomId.length === 0) {
    errors.customId = ['customId is required.']
  } else if (normalizedCustomId.length > itemLifecycleContract.maxCustomIdLength) {
    errors.customId = [`customId must be ${String(itemLifecycleContract.maxCustomIdLength)} characters or less.`]
  }

  for (const field of item.fields) {
    const rawValue = draft.fields[field.fieldId]
    const fieldKey = `fields.${field.fieldId}`

    if (field.fieldType === 'bool') {
      if (rawValue !== undefined && typeof rawValue !== 'boolean') {
        errors[fieldKey] = ['Boolean value must be true or false.']
      }
      continue
    }

    if (field.fieldType === 'number') {
      if (rawValue === null || rawValue === undefined || rawValue === '') {
        continue
      }

      if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
        errors[fieldKey] = ['Number value must be numeric.']
        continue
      }

      if (countNumberDecimals(rawValue) > itemLifecycleContract.maxNumberDecimals) {
        errors[fieldKey] = [
          `Number value must have at most ${String(itemLifecycleContract.maxNumberDecimals)} decimal places.`,
        ]
        continue
      }

      if (rawValue < itemLifecycleContract.minNumberValue || rawValue > itemLifecycleContract.maxNumberValue) {
        errors[fieldKey] = ['Number value is out of supported range.']
      }
      continue
    }

    if (rawValue === null || rawValue === undefined || rawValue === '') {
      continue
    }

    if (typeof rawValue !== 'string') {
      errors[fieldKey] = ['Text value must be a string.']
      continue
    }

    if (field.fieldType === 'single_line' && rawValue.length > itemLifecycleContract.maxSingleLineLength) {
      errors[fieldKey] = [
        `Single-line value must be ${String(itemLifecycleContract.maxSingleLineLength)} characters or less.`,
      ]
      continue
    }

    if (field.fieldType === 'multi_line' && rawValue.length > itemLifecycleContract.maxMultiLineLength) {
      errors[fieldKey] = [
        `Multi-line value must be ${String(itemLifecycleContract.maxMultiLineLength)} characters or less.`,
      ]
      continue
    }

    if (field.fieldType === 'link' && rawValue.length > itemLifecycleContract.maxLinkLength) {
      errors[fieldKey] = [`Link value must be ${String(itemLifecycleContract.maxLinkLength)} characters or less.`]
    }
  }

  return errors
}

function toRequestFieldValue(fieldType: ItemDetails['fields'][number]['fieldType'], rawValue: unknown) {
  if (fieldType === 'bool') {
    return typeof rawValue === 'boolean' ? rawValue : false
  }

  if (fieldType === 'number') {
    return normalizeNumber(rawValue)
  }

  return normalizeOptionalText(rawValue)
}

function toRequestPayload(item: ItemDetails, draft: ItemLifecycleUpdateDraft): UpdateItemPayload {
  return {
    customId: draft.customId.trim(),
    fields: item.fields.map((field) => ({
      fieldId: field.fieldId,
      value: toRequestFieldValue(field.fieldType, draft.fields[field.fieldId]),
    })),
  }
}

function normalizeServerFieldErrors(failure: ApiFailure): ValidationErrors {
  const fieldErrors: ValidationErrors = {
    ...(failure.problem?.errors ?? {}),
  }

  if ((failure.problem?.code === 'duplicate_custom_id' || failure.status === 409) && fieldErrors.customId === undefined) {
    fieldErrors.customId = ['customId is already used in this inventory.']
  }

  return fieldErrors
}

export function useItemLifecycleModel(itemId: string | null): ItemLifecycleModel {
  const { isAuthenticated, currentUser } = useCurrentUser()
  const [state, setState] = useState<ItemLifecycleState>(initialState)
  const [reloadToken, setReloadToken] = useState(0)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isLikeUpdating, setIsLikeUpdating] = useState(false)
  const [updateErrorMessage, setUpdateErrorMessage] = useState<string | null>(null)
  const [updateFieldErrors, setUpdateFieldErrors] = useState<ValidationErrors>({})
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null)
  const [likeErrorMessage, setLikeErrorMessage] = useState<string | null>(null)

  const requestSequenceRef = useRef(0)
  const requestAbortControllerRef = useRef<AbortController | null>(null)
  const likeRequestSequenceRef = useRef(0)
  const likeAbortControllerRef = useRef<AbortController | null>(null)

  const {
    concurrencyProblem,
    clearConcurrencyProblem,
    executeVersionedMutation,
    resetVersionStamp,
    setVersionStamp,
    versionStamp,
  } = useVersionedMutationModel()

  const clearMutationErrors = useCallback(() => {
    setUpdateErrorMessage(null)
    setUpdateFieldErrors({})
    setDeleteErrorMessage(null)
    setLikeErrorMessage(null)
  }, [])

  const retryLoad = useCallback(() => {
    setReloadToken((currentValue) => currentValue + 1)
  }, [])

  useEffect(
    () => () => {
      requestAbortControllerRef.current?.abort()
      likeAbortControllerRef.current?.abort()
    },
    [],
  )

  useEffect(() => {
    requestAbortControllerRef.current?.abort()
    likeAbortControllerRef.current?.abort()
    setIsLikeUpdating(false)
    setLikeErrorMessage(null)

    if (itemId === null || !itemIdPattern.test(itemId)) {
      return
    }

    requestSequenceRef.current += 1
    const requestId = requestSequenceRef.current
    const abortController = new AbortController()
    requestAbortControllerRef.current = abortController

    void (async () => {
      setState((currentState) => ({
        ...currentState,
        status: 'loading',
        errorMessage: null,
        errorStatus: null,
      }))
      clearMutationErrors()
      clearConcurrencyProblem()
      resetVersionStamp()

      const response = await requestItemDetails(itemId, abortController.signal)

      if (abortController.signal.aborted || requestId !== requestSequenceRef.current) {
        return
      }

      if (!response.ok) {
        setState({
          status: 'error',
          item: null,
          etag: null,
          errorMessage: normalizeLoadFailureMessage(response.status, response.message),
          errorStatus: response.status,
        })
        return
      }

      setVersionStamp(response.versionStamp)
      setState({
        status: 'ready',
        item: response.data,
        etag: response.etag,
        errorMessage: null,
        errorStatus: null,
      })
    })()

    return () => {
      abortController.abort()
    }
  }, [
    clearConcurrencyProblem,
    clearMutationErrors,
    itemId,
    reloadToken,
    resetVersionStamp,
    setVersionStamp,
  ])

  const submitUpdate = useCallback(
    async (draft: ItemLifecycleUpdateDraft): Promise<ItemLifecycleUpdateResult> => {
      if (state.item === null) {
        return { ok: false, fieldErrors: {} }
      }

      setIsUpdating(true)
      setUpdateErrorMessage(null)
      setUpdateFieldErrors({})
      setDeleteErrorMessage(null)
      clearConcurrencyProblem()

      try {
        const clientErrors = validateDraft(draft, state.item)
        if (hasAnyErrors(clientErrors)) {
          setUpdateFieldErrors(clientErrors)
          setUpdateErrorMessage(firstError(clientErrors))
          return {
            ok: false,
            fieldErrors: clientErrors,
          }
        }

        const result = await executeVersionedMutation((options) => (
          updateItem(state.item!.id, toRequestPayload(state.item!, draft), options)
        ))

        if (result === null) {
          if (versionStamp !== null) {
            setUpdateErrorMessage('Another mutation is already in progress. Retry after it completes.')
          }

          return {
            ok: false,
            fieldErrors: {},
          }
        }

        if (!result.ok) {
          const fieldErrors = normalizeServerFieldErrors(result)
          setUpdateFieldErrors(fieldErrors)

          if (getConcurrencyProblem(result) === null) {
            setUpdateErrorMessage(toUpdateFailureMessage(result))
          }

          return {
            ok: false,
            fieldErrors,
          }
        }

        setState((currentState) => ({
          ...currentState,
          status: 'ready',
          item: result.data,
          etag: normalizeETag(result.meta.etag) ?? `"${String(result.data.version)}"`,
          errorMessage: null,
          errorStatus: null,
        }))
        setUpdateErrorMessage(null)
        setUpdateFieldErrors({})

        return {
          ok: true,
          fieldErrors: {},
        }
      } finally {
        setIsUpdating(false)
      }
    },
    [clearConcurrencyProblem, executeVersionedMutation, state.item, versionStamp],
  )

  const submitDelete = useCallback(async (): Promise<ItemLifecycleDeleteResult> => {
    if (state.item === null) {
      return {
        ok: false,
        redirectPath: null,
      }
    }

    setIsDeleting(true)
    setDeleteErrorMessage(null)
    setUpdateErrorMessage(null)
    setUpdateFieldErrors({})
    clearConcurrencyProblem()

    try {
      const result = await executeVersionedMutation((options) => (
        deleteItem(state.item!.id, options)
      ))

      if (result === null) {
        if (versionStamp !== null) {
          setDeleteErrorMessage('Another mutation is already in progress. Retry after it completes.')
        }

        return {
          ok: false,
          redirectPath: null,
        }
      }

      if (!result.ok) {
        if (getConcurrencyProblem(result) === null) {
          setDeleteErrorMessage(toDeleteFailureMessage(result))
        }

        return {
          ok: false,
          redirectPath: null,
        }
      }

      return {
        ok: true,
        redirectPath: `/inventories/${state.item.inventory.id}`,
      }
    } finally {
      setIsDeleting(false)
    }
  }, [clearConcurrencyProblem, executeVersionedMutation, state.item, versionStamp])

  const submitLike = useCallback(async (shouldLike: boolean): Promise<boolean> => {
    if (state.item === null) {
      return false
    }

    if (!isAuthenticated) {
      setLikeErrorMessage('Sign in to like items.')
      return false
    }

    if (currentUser.isBlocked) {
      setLikeErrorMessage('Blocked users cannot like items.')
      return false
    }

    if (!state.item.permissions.canLike) {
      setLikeErrorMessage('You do not have permission to like this item.')
      return false
    }

    if (isLikeUpdating || state.item.like.likedByCurrentUser === shouldLike) {
      return true
    }

    likeRequestSequenceRef.current += 1
    const requestId = likeRequestSequenceRef.current

    likeAbortControllerRef.current?.abort()
    const abortController = new AbortController()
    likeAbortControllerRef.current = abortController

    setIsLikeUpdating(true)
    setLikeErrorMessage(null)

    try {
      const response = shouldLike
        ? await setItemLike(state.item.id, abortController.signal)
        : await removeItemLike(state.item.id, abortController.signal)

      if (abortController.signal.aborted || requestId !== likeRequestSequenceRef.current) {
        return false
      }

      if (!response.ok) {
        setLikeErrorMessage(toLikeFailureMessage(response))
        return false
      }

      setState((currentState) => {
        if (currentState.item === null || currentState.item.id !== response.data.itemId) {
          return currentState
        }

        return {
          ...currentState,
          item: {
            ...currentState.item,
            like: {
              count: response.data.count,
              likedByCurrentUser: response.data.likedByCurrentUser,
            },
          },
        }
      })

      return true
    } finally {
      if (!abortController.signal.aborted && requestId === likeRequestSequenceRef.current) {
        setIsLikeUpdating(false)
      }
    }
  }, [currentUser.isBlocked, isAuthenticated, isLikeUpdating, state.item])

  return useMemo(
    () => {
      if (itemId === null || !itemIdPattern.test(itemId)) {
        return {
          ...initialState,
          status: 'error',
          errorMessage: 'Item URL must contain a positive numeric id.',
          errorStatus: null,
          isAuthenticated,
          isBlocked: currentUser.isBlocked,
          isUpdating: false,
          isDeleting: false,
          isLikeUpdating: false,
          updateErrorMessage: null,
          updateFieldErrors: {},
          deleteErrorMessage: null,
          likeErrorMessage: null,
          concurrencyProblem: null,
          canEdit: false,
          canDelete: false,
          canLike: false,
          retryLoad,
          reloadLatest: retryLoad,
          clearMutationErrors,
          clearConcurrencyProblem,
          submitUpdate,
          submitDelete,
          submitLike,
        } satisfies ItemLifecycleModel
      }

      return {
        ...state,
        isAuthenticated,
        isBlocked: currentUser.isBlocked,
        isUpdating,
        isDeleting,
        isLikeUpdating,
        updateErrorMessage,
        updateFieldErrors,
        deleteErrorMessage,
        likeErrorMessage,
        concurrencyProblem,
        canEdit: state.item?.permissions.canEdit ?? false,
        canDelete: state.item?.permissions.canDelete ?? false,
        canLike: state.item?.permissions.canLike ?? false,
        retryLoad,
        reloadLatest: retryLoad,
        clearMutationErrors,
        clearConcurrencyProblem,
        submitUpdate,
        submitDelete,
        submitLike,
      } satisfies ItemLifecycleModel
    },
    [
      clearConcurrencyProblem,
      clearMutationErrors,
      concurrencyProblem,
      currentUser.isBlocked,
      deleteErrorMessage,
      isAuthenticated,
      isDeleting,
      isLikeUpdating,
      isUpdating,
      itemId,
      likeErrorMessage,
      retryLoad,
      state,
      submitDelete,
      submitLike,
      submitUpdate,
      updateErrorMessage,
      updateFieldErrors,
    ],
  )
}






