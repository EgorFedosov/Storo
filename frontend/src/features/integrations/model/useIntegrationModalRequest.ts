import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ApiFailure, ApiResult, ApiSuccess } from '../../../shared/api/httpClient.ts'

export type IntegrationModalRequestStatus = 'idle' | 'submitting' | 'success' | 'error'

type ExecuteIntegrationModalRequestOptions<TData> = {
  successMessage?: string | null
  resolveSuccessMessage?: (result: ApiSuccess<TData>) => string | null
}

export type ExecuteIntegrationModalRequest = <TData>(
  requestFactory: (signal: AbortSignal) => Promise<ApiResult<TData>>,
  options?: ExecuteIntegrationModalRequestOptions<TData>,
) => Promise<ApiResult<TData> | null>

export type IntegrationModalRequestModel = {
  status: IntegrationModalRequestStatus
  isSubmitting: boolean
  errorMessage: string | null
  successMessage: string | null
  lastResponseStatus: number | null
  execute: ExecuteIntegrationModalRequest
  reset: () => void
  cancel: () => void
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

export function resolveIntegrationFailureMessage(failure: ApiFailure): string {
  if (failure.status === 0) {
    return 'Не удалось выполнить запрос. Проверьте подключение и повторите.'
  }

  if (failure.status === 401) {
    return 'Сессия истекла. Выполните вход снова.'
  }

  if (failure.status === 403) {
    return 'Недостаточно прав для выполнения действия.'
  }

  if (failure.status === 404) {
    return 'Запрашиваемые данные не найдены.'
  }

  if (failure.status === 409) {
    return 'Конфликт версии. Обновите страницу.'
  }

  if (failure.status === 502 || failure.status >= 500) {
    return 'Временная ошибка внешнего сервиса. Повторите позже.'
  }

  return getFirstValidationErrorMessage(failure) ?? failure.error.message
}

export function useIntegrationModalRequest(): IntegrationModalRequestModel {
  const [status, setStatus] = useState<IntegrationModalRequestStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [lastResponseStatus, setLastResponseStatus] = useState<number | null>(null)

  const inFlightRef = useRef(false)
  const requestSequenceRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => () => {
    abortControllerRef.current?.abort()
  }, [])

  const reset = useCallback(() => {
    setStatus('idle')
    setErrorMessage(null)
    setSuccessMessage(null)
    setLastResponseStatus(null)
  }, [])

  const cancel = useCallback(() => {
    requestSequenceRef.current += 1
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    inFlightRef.current = false
    reset()
  }, [reset])

  const execute = useCallback<ExecuteIntegrationModalRequest>(
    async <TData,>(
      requestFactory: (signal: AbortSignal) => Promise<ApiResult<TData>>,
      options: ExecuteIntegrationModalRequestOptions<TData> = {},
    ): Promise<ApiResult<TData> | null> => {
      if (inFlightRef.current) {
        return null
      }

      requestSequenceRef.current += 1
      const requestId = requestSequenceRef.current

      abortControllerRef.current?.abort()
      const abortController = new AbortController()
      abortControllerRef.current = abortController
      inFlightRef.current = true

      setStatus('submitting')
      setErrorMessage(null)
      setSuccessMessage(null)
      setLastResponseStatus(null)

      try {
        const result = await requestFactory(abortController.signal)
        if (abortController.signal.aborted || requestId !== requestSequenceRef.current) {
          return null
        }

        setLastResponseStatus(result.status)

        if (!result.ok) {
          setStatus('error')
          setErrorMessage(resolveIntegrationFailureMessage(result))
          return result
        }

        const resolvedSuccessMessage = options.resolveSuccessMessage?.(result) ?? options.successMessage ?? null
        setStatus('success')
        setSuccessMessage(resolvedSuccessMessage)
        return result
      } catch (error) {
        if (abortController.signal.aborted || requestId !== requestSequenceRef.current) {
          return null
        }

        const fallbackMessage = 'Не удалось выполнить запрос. Повторите позже.'
        const normalizedMessage = error instanceof Error && error.message.trim().length > 0
          ? error.message
          : fallbackMessage

        setStatus('error')
        setErrorMessage(normalizedMessage)
        return null
      } finally {
        if (requestId === requestSequenceRef.current) {
          inFlightRef.current = false
        }
      }
    },
    [],
  )

  return useMemo(
    () => ({
      status,
      isSubmitting: status === 'submitting',
      errorMessage,
      successMessage,
      lastResponseStatus,
      execute,
      reset,
      cancel,
    }),
    [errorMessage, execute, lastResponseStatus, reset, status, successMessage, cancel],
  )
}
