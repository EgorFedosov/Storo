import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  requestSearchInventories,
  type SearchInventoriesResponse,
  type SearchInventoriesSortField,
  type SearchSortDirection,
} from '../api/searchInventoriesApi.ts'

type SearchInventoriesRouteErrors = Partial<Record<'q' | 'tag' | 'page' | 'pageSize' | 'sort', string>>

export type SearchInventoriesRouteState = {
  q: string | null
  tag: string | null
  page: number
  pageSize: number
  sort: string | null
  errors: SearchInventoriesRouteErrors
}

export const inventorySearchContract = {
  maxQueryLength: 500,
  maxTagLength: 100,
} as const

export type InventorySearchSortValue =
  | 'relevance:desc'
  | 'relevance:asc'
  | 'updatedAt:desc'
  | 'updatedAt:asc'
  | 'createdAt:desc'
  | 'createdAt:asc'
  | 'title:asc'
  | 'title:desc'

type InventorySearchSortOption = {
  value: InventorySearchSortValue
  label: string
}

type NormalizedRouteSort = {
  value: InventorySearchSortValue
  routeSort: string | null
  errorMessage: string | null
}

type UseSearchInventoriesModelResult = {
  data: SearchInventoriesResponse | null
  isLoading: boolean
  canRequest: boolean
  errorMessage: string | null
  apiValidationMessages: string[]
  routeValidationMessages: string[]
  normalizedSort: NormalizedRouteSort
  retry: () => void
}

export const defaultInventorySearchSort: InventorySearchSortValue = 'relevance:desc'

const inventorySearchSortLookup = new Set<InventorySearchSortValue>([
  'relevance:desc',
  'relevance:asc',
  'updatedAt:desc',
  'updatedAt:asc',
  'createdAt:desc',
  'createdAt:asc',
  'title:asc',
  'title:desc',
])

export const inventorySearchSortOptions: ReadonlyArray<InventorySearchSortOption> = [
  { value: 'relevance:desc', label: 'Relevance (best match)' },
  { value: 'relevance:asc', label: 'Relevance (lowest first)' },
  { value: 'updatedAt:desc', label: 'Updated (newest first)' },
  { value: 'updatedAt:asc', label: 'Updated (oldest first)' },
  { value: 'createdAt:desc', label: 'Created (newest first)' },
  { value: 'createdAt:asc', label: 'Created (oldest first)' },
  { value: 'title:asc', label: 'Title (A to Z)' },
  { value: 'title:desc', label: 'Title (Z to A)' },
]

function normalizeOptionalSearchInput(rawValue: string, maxLength: number): string | null {
  const normalizedValue = rawValue.trim()
  if (normalizedValue.length === 0 || normalizedValue.length > maxLength) {
    return null
  }

  return normalizedValue
}

function normalizeSortField(rawValue: string): SearchInventoriesSortField | null {
  if (rawValue === 'relevance') {
    return 'relevance'
  }

  if (rawValue === 'updatedat') {
    return 'updatedAt'
  }

  if (rawValue === 'createdat') {
    return 'createdAt'
  }

  if (rawValue === 'title') {
    return 'title'
  }

  return null
}

function normalizeSortDirection(rawValue: string): SearchSortDirection | null {
  if (rawValue === 'asc' || rawValue === 'desc') {
    return rawValue
  }

  return null
}

function normalizeRouteSortValue(sort: string | null): NormalizedRouteSort {
  if (sort === null || sort.trim().length === 0) {
    return {
      value: defaultInventorySearchSort,
      routeSort: null,
      errorMessage: null,
    }
  }

  const [fieldToken, directionTokenRaw] = sort.trim().split(':', 2)
  const field = normalizeSortField(fieldToken.trim().toLowerCase())
  const direction = normalizeSortDirection((directionTokenRaw ?? 'desc').trim().toLowerCase())
  if (field === null || direction === null) {
    return {
      value: defaultInventorySearchSort,
      routeSort: null,
      errorMessage:
        'sort must be one of: relevance[:asc|desc], updatedAt[:asc|desc], createdAt[:asc|desc], title[:asc|desc].',
    }
  }

  const canonicalSort = `${field}:${direction}` as InventorySearchSortValue
  if (!inventorySearchSortLookup.has(canonicalSort)) {
    return {
      value: defaultInventorySearchSort,
      routeSort: null,
      errorMessage:
        'sort must be one of: relevance[:asc|desc], updatedAt[:asc|desc], createdAt[:asc|desc], title[:asc|desc].',
    }
  }

  return {
    value: canonicalSort,
    routeSort: canonicalSort === defaultInventorySearchSort ? null : canonicalSort,
    errorMessage: null,
  }
}

