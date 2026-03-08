import { useCallback, useRef, useState } from 'react'
import type { Key } from 'react'
import { describeConcurrencyProblem, getConcurrencyProblem } from '../../api/concurrency.ts'
import type { ApiResult } from '../../api/httpClient.ts'

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message
  }

  return 'Operation failed. Please try again.'
}

function isApiResult(value: unknown): value is ApiResult<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    typeof (value as { ok: unknown }).ok === 'boolean'
  )
}

function toApiFailureMessage(result: ApiResult<unknown>): string | null {
  if (result.ok) {
    return null
  }

  const concurrencyProblem = getConcurrencyProblem(result)
  if (concurrencyProblem !== null) {
    return describeConcurrencyProblem(concurrencyProblem).description
  }

  return result.error.message
}

export function useTableInteractionModel() {
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const inFlightRef = useRef<Promise<unknown> | null>(null)

  const execute = useCallback(async <TResult>(action: () => Promise<TResult>): Promise<TResult | null> => {
    if (inFlightRef.current !== null) {
      return null
    }

    setIsLoading(true)
    setErrorMessage(null)

    let actionPromise: Promise<TResult>
    try {
      actionPromise = action()
    } catch (error) {
      setErrorMessage(toErrorMessage(error))
      setIsLoading(false)
      return null
    }

    inFlightRef.current = actionPromise

    try {
      const result = await actionPromise

      if (isApiResult(result)) {
        const failureMessage = toApiFailureMessage(result)
        if (failureMessage !== null) {
          setErrorMessage(failureMessage)
          return null
        }
      }

      return result
    } catch (error) {
      setErrorMessage(toErrorMessage(error))
      return null
    } finally {
      inFlightRef.current = null
      setIsLoading(false)
    }
  }, [])

  const resetInteractionState = useCallback(() => {
    setSelectedRowKeys([])
    setErrorMessage(null)
  }, [])

  return {
    selectedRowKeys,
    setSelectedRowKeys,
    isLoading,
    errorMessage,
    execute,
    resetInteractionState,
  }
}
