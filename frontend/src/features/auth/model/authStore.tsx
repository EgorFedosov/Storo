import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import type { PropsWithChildren } from 'react'
import type { AppRouteKey } from '../../../shared/config/routes.ts'
import { apiRequest } from '../../../shared/api/httpClient.ts'
import {
  guestAccessModel,
  guestPermissions,
  type CurrentUser,
  type CurrentUserPermissions,
  type GlobalAccessModel,
  type UiTheme,
  type UserRole,
} from '../../../entities/user/model/types.ts'

export type AuthBootstrapStatus = 'loading' | 'ready' | 'error'

type AuthState = {
  status: AuthBootstrapStatus
  isAuthenticated: boolean
  currentUser: CurrentUser | null
  roles: ReadonlyArray<UserRole>
  permissions: CurrentUserPermissions
  access: GlobalAccessModel
  errorMessage: string | null
}

type AuthStateAction =
  | { type: 'bootstrap_started' }
  | {
      type: 'bootstrap_succeeded'
      payload: {
        isAuthenticated: boolean
        currentUser: CurrentUser | null
        roles: ReadonlyArray<UserRole>
        permissions: CurrentUserPermissions
        access: GlobalAccessModel
      }
    }
  | { type: 'bootstrap_failed'; payload: { errorMessage: string } }

type NormalizedAuthPayload = {
  isAuthenticated: boolean
  currentUser: CurrentUser | null
  roles: ReadonlyArray<UserRole>
  permissions: CurrentUserPermissions
}

type AuthContextValue = AuthState & {
  retryBootstrap: () => void
}

const authContext = createContext<AuthContextValue | null>(null)

const initialAuthState: AuthState = {
  status: 'loading',
  isAuthenticated: false,
  currentUser: null,
  roles: [],
  permissions: guestPermissions,
  access: guestAccessModel,
  errorMessage: null,
}

