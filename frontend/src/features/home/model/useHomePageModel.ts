import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { apiRequest } from '../../../shared/api/httpClient.ts'
import type {
  HomeInventoryCreator,
  HomeInventorySummary,
  HomePageData,
  HomePageModelState,
  HomeTagCloudItem,
} from './types.ts'

type HomePageStateAction =
  | { type: 'load_started' }
  | { type: 'load_succeeded'; payload: HomePageData }
  | { type: 'load_failed'; payload: { errorMessage: string } }

type HomePageModel = HomePageModelState & {
  retryLoad: () => void
}

const emptyHomePageData: HomePageData = {
  latestInventories: [],
  topPopularInventories: [],
  tagCloud: [],
}

const initialHomePageState: HomePageModelState = {
  status: 'loading',
  data: emptyHomePageData,
  errorMessage: null,
}

function homePageStateReducer(
  state: HomePageModelState,
  action: HomePageStateAction,
): HomePageModelState {
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
        data: action.payload,
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

function normalizeString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function normalizeOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value !== 'string') {
    return null
  }

  const normalizedValue = value.trim()
  return normalizedValue.length > 0 ? normalizedValue : null
}

function normalizeNonNegativeInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return value
  }

  if (typeof value !== 'string') {
    return null
  }

  const normalizedValue = value.trim()
  if (!/^\d+$/.test(normalizedValue)) {
    return null
  }

  const parsedValue = Number(normalizedValue)
  if (!Number.isSafeInteger(parsedValue) || parsedValue < 0) {
    return null
  }

  return parsedValue
}

function normalizeUtcIsoDate(value: unknown): string | null {
  const normalizedValue = normalizeNonEmptyString(value)
  if (normalizedValue === null) {
    return null
  }

  return Number.isNaN(Date.parse(normalizedValue)) ? null : normalizedValue
}

function normalizeInventoryCreatorPayload(payload: unknown): HomeInventoryCreator | null {
  if (!isRecord(payload)) {
    return null
  }

  const id = normalizeNonEmptyString(payload.id)
  const userName = normalizeNonEmptyString(payload.userName)
  const displayName = normalizeNonEmptyString(payload.displayName)

  if (id === null || userName === null || displayName === null) {
    return null
  }

  return {
    id,
    userName,
    displayName,
  }
}

function normalizeInventorySummaryPayload(payload: unknown): HomeInventorySummary | null {
  if (!isRecord(payload)) {
    return null
  }

  const id = normalizeNonEmptyString(payload.id)
  const title = normalizeNonEmptyString(payload.title)
  const descriptionMarkdown = normalizeString(payload.descriptionMarkdown)
  const imageUrl = normalizeOptionalString(payload.imageUrl)
  const itemsCount = normalizeNonNegativeInteger(payload.itemsCount)
  const createdAt = normalizeUtcIsoDate(payload.createdAt)
  const updatedAt = normalizeUtcIsoDate(payload.updatedAt)
  const creator = normalizeInventoryCreatorPayload(payload.creator)

  if (
    id === null
    || title === null
    || descriptionMarkdown === null
    || itemsCount === null
    || createdAt === null
    || updatedAt === null
    || creator === null
  ) {
    return null
  }

  return {
    id,
    title,
    descriptionMarkdown,
    imageUrl,
    itemsCount,
    createdAt,
    updatedAt,
    creator,
  }
}

function normalizeInventoryListPayload(payload: unknown): HomeInventorySummary[] | null {
  if (!Array.isArray(payload)) {
    return null
  }

  const normalizedInventories: HomeInventorySummary[] = []
  const seenIds = new Set<string>()

  for (const item of payload) {
    const normalizedItem = normalizeInventorySummaryPayload(item)
    if (normalizedItem === null || seenIds.has(normalizedItem.id)) {
      return null
    }

    seenIds.add(normalizedItem.id)
    normalizedInventories.push(normalizedItem)
  }

  return normalizedInventories
}

function normalizeTagCloudItemPayload(payload: unknown): HomeTagCloudItem | null {
  if (!isRecord(payload)) {
    return null
  }

  const id = normalizeNonEmptyString(payload.id)
  const name = normalizeNonEmptyString(payload.name)
  const count = normalizeNonNegativeInteger(payload.count)

  if (id === null || name === null || count === null) {
    return null
  }

  return {
    id,
    name,
    count,
  }
}

function normalizeTagCloudPayload(payload: unknown): HomeTagCloudItem[] | null {
  if (!Array.isArray(payload)) {
    return null
  }

  const normalizedTagCloud: HomeTagCloudItem[] = []
  const seenIds = new Set<string>()

  for (const item of payload) {
    const normalizedItem = normalizeTagCloudItemPayload(item)
    if (normalizedItem === null || seenIds.has(normalizedItem.id)) {
      return null
    }

    seenIds.add(normalizedItem.id)
    normalizedTagCloud.push(normalizedItem)
  }

  return normalizedTagCloud
}

function normalizeHomePagePayload(payload: unknown): HomePageData | null {
  if (!isRecord(payload)) {
    return null
  }

  const latestInventories = normalizeInventoryListPayload(payload.latestInventories)
  const topPopularInventories = normalizeInventoryListPayload(payload.topPopularInventories)
  const tagCloud = normalizeTagCloudPayload(payload.tagCloud)

  if (latestInventories === null || topPopularInventories === null || tagCloud === null) {
    return null
  }

  return {
    latestInventories,
    topPopularInventories,
    tagCloud,
  }
}

function normalizeHomePageFailure(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim()
  }

  return 'Failed to load home page data.'
}

export function useHomePageModel(): HomePageModel {
  const [state, dispatch] = useReducer(homePageStateReducer, initialHomePageState)
  const requestSequenceRef = useRef(0)
  const requestAbortControllerRef = useRef<AbortController | null>(null)

  const loadHomePageData = useCallback(() => {
    requestSequenceRef.current += 1
    const requestId = requestSequenceRef.current

    requestAbortControllerRef.current?.abort()
    const abortController = new AbortController()
    requestAbortControllerRef.current = abortController

    dispatch({ type: 'load_started' })

    void (async () => {
      try {
        const response = await apiRequest<unknown>('/home', {
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

        const normalizedPayload = normalizeHomePagePayload(response.data)
        if (normalizedPayload === null) {
          dispatch({
            type: 'load_failed',
            payload: { errorMessage: 'Received invalid response format from /home.' },
          })
          return
        }

        dispatch({
          type: 'load_succeeded',
          payload: normalizedPayload,
        })
      } catch (error) {
        if (abortController.signal.aborted || requestId !== requestSequenceRef.current) {
          return
        }

        dispatch({
          type: 'load_failed',
          payload: { errorMessage: normalizeHomePageFailure(error) },
        })
      }
    })()
  }, [])

  useEffect(() => {
    loadHomePageData()

    return () => {
      requestAbortControllerRef.current?.abort()
    }
  }, [loadHomePageData])

  return useMemo(
    () => ({
      ...state,
      retryLoad: loadHomePageData,
    }),
    [state, loadHomePageData],
  )
}
