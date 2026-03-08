import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { useBootstrapConfig } from '../../../app/providers/useBootstrapConfig.ts'
import { apiRequest } from '../../../shared/api/httpClient.ts'

export type SocialLoginStatus = 'loading' | 'ready' | 'error'

type SocialLoginState = {
  status: SocialLoginStatus
  providers: ReadonlyArray<string>
  errorMessage: string | null
  isRedirecting: boolean
}

type SocialLoginAction =
  | { type: 'bootstrap_started' }
  | { type: 'bootstrap_succeeded'; payload: { providers: ReadonlyArray<string> } }
  | { type: 'bootstrap_failed'; payload: { errorMessage: string } }
  | { type: 'redirect_started' }
  | { type: 'redirect_failed'; payload: { errorMessage: string } }

type SocialLoginModel = SocialLoginState & {
  retryProvidersBootstrap: () => void
  startSocialLogin: (provider: string, returnUrl: string) => boolean
}

const initialSocialLoginState: SocialLoginState = {
  status: 'loading',
  providers: [],
  errorMessage: null,
  isRedirecting: false,
}

function socialLoginStateReducer(
  state: SocialLoginState,
  action: SocialLoginAction,
): SocialLoginState {
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
        providers: action.payload.providers,
        errorMessage: null,
        isRedirecting: false,
      }
    case 'bootstrap_failed':
      return {
        ...state,
        status: 'error',
        errorMessage: action.payload.errorMessage,
      }
    case 'redirect_started':
      return {
        ...state,
        isRedirecting: true,
        errorMessage: null,
      }
    case 'redirect_failed':
      return {
        ...state,
        isRedirecting: false,
        errorMessage: action.payload.errorMessage,
      }
    default:
      return state
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeProvider(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalizedProvider = value.trim().toLowerCase()
  return normalizedProvider.length > 0 ? normalizedProvider : null
}

function normalizeProvidersPayload(payload: unknown): ReadonlyArray<string> | null {
  if (!isRecord(payload) || !Array.isArray(payload.providers)) {
    return null
  }

  const uniqueProviders = new Set<string>()
  for (const provider of payload.providers) {
    const normalizedProvider = normalizeProvider(provider)
    if (normalizedProvider !== null) {
      uniqueProviders.add(normalizedProvider)
    }
  }

  return Array.from(uniqueProviders)
}

function normalizeFailureMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error) {
    const normalizedMessage = error.message.trim()
    if (normalizedMessage.length > 0) {
      return normalizedMessage
    }
  }

  return fallbackMessage
}

function normalizeReturnUrl(returnUrl: string): string | null {
  const normalizedReturnUrl = returnUrl.trim()

  if (
    normalizedReturnUrl.length === 0 ||
    !normalizedReturnUrl.startsWith('/') ||
    normalizedReturnUrl.startsWith('//') ||
    normalizedReturnUrl.startsWith('/\\')
  ) {
    return null
  }

  return normalizedReturnUrl
}

function trimTrailingSlash(value: string): string {
  if (value.length > 1) {
    return value.replace(/\/+$/, '')
  }

  return value
}

function resolveGoogleStartUrl(
  apiBaseUrl: string,
  provider: string,
  returnUrl: string,
): string {
  const normalizedProvider = encodeURIComponent(provider)
  const startPath = `${trimTrailingSlash(apiBaseUrl)}/auth/external/${normalizedProvider}/start`
  const startUri = startPath.startsWith('http://') || startPath.startsWith('https://')
    ? new URL(startPath)
    : new URL(startPath, window.location.origin)

  startUri.searchParams.set('returnUrl', returnUrl)
  return startUri.toString()
}

export function useSocialLoginModel(enabled: boolean): SocialLoginModel {
  const { apiBaseUrl } = useBootstrapConfig()
  const [state, dispatch] = useReducer(socialLoginStateReducer, initialSocialLoginState)
  const requestSequenceRef = useRef(0)
  const requestAbortControllerRef = useRef<AbortController | null>(null)

  const bootstrapProviders = useCallback(() => {
    if (!enabled) {
      return
    }

    requestSequenceRef.current += 1
    const requestId = requestSequenceRef.current

    requestAbortControllerRef.current?.abort()
    const abortController = new AbortController()
    requestAbortControllerRef.current = abortController

    dispatch({ type: 'bootstrap_started' })

    void (async () => {
      try {
        const response = await apiRequest<unknown>('/auth/providers', {
          signal: abortController.signal,
        })

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

        const normalizedProviders = normalizeProvidersPayload(response.data)
        if (normalizedProviders === null) {
          dispatch({
            type: 'bootstrap_failed',
            payload: { errorMessage: 'Received invalid response format from /auth/providers.' },
          })
          return
        }

        dispatch({
          type: 'bootstrap_succeeded',
          payload: { providers: normalizedProviders },
        })
      } catch (error) {
        if (abortController.signal.aborted || requestId !== requestSequenceRef.current) {
          return
        }

        dispatch({
          type: 'bootstrap_failed',
          payload: {
            errorMessage: normalizeFailureMessage(error, 'Failed to load social login providers.'),
          },
        })
      }
    })()
  }, [enabled])

  const startSocialLogin = useCallback(
    (provider: string, returnUrl: string): boolean => {
      if (!enabled || state.isRedirecting) {
        return false
      }

      const normalizedProvider = normalizeProvider(provider)
      if (normalizedProvider === null) {
        dispatch({
          type: 'redirect_failed',
          payload: { errorMessage: 'Cannot start social login for an unknown provider.' },
        })
        return false
      }

      if (!state.providers.includes(normalizedProvider)) {
        dispatch({
          type: 'redirect_failed',
          payload: { errorMessage: `Provider "${normalizedProvider}" is not available.` },
        })
        return false
      }

      const normalizedReturnUrl = normalizeReturnUrl(returnUrl) ?? '/'
      const startUrl = resolveGoogleStartUrl(apiBaseUrl, normalizedProvider, normalizedReturnUrl)

      dispatch({ type: 'redirect_started' })

      try {
        window.location.assign(startUrl)
        return true
      } catch (error) {
        dispatch({
          type: 'redirect_failed',
          payload: {
            errorMessage: normalizeFailureMessage(error, 'Failed to start social login redirect.'),
          },
        })
        return false
      }
    },
    [apiBaseUrl, enabled, state.isRedirecting, state.providers],
  )

  useEffect(() => {
    if (!enabled) {
      requestAbortControllerRef.current?.abort()
      return
    }

    bootstrapProviders()

    return () => {
      requestAbortControllerRef.current?.abort()
    }
  }, [bootstrapProviders, enabled])

  return useMemo(
    () => ({
      ...state,
      retryProvidersBootstrap: bootstrapProviders,
      startSocialLogin,
    }),
    [bootstrapProviders, startSocialLogin, state],
  )
}