function authStateReducer(state: AuthState, action: AuthStateAction): AuthState {
  switch (action.type) {
    case 'bootstrap_started':
      return {
        ...state,
        status: 'loading',
        errorMessage: null,
      }
    case 'bootstrap_succeeded':
      return {
        status: 'ready',
        isAuthenticated: action.payload.isAuthenticated,
        currentUser: action.payload.currentUser,
        roles: action.payload.roles,
        permissions: action.payload.permissions,
        access: action.payload.access,
        errorMessage: null,
      }
    case 'bootstrap_failed':
      return {
        status: 'error',
        isAuthenticated: false,
        currentUser: null,
        roles: [],
        permissions: guestPermissions,
        access: guestAccessModel,
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

function normalizeTheme(value: unknown): UiTheme {
  if (typeof value !== 'string') {
    return 'light'
  }

  return value.trim().toLowerCase() === 'dark' ? 'dark' : 'light'
}

function normalizeRoles(value: unknown): UserRole[] | null {
  if (!Array.isArray(value)) {
    return null
  }

  const normalizedRoles = new Set<UserRole>()

  for (const roleValue of value) {
    if (typeof roleValue !== 'string') {
      continue
    }

    const normalizedRole = roleValue.trim().toLowerCase()
    if (normalizedRole === 'user' || normalizedRole === 'admin') {
      normalizedRoles.add(normalizedRole)
    }
  }

  return Array.from(normalizedRoles)
}

function normalizePermissions(value: unknown): CurrentUserPermissions | null {
  if (!isRecord(value)) {
    return null
  }

  if (
    typeof value.isAdmin !== 'boolean' ||
    typeof value.canManageUsers !== 'boolean' ||
    typeof value.canCreateInventory !== 'boolean' ||
    typeof value.canComment !== 'boolean' ||
    typeof value.canLike !== 'boolean'
  ) {
    return null
  }

  return {
    isAdmin: value.isAdmin,
    canManageUsers: value.canManageUsers,
    canCreateInventory: value.canCreateInventory,
    canComment: value.canComment,
    canLike: value.canLike,
  }
}

function normalizeCurrentUserIdentity(value: unknown): Omit<CurrentUser, 'roles' | 'language' | 'theme'> | null {
  if (value === null) {
    return null
  }

  if (!isRecord(value)) {
    return null
  }

  const id = normalizeNonEmptyString(value.id)
  const email = normalizeNonEmptyString(value.email)
  const userName = normalizeNonEmptyString(value.userName)
  const displayName = normalizeNonEmptyString(value.displayName)

  if (
    id === null ||
    email === null ||
    userName === null ||
    displayName === null ||
    typeof value.isBlocked !== 'boolean'
  ) {
    return null
  }

  return {
    id,
    email,
    userName,
    displayName,
    isBlocked: value.isBlocked,
  }
}

function createAccessModel(
  isAuthenticated: boolean,
  currentUser: CurrentUser | null,
  permissions: CurrentUserPermissions,
): GlobalAccessModel {
  const isActiveUser = isAuthenticated && currentUser !== null && !currentUser.isBlocked

  return {
    canAccessMyInventories: isActiveUser,
    canAccessAdminUsers: permissions.canManageUsers,
  }
}

function normalizeCurrentUserPayload(payload: unknown): NormalizedAuthPayload | null {
  if (!isRecord(payload) || typeof payload.isAuthenticated !== 'boolean') {
    return null
  }

  const roles = normalizeRoles(payload.roles)
  const permissions = normalizePermissions(payload.permissions)

  if (roles === null || permissions === null) {
    return null
  }

  const preferences = isRecord(payload.preferences) ? payload.preferences : {}
  const language = normalizeNonEmptyString(preferences.language) ?? 'en'
  const theme = normalizeTheme(preferences.theme)
  const currentUserIdentity = normalizeCurrentUserIdentity(payload.user)

  if (payload.isAuthenticated) {
    if (currentUserIdentity === null) {
      return null
    }

    return {
      isAuthenticated: true,
      currentUser: {
        ...currentUserIdentity,
        roles,
        language,
        theme,
      },
      roles,
      permissions,
    }
  }

  return {
    isAuthenticated: false,
    currentUser: null,
    roles,
    permissions,
  }
}

function normalizeAuthFailure(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim()
  }

  return 'Failed to bootstrap current user context.'
}

export function canAccessRoute(routeKey: AppRouteKey, access: GlobalAccessModel): boolean {
  if (routeKey === 'myInventories') {
    return access.canAccessMyInventories
  }

  if (routeKey === 'adminUsers') {
    return access.canAccessAdminUsers
  }

  return true
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(authStateReducer, initialAuthState)
  const requestSequenceRef = useRef(0)
  const requestAbortControllerRef = useRef<AbortController | null>(null)

  const bootstrapCurrentUser = useCallback(() => {
    requestSequenceRef.current += 1
    const requestId = requestSequenceRef.current

    requestAbortControllerRef.current?.abort()
    const abortController = new AbortController()
    requestAbortControllerRef.current = abortController

    dispatch({ type: 'bootstrap_started' })

    void (async () => {
      try {
        const response = await apiRequest<unknown>('/auth/me', { signal: abortController.signal })
        if (abortController.signal.aborted || requestId !== requestSequenceRef.current) {
          return
        }

        if (!response.ok) {
          dispatch({
            type: 'bootstrap_failed',
            payload: { errorMessage: response.error.message },
          })
          return
        }

        const normalizedPayload = normalizeCurrentUserPayload(response.data)
        if (normalizedPayload === null) {
          dispatch({
            type: 'bootstrap_failed',
            payload: { errorMessage: 'Received invalid response format from /auth/me.' },
          })
          return
        }

        dispatch({
          type: 'bootstrap_succeeded',
          payload: {
            ...normalizedPayload,
            access: createAccessModel(
              normalizedPayload.isAuthenticated,
              normalizedPayload.currentUser,
              normalizedPayload.permissions,
            ),
          },
        })
      } catch (error) {
        if (abortController.signal.aborted || requestId !== requestSequenceRef.current) {
          return
        }

        dispatch({
          type: 'bootstrap_failed',
          payload: { errorMessage: normalizeAuthFailure(error) },
        })
      }
    })()
  }, [])

  useEffect(() => {
    bootstrapCurrentUser()

    return () => {
      requestAbortControllerRef.current?.abort()
    }
  }, [bootstrapCurrentUser])

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      ...state,
      retryBootstrap: bootstrapCurrentUser,
    }),
    [state, bootstrapCurrentUser],
  )

  return <authContext.Provider value={contextValue}>{children}</authContext.Provider>
}

export function useAuthModel(): AuthContextValue {
  const contextValue = useContext(authContext)

  if (contextValue === null) {
    throw new Error('useAuthModel must be used within AuthProvider.')
  }

  return contextValue
}
