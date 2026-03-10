import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import type { PropsWithChildren } from 'react'
import type { AppRouteKey } from '../../../shared/config/routes.ts'
import { apiRequest, type ApiFailure } from '../../../shared/api/httpClient.ts'
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
export type PreferencesSyncStatus = 'idle' | 'saving' | 'success' | 'error'

type UserPreferencesPayload = {
  language: string
  theme: UiTheme
}

type AuthState = {
  status: AuthBootstrapStatus
  isAuthenticated: boolean
  currentUser: CurrentUser | null
  roles: ReadonlyArray<UserRole>
  permissions: CurrentUserPermissions
  access: GlobalAccessModel
  errorMessage: string | null
  preferencesSyncStatus: PreferencesSyncStatus
  preferencesSyncErrorMessage: string | null
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
  | { type: 'preferences_sync_started' }
  | { type: 'preferences_sync_succeeded'; payload: UserPreferencesPayload }
  | { type: 'preferences_sync_failed'; payload: { errorMessage: string } }
  | { type: 'preferences_sync_reset' }

type NormalizedAuthPayload = {
  isAuthenticated: boolean
  currentUser: CurrentUser | null
  roles: ReadonlyArray<UserRole>
  permissions: CurrentUserPermissions
}

type AuthContextValue = AuthState & {
  retryBootstrap: () => void
  updatePreferences: (preferences: UserPreferencesPayload) => Promise<boolean>
  resetPreferencesSyncState: () => void
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
  preferencesSyncStatus: 'idle',
  preferencesSyncErrorMessage: null,
}

function authStateReducer(state: AuthState, action: AuthStateAction): AuthState {
  switch (action.type) {
    case 'bootstrap_started':
      return {
        ...state,
        status: 'loading',
        errorMessage: null,
        preferencesSyncStatus: 'idle',
        preferencesSyncErrorMessage: null,
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
        preferencesSyncStatus: 'idle',
        preferencesSyncErrorMessage: null,
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
        preferencesSyncStatus: 'idle',
        preferencesSyncErrorMessage: null,
      }
    case 'preferences_sync_started':
      return {
        ...state,
        preferencesSyncStatus: 'saving',
        preferencesSyncErrorMessage: null,
      }
    case 'preferences_sync_succeeded':
      return {
        ...state,
        currentUser:
          state.currentUser === null
            ? null
            : {
                ...state.currentUser,
                language: action.payload.language,
                theme: action.payload.theme,
              },
        preferencesSyncStatus: 'success',
        preferencesSyncErrorMessage: null,
      }
    case 'preferences_sync_failed':
      return {
        ...state,
        preferencesSyncStatus: 'error',
        preferencesSyncErrorMessage: action.payload.errorMessage,
      }
    case 'preferences_sync_reset':
      return {
        ...state,
        preferencesSyncStatus: 'idle',
        preferencesSyncErrorMessage: null,
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
    canAccessCreateInventory: isActiveUser && permissions.canCreateInventory,
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

  return 'Не удалось инициализировать контекст текущего пользователя.'
}

function normalizePreferencesPayload(payload: unknown): UserPreferencesPayload | null {
  if (!isRecord(payload)) {
    return null
  }

  const language = normalizeNonEmptyString(payload.language)
  if (language === null) {
    return null
  }

  return {
    language,
    theme: normalizeTheme(payload.theme),
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

function normalizePreferencesFailureMessage(failure: ApiFailure): string {
  if (failure.status === 404) {
    return 'Эндпоинт настроек недоступен в текущей конфигурации бэкенда.'
  }

  const validationMessage = getFirstValidationErrorMessage(failure)
  if (validationMessage !== null) {
    return validationMessage
  }

  return failure.error.message
}

export function canAccessRoute(routeKey: AppRouteKey, access: GlobalAccessModel): boolean {
  if (routeKey === 'myInventories') {
    return access.canAccessMyInventories
  }

  if (routeKey === 'createInventory') {
    return access.canAccessCreateInventory
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
  const preferencesRequestSequenceRef = useRef(0)
  const preferencesAbortControllerRef = useRef<AbortController | null>(null)

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
            payload: { errorMessage: 'Получен некорректный формат ответа от /auth/me.' },
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

  const updatePreferences = useCallback(
    async (preferences: UserPreferencesPayload): Promise<boolean> => {
      if (!state.isAuthenticated || state.currentUser === null) {
        dispatch({
          type: 'preferences_sync_failed',
          payload: { errorMessage: 'Обновлять настройки могут только авторизованные пользователи.' },
        })
        return false
      }

      preferencesRequestSequenceRef.current += 1
      const requestId = preferencesRequestSequenceRef.current

      preferencesAbortControllerRef.current?.abort()
      const abortController = new AbortController()
      preferencesAbortControllerRef.current = abortController

      dispatch({ type: 'preferences_sync_started' })

      try {
        const response = await apiRequest<unknown>('/users/me/preferences', {
          method: 'PATCH',
          body: {
            language: preferences.language,
            theme: preferences.theme,
          },
          signal: abortController.signal,
        })

        if (abortController.signal.aborted || requestId !== preferencesRequestSequenceRef.current) {
          return false
        }

        if (!response.ok) {
          dispatch({
            type: 'preferences_sync_failed',
            payload: { errorMessage: normalizePreferencesFailureMessage(response) },
          })
          return false
        }

        const normalizedPayload = normalizePreferencesPayload(response.data)
        if (normalizedPayload === null) {
          dispatch({
            type: 'preferences_sync_failed',
            payload: {
              errorMessage: 'Получен некорректный формат ответа от /users/me/preferences.',
            },
          })
          return false
        }

        dispatch({
          type: 'preferences_sync_succeeded',
          payload: normalizedPayload,
        })

        return true
      } catch (error) {
        if (abortController.signal.aborted || requestId !== preferencesRequestSequenceRef.current) {
          return false
        }

        dispatch({
          type: 'preferences_sync_failed',
          payload: { errorMessage: normalizeAuthFailure(error) },
        })
        return false
      }
    },
    [state.currentUser, state.isAuthenticated],
  )

  const resetPreferencesSyncState = useCallback(() => {
    dispatch({ type: 'preferences_sync_reset' })
  }, [])

  useEffect(() => {
    bootstrapCurrentUser()

    return () => {
      requestAbortControllerRef.current?.abort()
      preferencesAbortControllerRef.current?.abort()
    }
  }, [bootstrapCurrentUser])

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      ...state,
      retryBootstrap: bootstrapCurrentUser,
      updatePreferences,
      resetPreferencesSyncState,
    }),
    [state, bootstrapCurrentUser, resetPreferencesSyncState, updatePreferences],
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


