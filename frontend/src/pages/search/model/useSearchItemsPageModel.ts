import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  buildSearchRoutePath,
  parseSearchRouteState,
  type SearchRouteState,
} from '../../../features/search-navigation/model/searchNavigation.ts'
import {
  searchItems,
  type SearchItemSummary,
  type SearchItemsSortDirection,
  type SearchItemsSortField,
} from '../../../entities/search-item/model/searchItemsApi.ts'
import { navigate, useLocationSnapshot } from '../../../shared/lib/router/navigation.ts'

type SearchItemsSortState = {
  field: SearchItemsSortField
  direction: SearchItemsSortDirection
  serialized: string
}

type ParsedSortState = {
  sort: SearchItemsSortState
  errorMessage: string | null
}

type SearchItemsPageDataState = {
  items: ReadonlyArray<SearchItemSummary>
  totalCount: number
  isLoading: boolean
  errorMessage: string | null
}

type SearchItemsRouteValidationEntry = [field: string, message: string]

const defaultSortField: SearchItemsSortField = 'relevance'
const defaultSortDirection: SearchItemsSortDirection = 'desc'

const sortFieldLookup: Record<string, SearchItemsSortField> = {
  relevance: 'relevance',
  updatedat: 'updatedAt',
  createdat: 'createdAt',
  customid: 'customId',
}

const sortDirectionLookup: Record<string, SearchItemsSortDirection> = {
  asc: 'asc',
  desc: 'desc',
}

const defaultDataState: SearchItemsPageDataState = {
  items: [],
  totalCount: 0,
  isLoading: false,
  errorMessage: null,
}

export const searchItemsSortFieldOptions: ReadonlyArray<{
  value: SearchItemsSortField
  label: string
}> = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'updatedAt', label: 'Updated At' },
  { value: 'createdAt', label: 'Created At' },
  { value: 'customId', label: 'Custom ID' },
]

export const searchItemsSortDirectionOptions: ReadonlyArray<{
  value: SearchItemsSortDirection
  label: string
}> = [
  { value: 'desc', label: 'Descending' },
  { value: 'asc', label: 'Ascending' },
]

function serializeSort(field: SearchItemsSortField, direction: SearchItemsSortDirection): string {
  return `${field}:${direction}`
}

function toDefaultSortState(): SearchItemsSortState {
  return {
    field: defaultSortField,
    direction: defaultSortDirection,
    serialized: serializeSort(defaultSortField, defaultSortDirection),
  }
}

function parseSearchItemsSort(rawSort: string | null): ParsedSortState {
  if (rawSort === null) {
    return {
      sort: toDefaultSortState(),
      errorMessage: null,
    }
  }

  const normalizedSort = rawSort.trim()
  if (normalizedSort.length === 0) {
    return {
      sort: toDefaultSortState(),
      errorMessage: 'sort cannot be empty.',
    }
  }

  const parts = normalizedSort.split(':', 2).map((part) => part.trim())
  const rawField = parts[0].toLowerCase()
  const rawDirection = parts.length === 2 ? parts[1].toLowerCase() : defaultSortDirection

  const parsedField = sortFieldLookup[rawField]
  if (parsedField === undefined) {
    return {
      sort: toDefaultSortState(),
      errorMessage: 'sort must be one of: relevance, updatedAt, createdAt, customId.',
    }
  }

  const parsedDirection = sortDirectionLookup[rawDirection]
  if (parsedDirection === undefined) {
    return {
      sort: toDefaultSortState(),
      errorMessage: 'sort direction must be one of: asc, desc.',
    }
  }

  return {
    sort: {
      field: parsedField,
      direction: parsedDirection,
      serialized: serializeSort(parsedField, parsedDirection),
    },
    errorMessage: null,
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim()
  }

  return 'Failed to load search results.'
}

function normalizeValidationErrors(
  routeState: SearchRouteState,
  parsedSort: ParsedSortState,
): SearchItemsRouteValidationEntry[] {
  const normalizedEntries: SearchItemsRouteValidationEntry[] = []

  for (const [field, message] of Object.entries(routeState.errors)) {
    if (typeof message === 'string' && message.trim().length > 0) {
      normalizedEntries.push([field, message])
    }
  }

  if (parsedSort.errorMessage !== null && !normalizedEntries.some(([field]) => field === 'sort')) {
    normalizedEntries.push(['sort', parsedSort.errorMessage])
  }

  return normalizedEntries
}