function collectRouteValidationMessages(
  routeErrors: SearchInventoriesRouteErrors,
  sortErrorMessage: string | null,
): string[] {
  const messages: string[] = []

  for (const message of Object.values(routeErrors)) {
    if (typeof message === 'string' && message.trim().length > 0) {
      messages.push(message.trim())
    }
  }

  if (sortErrorMessage !== null) {
    messages.push(sortErrorMessage)
  }

  return Array.from(new Set(messages))
}

function flattenValidationErrors(validationErrors: Record<string, string[]>): string[] {
  const messages: string[] = []

  for (const fieldErrors of Object.values(validationErrors)) {
    for (const message of fieldErrors) {
      const normalizedMessage = message.trim()
      if (normalizedMessage.length > 0) {
        messages.push(normalizedMessage)
      }
    }
  }

  return Array.from(new Set(messages))
}

export function normalizeInventorySearchQueryInput(rawValue: string): string | null {
  return normalizeOptionalSearchInput(rawValue, inventorySearchContract.maxQueryLength)
}

export function normalizeInventorySearchTagInput(rawValue: string): string | null {
  return normalizeOptionalSearchInput(rawValue, inventorySearchContract.maxTagLength)
}

export function toRouteSortParam(sortValue: InventorySearchSortValue): string | null {
  return sortValue === defaultInventorySearchSort ? null : sortValue
}

export function useSearchInventoriesModel(routeState: SearchInventoriesRouteState): UseSearchInventoriesModelResult {
  const [data, setData] = useState<SearchInventoriesResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [apiValidationMessages, setApiValidationMessages] = useState<string[]>([])
  const [reloadToken, setReloadToken] = useState(0)

  const requestSequenceRef = useRef(0)
  const requestAbortControllerRef = useRef<AbortController | null>(null)

  const normalizedSort = useMemo(
    () => normalizeRouteSortValue(routeState.sort),
    [routeState.sort],
  )

  const routeValidationMessages = useMemo(
    () => collectRouteValidationMessages(routeState.errors, normalizedSort.errorMessage),
    [routeState.errors, normalizedSort.errorMessage],
  )

  const canRequest = routeState.q !== null || routeState.tag !== null

  const retry = useCallback(() => {
    setReloadToken((currentValue) => currentValue + 1)
  }, [])

  useEffect(() => {
    requestAbortControllerRef.current?.abort()

    if (!canRequest) {
      setData(null)
      setIsLoading(false)
      setErrorMessage(null)
      setApiValidationMessages([])
      return
    }

    requestSequenceRef.current += 1
    const requestId = requestSequenceRef.current

    const abortController = new AbortController()
    requestAbortControllerRef.current = abortController

    setIsLoading(true)
    setErrorMessage(null)
    setApiValidationMessages([])

    void (async () => {
      const response = await requestSearchInventories(
        {
          q: routeState.q,
          tag: routeState.tag,
          page: routeState.page,
          pageSize: routeState.pageSize,
          sort: normalizedSort.value,
        },
        abortController.signal,
      )

      if (abortController.signal.aborted || requestId !== requestSequenceRef.current) {
        return
      }

      if (!response.ok) {
        setData(null)
        setErrorMessage(response.message)
        setApiValidationMessages(flattenValidationErrors(response.validationErrors))
        setIsLoading(false)
        return
      }

      setData(response.data)
      setErrorMessage(null)
      setApiValidationMessages([])
      setIsLoading(false)
    })()

    return () => {
      abortController.abort()
    }
  }, [
    canRequest,
    normalizedSort.value,
    reloadToken,
    routeState.page,
    routeState.pageSize,
    routeState.q,
    routeState.tag,
  ])

  return {
    data,
    isLoading,
    canRequest,
    errorMessage,
    apiValidationMessages,
    routeValidationMessages,
    normalizedSort,
    retry,
  }
}
