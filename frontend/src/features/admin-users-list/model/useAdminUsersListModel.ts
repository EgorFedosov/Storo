import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  AdminModerationAction,
  AdminModerationMutationResult,
  AdminUserListItem,
  AdminUsersBlockedFilter,
  AdminUsersPage,
  AdminUsersQueryState,
  AdminUsersRoleFilter,
  AdminUsersSortDirection,
  AdminUsersSortField,
} from '../../../entities/admin-user/model/types.ts'
import { adminUsersContract } from '../../../entities/admin-user/model/types.ts'
import {
  blockAdminUser,
  deleteAdminUser,
  fetchAdminUsersPage,
  grantAdminRole,
  revokeAdminRole,
  unblockAdminUser,
} from '../../../entities/admin-user/model/adminUsersApi.ts'
import type { ApiResult } from '../../../shared/api/httpClient.ts'
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

type ModerationInFlightState = {
  userId: string
  action: AdminModerationAction
}

type ModerationActionExecutionResult =
  | {
      ok: true
      message: string
    }
  | {
      ok: false
      message: string
    }

const positiveIntegerPattern = /^[1-9]\d*$/

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

function isPositiveIntegerId(value: string): boolean {
  return positiveIntegerPattern.test(value)
}

function executeModerationRequest(
  action: AdminModerationAction,
  userId: string,
  signal?: AbortSignal,
): Promise<ApiResult<AdminModerationMutationResult>> {
  switch (action) {
    case 'block':
      return blockAdminUser(userId, signal)
    case 'unblock':
      return unblockAdminUser(userId, signal)
    case 'grant_admin':
      return grantAdminRole(userId, signal)
    case 'revoke_admin':
      return revokeAdminRole(userId, signal)
    case 'delete':
      return deleteAdminUser(userId, signal)
    default: {
      const unsupportedAction: never = action
      throw new Error(`Unsupported moderation action: ${String(unsupportedAction)}`)
    }
  }
}

function toModerationSuccessMessage(user: AdminUserListItem, result: AdminModerationMutationResult): string {
  switch (result.action) {
    case 'block':
      return result.changed
        ? `User @${user.userName} has been blocked.`
        : `User @${user.userName} is already blocked.`
    case 'unblock':
      return result.changed
        ? `User @${user.userName} has been unblocked.`
        : `User @${user.userName} is already active.`
    case 'grant_admin':
      return result.changed
        ? `Admin role granted to @${user.userName}.`
        : `User @${user.userName} already has admin role.`
    case 'revoke_admin':
      return result.changed
        ? `Admin role revoked for @${user.userName}.`
        : `User @${user.userName} does not have admin role.`
    case 'delete':
      return `User @${user.userName} has been deleted.`
    default: {
      const unsupportedAction: never = result.action
      throw new Error(`Unsupported moderation action: ${String(unsupportedAction)}`)
    }
  }
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
  const [moderationErrorMessage, setModerationErrorMessage] = useState<string | null>(null)
  const [moderationInFlight, setModerationInFlight] = useState<ModerationInFlightState | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const requestSequenceRef = useRef(0)
  const requestAbortControllerRef = useRef<AbortController | null>(null)
  const moderationAbortControllerRef = useRef<AbortController | null>(null)
  const moderationInFlightRef = useRef(false)

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

  const clearModerationError = useCallback(() => {
    setModerationErrorMessage(null)
  }, [])

  const executeModerationAction = useCallback(
    async (
      action: AdminModerationAction,
      user: AdminUserListItem,
    ): Promise<ModerationActionExecutionResult> => {
      if (moderationInFlightRef.current) {
        return {
          ok: false,
          message: 'Another moderation request is already in progress.',
        }
      }

      if (!isPositiveIntegerId(user.id)) {
        const validationMessage = 'Cannot run moderation action: selected user ID is invalid.'
        setModerationErrorMessage(validationMessage)
        return {
          ok: false,
          message: validationMessage,
        }
      }

      moderationInFlightRef.current = true
      moderationAbortControllerRef.current?.abort()
      const abortController = new AbortController()
      moderationAbortControllerRef.current = abortController

      setModerationErrorMessage(null)
      setModerationInFlight({
        userId: user.id,
        action,
      })

      try {
        const result = await executeModerationRequest(action, user.id, abortController.signal)
        if (abortController.signal.aborted) {
          return {
            ok: false,
            message: 'Moderation request was canceled.',
          }
        }

        if (!result.ok) {
          setModerationErrorMessage(result.error.message)
          return {
            ok: false,
            message: result.error.message,
          }
        }

        setReloadToken((currentValue) => currentValue + 1)
        return {
          ok: true,
          message: toModerationSuccessMessage(user, result.data),
        }
      } catch (error) {
        if (abortController.signal.aborted) {
          return {
            ok: false,
            message: 'Moderation request was canceled.',
          }
        }

        const fallbackMessage = error instanceof Error && error.message.trim().length > 0
          ? error.message.trim()
          : 'Failed to run admin moderation action.'

        setModerationErrorMessage(fallbackMessage)
        return {
          ok: false,
          message: fallbackMessage,
        }
      } finally {
        if (moderationAbortControllerRef.current === abortController) {
          moderationAbortControllerRef.current = null
        }

        moderationInFlightRef.current = false
        setModerationInFlight(null)
      }
    },
    [],
  )

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

  useEffect(() => {
    return () => {
      moderationAbortControllerRef.current?.abort()
    }
  }, [])

  return {
    queryState,
    routeValidationErrors: routeState.errors,
    pageData,
    isLoading,
    errorMessage,
    moderationErrorMessage,
    moderationInFlight,
    applyFilters,
    resetFilters,
    applyTableChange,
    retry,
    clearModerationError,
    executeModerationAction,
  }
}
