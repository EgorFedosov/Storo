import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  AdminUsersBlockedFilter,
  AdminUsersPage,
  AdminUsersQueryState,
  AdminUsersRoleFilter,
  AdminUsersSortDirection,
  AdminUsersSortField,
} from '../../../entities/admin-user/model/types.ts'
import { adminUsersContract } from '../../../entities/admin-user/model/types.ts'
import { fetchAdminUsersPage } from '../../../entities/admin-user/model/adminUsersApi.ts'
import { navigate, useLocationSnapshot } from '../../../shared/lib/router/navigation.ts'
import {
  buildAdminUsersRoutePath,
  normalizeAdminUsersSearchQueryInput,
  parseAdminUsersRouteState,
} from './adminUsersRoute.ts'

type ApplyFiltersInput = {
  blocked: AdminUsersBlockedFilter
  role: AdminUsersRoleFilter
  query: string
}

type TableChangeInput = {
  page: number
  pageSize: number
  sortField: AdminUsersSortField | null
  sortDirection: AdminUsersSortDirection | null
}

function normalizePageNumber(value: number): number {
  if (Number.isInteger(value) && value >= 1) {
    return value
  }

  return adminUsersContract.defaultPage
}

function normalizePageSize(value: number): number {
  if (
    Number.isInteger(value)
    && value >= 1
    && value <= adminUsersContract.maxPageSize
  ) {
    return value
  }

  return adminUsersContract.defaultPageSize
}

function createNextQueryState(
  currentState: AdminUsersQueryState,
  patch: Partial<AdminUsersQueryState>,
): AdminUsersQueryState {
  return {
    blocked: patch.blocked ?? currentState.blocked,
    role: patch.role ?? currentState.role,
    query: patch.query === undefined ? currentState.query : patch.query,
    page: patch.page === undefined ? currentState.page : normalizePageNumber(patch.page),
    pageSize: patch.pageSize === undefined ? currentState.pageSize : normalizePageSize(patch.pageSize),
    sortField: patch.sortField ?? currentState.sortField,
    sortDirection: patch.sortDirection ?? currentState.sortDirection,
  }
}

export function useAdminUsersListModel() {
  const locationSnapshot = useLocationSnapshot()
  const routeState = useMemo(
    () => parseAdminUsersRouteState(locationSnapshot.search),
    [locationSnapshot.search],
  )

  const [pageData, setPageData] = useState<AdminUsersPage | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const requestSequenceRef = useRef(0)
  const requestAbortControllerRef = useRef<AbortController | null>(null)

  const queryState = routeState.queryState
  const blockedFilter = queryState.blocked
  const roleFilter = queryState.role
  const searchQuery = queryState.query
  const page = queryState.page
  const pageSize = queryState.pageSize
  const sortField = queryState.sortField
  const sortDirection = queryState.sortDirection

  const navigateToQueryState = useCallback(
    (nextQueryState: AdminUsersQueryState) => {
      const targetPath = buildAdminUsersRoutePath(nextQueryState)
      const currentPath = `${locationSnapshot.pathname}${locationSnapshot.search}`

      if (targetPath !== currentPath) {
        navigate(targetPath)
      }
    },
    [locationSnapshot.pathname, locationSnapshot.search],
  )

  const patchQueryState = useCallback(
    (patch: Partial<AdminUsersQueryState>) => {
      const nextQueryState = createNextQueryState(queryState, patch)
      navigateToQueryState(nextQueryState)
    },
    [navigateToQueryState, queryState],
  )

  const applyFilters = useCallback(
    (filters: ApplyFiltersInput) => {
      patchQueryState({
        blocked: filters.blocked,
        role: filters.role,
        query: normalizeAdminUsersSearchQueryInput(filters.query),
        page: adminUsersContract.defaultPage,
      })
    },
    [patchQueryState],
  )

  const resetFilters = useCallback(() => {
    patchQueryState({
      blocked: adminUsersContract.defaultBlockedFilter,
      role: adminUsersContract.defaultRoleFilter,
      query: null,
      page: adminUsersContract.defaultPage,
    })
  }, [patchQueryState])

  const applyTableChange = useCallback(
    (change: TableChangeInput) => {
      const nextQueryPatch: Partial<AdminUsersQueryState> =
        change.sortField !== null && change.sortDirection !== null
          ? {
              page: adminUsersContract.defaultPage,
              pageSize: change.pageSize,
              sortField: change.sortField,
              sortDirection: change.sortDirection,
            }
          : {
              page: change.page,
              pageSize: change.pageSize,
            }

      patchQueryState(nextQueryPatch)
    },
    [patchQueryState],
  )

  const retry = useCallback(() => {
    setReloadToken((currentValue) => currentValue + 1)
  }, [])

  useEffect(() => {
    requestSequenceRef.current += 1
    const requestId = requestSequenceRef.current

    requestAbortControllerRef.current?.abort()
    const abortController = new AbortController()
    requestAbortControllerRef.current = abortController

    setIsLoading(true)
    setErrorMessage(null)

    void (async () => {
      try {
        const requestQueryState: AdminUsersQueryState = {
          blocked: blockedFilter,
          role: roleFilter,
          query: searchQuery,
          page,
          pageSize,
          sortField,
          sortDirection,
        }

        const result = await fetchAdminUsersPage(requestQueryState, abortController.signal)

        if (abortController.signal.aborted || requestId !== requestSequenceRef.current) {
          return
        }

        if (!result.ok) {
          setErrorMessage(result.error.message)
          return
        }

        setPageData(result.data)
      } catch (error) {
        if (abortController.signal.aborted || requestId !== requestSequenceRef.current) {
          return
        }

        const fallbackMessage = error instanceof Error && error.message.trim().length > 0
          ? error.message.trim()
          : 'Failed to load admin users list.'
        setErrorMessage(fallbackMessage)
      } finally {
        if (!abortController.signal.aborted && requestId === requestSequenceRef.current) {
          setIsLoading(false)
        }
      }
    })()

    return () => {
      abortController.abort()
    }
  }, [
    blockedFilter,
    page,
    pageSize,
    roleFilter,
    searchQuery,
    sortDirection,
    sortField,
    reloadToken,
  ])

  return {
    queryState,
    routeValidationErrors: routeState.errors,
    pageData,
    isLoading,
    errorMessage,
    applyFilters,
    resetFilters,
    applyTableChange,
    retry,
  }
}
