import { useCallback, useRef, useState } from 'react'
import {
  createMissingVersionProblem,
  extractVersionStamp,
  getConcurrencyProblem,
  type ConcurrencyProblem,
  type VersionStamp,
  withIfMatch,
} from '../../api/concurrency.ts'
import type { ApiRequestOptions, ApiResult } from '../../api/httpClient.ts'

type ExecuteVersionedMutation = <TData>(
  executor: (options: ApiRequestOptions) => Promise<ApiResult<TData>>,
  options?: Omit<ApiRequestOptions, 'ifMatch'>,
) => Promise<ApiResult<TData> | null>

type UseVersionedMutationModelResult = {
  versionStamp: VersionStamp | null
  isMutating: boolean
  concurrencyProblem: ConcurrencyProblem | null
  setVersionStamp: (nextVersionStamp: VersionStamp | null) => void
  resetVersionStamp: () => void
  syncVersionFromResult: <TData>(result: ApiResult<TData>) => void
  clearConcurrencyProblem: () => void
  executeVersionedMutation: ExecuteVersionedMutation
}

export function useVersionedMutationModel(initialVersionStamp: VersionStamp | null = null): UseVersionedMutationModelResult {
  const [versionStamp, setVersionStampState] = useState<VersionStamp | null>(initialVersionStamp)
  const [isMutating, setIsMutating] = useState(false)
  const [concurrencyProblem, setConcurrencyProblem] = useState<ConcurrencyProblem | null>(null)
  const inFlightRef = useRef<Promise<unknown> | null>(null)

  const setVersionStamp = useCallback((nextVersionStamp: VersionStamp | null) => {
    setVersionStampState(nextVersionStamp)
  }, [])

  const resetVersionStamp = useCallback(() => {
    setVersionStampState(null)
  }, [])

  const clearConcurrencyProblem = useCallback(() => {
    setConcurrencyProblem(null)
  }, [])

  const syncVersionFromResult = useCallback(<TData,>(result: ApiResult<TData>) => {
    if (!result.ok) {
      return
    }

    const nextVersionStamp = extractVersionStamp(result)
    if (nextVersionStamp !== null) {
      setVersionStampState(nextVersionStamp)
    }
  }, [])

  const executeVersionedMutation = useCallback<ExecuteVersionedMutation>(
    async <TData,>(
      executor: (options: ApiRequestOptions) => Promise<ApiResult<TData>>,
      options: Omit<ApiRequestOptions, 'ifMatch'> = {},
    ): Promise<ApiResult<TData> | null> => {
      if (inFlightRef.current !== null) {
        return null
      }

      if (versionStamp === null) {
        setConcurrencyProblem(createMissingVersionProblem())
        return null
      }

      setIsMutating(true)
      setConcurrencyProblem(null)

      const mutationPromise = executor(withIfMatch(options, versionStamp))
      inFlightRef.current = mutationPromise

      try {
        const result = await mutationPromise

        if (result.ok) {
          const nextVersionStamp = extractVersionStamp(result)
          if (nextVersionStamp !== null) {
            setVersionStampState(nextVersionStamp)
          }

          return result
        }

        const parsedConcurrencyProblem = getConcurrencyProblem(result)
        if (parsedConcurrencyProblem !== null) {
          setConcurrencyProblem(parsedConcurrencyProblem)
        }

        return result
      } finally {
        inFlightRef.current = null
        setIsMutating(false)
      }
    },
    [versionStamp],
  )

  return {
    versionStamp,
    isMutating,
    concurrencyProblem,
    setVersionStamp,
    resetVersionStamp,
    syncVersionFromResult,
    clearConcurrencyProblem,
    executeVersionedMutation,
  }
}
