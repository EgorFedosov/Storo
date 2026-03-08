import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { apiRequest } from '../../../shared/api/httpClient.ts'
import type { TagReference } from './types.ts'

export const tagAutocompleteContract = {
  minPrefixLength: 2,
  maxPrefixLength: 100,
  debounceMs: 260,
} as const

export type TagAutocompleteStatus = 'idle' | 'loading' | 'ready' | 'error'

type TagAutocompleteState = {
  status: TagAutocompleteStatus
  items: readonly TagReference[]
  errorMessage: string | null
}

type TagAutocompleteAction =
  | { type: 'request_reset' }
  | { type: 'request_started' }
  | { type: 'request_succeeded'; payload: { items: readonly TagReference[] } }
  | { type: 'request_failed'; payload: { errorMessage: string } }

type TagAutocompleteModel = TagAutocompleteState & {
  requestSuggestions: (prefix: string) => void
  resetSuggestions: () => void
}

const initialTagAutocompleteState: TagAutocompleteState = {
  status: 'idle',
  items: [],
  errorMessage: null,
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

function normalizeAutocompletePayload(payload: unknown): TagReference[] | null {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    return null
  }

  const normalizedItems: TagReference[] = []
  const seenIds = new Set<string>()

  for (const rawItem of payload.items) {
    if (!isRecord(rawItem)) {
      return null
    }

    const id = normalizeNonEmptyString(rawItem.id)
    const name = normalizeNonEmptyString(rawItem.name)

    if (id === null || name === null || seenIds.has(id)) {
      return null
    }

    seenIds.add(id)
    normalizedItems.push({
      id,
      name,
    })
  }

  return normalizedItems
}

function normalizePrefix(rawPrefix: string): string {
  return rawPrefix.trim()
}

function normalizeUnexpectedError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim()
  }

  return 'Failed to load tag suggestions.'
}

function tagAutocompleteStateReducer(
  state: TagAutocompleteState,
  action: TagAutocompleteAction,
): TagAutocompleteState {
  switch (action.type) {
    case 'request_reset':
      return {
        status: 'idle',
        items: [],
        errorMessage: null,
      }
    case 'request_started':
      return {
        ...state,
        status: 'loading',
        errorMessage: null,
      }
    case 'request_succeeded':
      return {
        status: 'ready',
        items: action.payload.items,
        errorMessage: null,
      }
    case 'request_failed':
      return {
        ...state,
        status: 'error',
        errorMessage: action.payload.errorMessage,
      }
    default:
      return state
  }
}

export function useTagAutocompleteModel(): TagAutocompleteModel {
  const [state, dispatch] = useReducer(tagAutocompleteStateReducer, initialTagAutocompleteState)
  const requestSequenceRef = useRef(0)
  const requestAbortControllerRef = useRef<AbortController | null>(null)

  const resetSuggestions = useCallback(() => {
    requestAbortControllerRef.current?.abort()
    dispatch({ type: 'request_reset' })
  }, [])

  const requestSuggestions = useCallback((rawPrefix: string) => {
    const prefix = normalizePrefix(rawPrefix)

    if (prefix.length < tagAutocompleteContract.minPrefixLength) {
      resetSuggestions()
      return
    }

    if (prefix.length > tagAutocompleteContract.maxPrefixLength) {
      requestAbortControllerRef.current?.abort()
      dispatch({
        type: 'request_failed',
        payload: {
          errorMessage: `Tag prefix must be ${String(tagAutocompleteContract.maxPrefixLength)} characters or less.`,
        },
      })
      return
    }

    requestSequenceRef.current += 1
    const requestId = requestSequenceRef.current

    requestAbortControllerRef.current?.abort()
    const abortController = new AbortController()
    requestAbortControllerRef.current = abortController

    dispatch({ type: 'request_started' })

    void (async () => {
      try {
        const response = await apiRequest<unknown>('/tags/autocomplete', {
          query: {
            prefix,
          },
          signal: abortController.signal,
        })

        if (abortController.signal.aborted || requestId !== requestSequenceRef.current) {
          return
        }

        if (!response.ok) {
          dispatch({
            type: 'request_failed',
            payload: { errorMessage: response.error.message },
          })
          return
        }

        const normalizedPayload = normalizeAutocompletePayload(response.data)
        if (normalizedPayload === null) {
          dispatch({
            type: 'request_failed',
            payload: {
              errorMessage: 'Received invalid response format from /tags/autocomplete.',
            },
          })
          return
        }

        dispatch({
          type: 'request_succeeded',
          payload: { items: normalizedPayload },
        })
      } catch (error) {
        if (abortController.signal.aborted || requestId !== requestSequenceRef.current) {
          return
        }

        dispatch({
          type: 'request_failed',
          payload: { errorMessage: normalizeUnexpectedError(error) },
        })
      }
    })()
  }, [resetSuggestions])

  useEffect(() => () => requestAbortControllerRef.current?.abort(), [])

  return useMemo(
    () => ({
      ...state,
      requestSuggestions,
      resetSuggestions,
    }),
    [requestSuggestions, resetSuggestions, state],
  )
}

