import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { apiRequest } from '../../../shared/api/httpClient.ts'
import type { TagCloudEntry } from './types.ts'

export type TagCloudStatus = 'loading' | 'ready' | 'error'

type TagCloudState = {
  status: TagCloudStatus
  items: readonly TagCloudEntry[]
  errorMessage: string | null
}

type TagCloudAction =
  | { type: 'load_started' }
  | { type: 'load_succeeded'; payload: { items: readonly TagCloudEntry[] } }
  | { type: 'load_failed'; payload: { errorMessage: string } }

type TagCloudModel = TagCloudState & {
  reload: () => void
}

const initialTagCloudState: TagCloudState = {
  status: 'loading',
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

function normalizeCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : null
}

function normalizeTagCloudPayload(payload: unknown): TagCloudEntry[] | null {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    return null
  }

  const normalizedItems: TagCloudEntry[] = []
  const seenIds = new Set<string>()

  for (const rawItem of payload.items) {
    if (!isRecord(rawItem)) {
      return null
    }

    const id = normalizeNonEmptyString(rawItem.id)
    const name = normalizeNonEmptyString(rawItem.name)
    const count = normalizeCount(rawItem.count)

    if (id === null || name === null || count === null || seenIds.has(id)) {
      return null
    }

    seenIds.add(id)
    normalizedItems.push({
      id,
      name,
      count,
    })
  }

  return normalizedItems
}

function tagCloudStateReducer(state: TagCloudState, action: TagCloudAction): TagCloudState {
  switch (action.type) {
    case 'load_started':
      return {
        ...state,
        status: 'loading',
        errorMessage: null,
      }
    case 'load_succeeded':
      return {
        status: 'ready',
        items: action.payload.items,
        errorMessage: null,
      }
    case 'load_failed':
      return {
        ...state,
        status: 'error',
        errorMessage: action.payload.errorMessage,
      }
    default:
      return state
  }
}

function normalizeUnexpectedError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim()
  }

  return 'Failed to load tag cloud.'
}

export function useTagCloudModel(): TagCloudModel {
  const [state, dispatch] = useReducer(tagCloudStateReducer, initialTagCloudState)
  const requestSequenceRef = useRef(0)
  const requestAbortControllerRef = useRef<AbortController | null>(null)

  const loadTagCloud = useCallback(() => {
    requestSequenceRef.current += 1
    const requestId = requestSequenceRef.current

    requestAbortControllerRef.current?.abort()
    const abortController = new AbortController()
    requestAbortControllerRef.current = abortController

    dispatch({ type: 'load_started' })

    void (async () => {
      try {
        const response = await apiRequest<unknown>('/tags/cloud', {
          signal: abortController.signal,
        })

        if (abortController.signal.aborted || requestId !== requestSequenceRef.current) {
          return
        }

        if (!response.ok) {
          dispatch({
            type: 'load_failed',
            payload: { errorMessage: response.error.message },
          })
          return
        }

        const normalizedPayload = normalizeTagCloudPayload(response.data)
        if (normalizedPayload === null) {
          dispatch({
            type: 'load_failed',
            payload: { errorMessage: 'Received invalid response format from /tags/cloud.' },
          })
          return
        }

        dispatch({
          type: 'load_succeeded',
          payload: { items: normalizedPayload },
        })
      } catch (error) {
        if (abortController.signal.aborted || requestId !== requestSequenceRef.current) {
          return
        }

        dispatch({
          type: 'load_failed',
          payload: { errorMessage: normalizeUnexpectedError(error) },
        })
      }
    })()
  }, [])

  useEffect(() => {
    loadTagCloud()

    return () => {
      requestAbortControllerRef.current?.abort()
    }
  }, [loadTagCloud])

  return useMemo(
    () => ({
      ...state,
      reload: loadTagCloud,
    }),
    [loadTagCloud, state],
  )
}

