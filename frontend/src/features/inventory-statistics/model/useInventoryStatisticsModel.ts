import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  requestInventoryStatistics,
  type InventoryStatisticsRequestResult,
} from '../../../entities/inventory/model/inventoryStatisticsApi.ts'
import type { InventoryStatistics } from '../../../entities/inventory/model/inventoryStatisticsTypes.ts'

type InventoryStatisticsStatus = 'idle' | 'loading' | 'ready' | 'error'

type InventoryStatisticsState = {
  status: InventoryStatisticsStatus
  data: InventoryStatistics | null
  errorMessage: string | null
  errorStatus: number | null
}

export type InventoryStatisticsModel = InventoryStatisticsState & {
  retryLoad: () => void
}

const positiveIntegerPattern = /^[1-9]\d*$/

const initialInventoryStatisticsState: InventoryStatisticsState = {
  status: 'idle',
  data: null,
  errorMessage: null,
  errorStatus: null,
}

function toFailureMessage(failure: InventoryStatisticsRequestResult & { ok: false }): string {
  if (failure.status === 404) {
    return 'Inventory statistics were not found.'
  }

  if (failure.status === 400) {
    return failure.message
  }

  if (failure.status === 0) {
    return failure.message.trim().length > 0
      ? failure.message
      : 'Statistics request failed before reaching API.'
  }

  return failure.message
}

export function useInventoryStatisticsModel(
  inventoryId: string,
  isEnabled: boolean,
): InventoryStatisticsModel {
  const [state, setState] = useState<InventoryStatisticsState>(initialInventoryStatisticsState)
  const [reloadToken, setReloadToken] = useState(0)

  const requestSequenceRef = useRef(0)
  const requestAbortControllerRef = useRef<AbortController | null>(null)

  const retryLoad = useCallback(() => {
    setReloadToken((currentValue) => currentValue + 1)
  }, [])

  useEffect(
    () => () => {
      requestAbortControllerRef.current?.abort()
    },
    [],
  )

  useEffect(() => {
    requestAbortControllerRef.current?.abort()

    if (!isEnabled || !positiveIntegerPattern.test(inventoryId)) {
      return
    }

    requestSequenceRef.current += 1
    const requestId = requestSequenceRef.current

    const abortController = new AbortController()
    requestAbortControllerRef.current = abortController

    void (async () => {
      if (abortController.signal.aborted || requestId !== requestSequenceRef.current) {
        return
      }

      setState((currentState) => ({
        ...currentState,
        status: 'loading',
        data: null,
        errorMessage: null,
        errorStatus: null,
      }))

      const response = await requestInventoryStatistics(inventoryId, abortController.signal)

      if (abortController.signal.aborted || requestId !== requestSequenceRef.current) {
        return
      }

      if (!response.ok) {
        setState({
          status: 'error',
          data: null,
          errorMessage: toFailureMessage(response),
          errorStatus: response.status,
        })
        return
      }

      setState({
        status: 'ready',
        data: response.data,
        errorMessage: null,
        errorStatus: null,
      })
    })()

    return () => {
      abortController.abort()
    }
  }, [inventoryId, isEnabled, reloadToken])

  return useMemo(
    () => {
      if (!positiveIntegerPattern.test(inventoryId)) {
        return {
          status: 'error',
          data: null,
          errorMessage: 'Inventory id must be a positive numeric string.',
          errorStatus: null,
          retryLoad,
        } satisfies InventoryStatisticsModel
      }

      return {
        ...state,
        retryLoad,
      } satisfies InventoryStatisticsModel
    },
    [inventoryId, retryLoad, state],
  )
}