export function useSearchItemsPageModel() {
  const locationSnapshot = useLocationSnapshot()
  const routeState = useMemo(
    () => parseSearchRouteState(locationSnapshot.pathname, locationSnapshot.search),
    [locationSnapshot.pathname, locationSnapshot.search],
  )
  const parsedSort = useMemo(
    () => parseSearchItemsSort(routeState.sort),
    [routeState.sort],
  )
  const validationErrors = useMemo(
    () => normalizeValidationErrors(routeState, parsedSort),
    [routeState, parsedSort],
  )

  const [dataState, setDataState] = useState<SearchItemsPageDataState>(defaultDataState)
  const [refreshToken, setRefreshToken] = useState(0)
  const requestSequenceRef = useRef(0)
  const requestAbortControllerRef = useRef<AbortController | null>(null)

  const updateRouteState = useCallback(
    (params: {
      page?: number
      pageSize?: number
      sort?: string
    }) => {
      if (routeState.scope !== 'items' || routeState.q === null) {
        return
      }

      navigate(buildSearchRoutePath({
        scope: 'items',
        q: routeState.q,
        page: params.page ?? routeState.page,
        pageSize: params.pageSize ?? routeState.pageSize,
        sort: params.sort ?? parsedSort.sort.serialized,
      }))
    },
    [parsedSort.sort.serialized, routeState],
  )

  const handlePageChange = useCallback(
    (nextPage: number, nextPageSize: number) => {
      const normalizedPageSize = Number.isInteger(nextPageSize) && nextPageSize > 0
        ? nextPageSize
        : routeState.pageSize

      const normalizedPage = Number.isInteger(nextPage) && nextPage > 0
        ? nextPage
        : routeState.page

      const page = normalizedPageSize !== routeState.pageSize ? 1 : normalizedPage
      updateRouteState({
        page,
        pageSize: normalizedPageSize,
      })
    },
    [routeState.page, routeState.pageSize, updateRouteState],
  )

  const handleSortFieldChange = useCallback(
    (nextField: SearchItemsSortField) => {
      updateRouteState({
        page: 1,
        sort: serializeSort(nextField, parsedSort.sort.direction),
      })
    },
    [parsedSort.sort.direction, updateRouteState],
  )

  const handleSortDirectionChange = useCallback(
    (nextDirection: SearchItemsSortDirection) => {
      updateRouteState({
        page: 1,
        sort: serializeSort(parsedSort.sort.field, nextDirection),
      })
    },
    [parsedSort.sort.field, updateRouteState],
  )

  const retry = useCallback(() => {
    setRefreshToken((currentValue) => currentValue + 1)
  }, [])

  useEffect(() => {
    const query = routeState.q
    if (query === null) {
      requestAbortControllerRef.current?.abort()
      return
    }

    requestSequenceRef.current += 1
    const requestId = requestSequenceRef.current

    requestAbortControllerRef.current?.abort()
    const abortController = new AbortController()
    requestAbortControllerRef.current = abortController

    void (async () => {
      if (abortController.signal.aborted || requestId !== requestSequenceRef.current) {
        return
      }

      setDataState((currentState) => ({
        ...currentState,
        isLoading: true,
        errorMessage: null,
      }))

      try {
        const response = await searchItems({
          q: query,
          page: routeState.page,
          pageSize: routeState.pageSize,
          sort: parsedSort.sort.serialized,
        }, abortController.signal)

        if (abortController.signal.aborted || requestId !== requestSequenceRef.current) {
          return
        }

        if (!response.ok) {
          setDataState({
            items: [],
            totalCount: 0,
            isLoading: false,
            errorMessage: response.errorMessage,
          })
          return
        }

        setDataState({
          items: response.data.items,
          totalCount: response.data.totalCount,
          isLoading: false,
          errorMessage: null,
        })
      } catch (error) {
        if (abortController.signal.aborted || requestId !== requestSequenceRef.current) {
          return
        }

        setDataState({
          items: [],
          totalCount: 0,
          isLoading: false,
          errorMessage: toErrorMessage(error),
        })
      }
    })()
  }, [
    parsedSort.sort.serialized,
    refreshToken,
    routeState.page,
    routeState.pageSize,
    routeState.q,
  ])

  useEffect(
    () => () => {
      requestAbortControllerRef.current?.abort()
    },
    [],
  )

  return {
    routeState,
    validationErrors,
    sort: parsedSort.sort,
    items: routeState.q === null ? [] : dataState.items,
    totalCount: routeState.q === null ? 0 : dataState.totalCount,
    isLoading: routeState.q === null ? false : dataState.isLoading,
    errorMessage: routeState.q === null ? null : dataState.errorMessage,
    handlePageChange,
    handleSortFieldChange,
    handleSortDirectionChange,
    retry,
  }
}
