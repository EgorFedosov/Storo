import { useCallback, useRef, useState } from 'react'
import type { Key } from 'react'

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message
  }

  return 'Operation failed. Please try again.'
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
      return await actionPromise
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
