import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  requestInventoryDetails,
  type InventoryDetailsRequestResult,
} from '../../../entities/inventory/model/inventoryDetailsApi.ts'
import type { InventoryDetails } from '../../../entities/inventory/model/types.ts'

type InventoryDetailsStatus = 'idle' | 'loading' | 'ready' | 'error'

type InventoryDetailsState = {
  status: InventoryDetailsStatus
  details: InventoryDetails | null
  etag: string | null
  errorMessage: string | null
  errorStatus: number | null
}

type InventoryDetailsModel = InventoryDetailsState & {
  retryLoad: () => void
}

const initialInventoryDetailsState: InventoryDetailsState = {
  status: 'idle',
  details: null,
  etag: null,
  errorMessage: null,
  errorStatus: null,
}

function toFailureMessage(failure: InventoryDetailsRequestResult & { ok: false }): string {
  if (failure.status === 404) {
    return 'Inventory was not found.'
  }

  if (failure.status === 400) {
    return failure.message
  }

  if (failure.status === 0) {
    return failure.message.trim().length > 0
      ? failure.message
      : 'Request failed before reaching API.'
  }

  return failure.message
}

export function useInventoryDetailsModel(inventoryId: string | null): InventoryDetailsModel {
  const [state, setState] = useState<InventoryDetailsState>(initialInventoryDetailsState)
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

    if (inventoryId === null) {
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
        errorMessage: null,
        errorStatus: null,
      }))

      const response = await requestInventoryDetails(inventoryId, abortController.signal)

      if (abortController.signal.aborted || requestId !== requestSequenceRef.current) {
        return
      }

      if (!response.ok) {
        setState({
          status: 'error',
          details: null,
          etag: null,
          errorMessage: toFailureMessage(response),
          errorStatus: response.status,
        })
        return
      }

      setState({
        status: 'ready',
        details: response.data,
        etag: response.etag,
        errorMessage: null,
        errorStatus: null,
      })
    })()

    return () => {
      abortController.abort()
    }
  }, [inventoryId, reloadToken])

  return useMemo(
    () => {
      if (inventoryId === null) {
        return {
          status: 'error',
          details: null,
          etag: null,
          errorMessage: 'Inventory URL must contain a positive numeric id.',
          errorStatus: null,
          retryLoad,
        } satisfies InventoryDetailsModel
      }

      return {
        ...state,
        retryLoad,
      }
    },
    [inventoryId, retryLoad, state],
  )
}
