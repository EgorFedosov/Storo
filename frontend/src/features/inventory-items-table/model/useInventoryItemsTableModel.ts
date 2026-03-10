import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  requestInventoryItemsTable,
  type InventoryItemsTableRequestResult,
} from '../../../entities/inventory/model/inventoryItemsTableApi.ts'
import type {
  InventoryItemsTableColumn,
  InventoryItemsTablePage,
  InventoryItemsTableRow,
  InventoryItemsTableSortDirection,
  InventoryItemsTableSortField,
} from '../../../entities/inventory/model/inventoryItemsTableTypes.ts'

type InventoryItemsTableStatus = 'idle' | 'loading' | 'ready' | 'error'

type InventoryItemsTableState = {
  status: InventoryItemsTableStatus
  data: InventoryItemsTablePage | null
  errorMessage: string | null
  errorStatus: number | null
}

type InventoryItemsTableQuery = {
  page: number
  pageSize: number
  sortField: InventoryItemsTableSortField
  sortDirection: InventoryItemsTableSortDirection
}

export type InventoryItemsTableModel = InventoryItemsTableState & InventoryItemsTableQuery & {
  columns: ReadonlyArray<InventoryItemsTableColumn>
  rows: ReadonlyArray<InventoryItemsTableRow>
  totalCount: number
  retryLoad: () => void
  handlePageChange: (nextPage: number, nextPageSize: number) => void
  handleSortFieldChange: (nextSortField: InventoryItemsTableSortField) => void
  handleSortDirectionChange: (nextSortDirection: InventoryItemsTableSortDirection) => void
}

const defaultPage = 1
const defaultPageSize = 20
const defaultSortField: InventoryItemsTableSortField = 'updatedAt'
const defaultSortDirection: InventoryItemsTableSortDirection = 'desc'

const positiveIntegerPattern = /^[1-9]\d*$/

const initialState: InventoryItemsTableState = {
  status: 'idle',
  data: null,
  errorMessage: null,
  errorStatus: null,
}

const initialQuery: InventoryItemsTableQuery = {
  page: defaultPage,
  pageSize: defaultPageSize,
  sortField: defaultSortField,
  sortDirection: defaultSortDirection,
}

function normalizePage(value: number, fallback: number): number {
  return Number.isSafeInteger(value) && value > 0 ? value : fallback
}

function normalizePageSize(value: number, fallback: number): number {
  return Number.isSafeInteger(value) && value >= 1 && value <= 100 ? value : fallback
}

function toFailureMessage(failure: InventoryItemsTableRequestResult & { ok: false }): string {
  if (failure.status === 404) {
    return 'Inventory items were not found.'
  }

  if (failure.status === 400) {
    return failure.message
  }

  if (failure.status === 0) {
    return failure.message.trim().length > 0
      ? failure.message
      : 'Items table request failed before reaching API.'
  }

  return failure.message
}

export function useInventoryItemsTableModel(
  inventoryId: string,
  enabled: boolean,
): InventoryItemsTableModel {
  const [state, setState] = useState<InventoryItemsTableState>(initialState)
  const [query, setQuery] = useState<InventoryItemsTableQuery>(initialQuery)
  const [reloadToken, setReloadToken] = useState(0)

  const requestSequenceRef = useRef(0)
  const requestAbortControllerRef = useRef<AbortController | null>(null)

  const retryLoad = useCallback(() => {
    setReloadToken((currentValue) => currentValue + 1)
  }, [])

  const handlePageChange = useCallback((nextPage: number, nextPageSize: number) => {
    setQuery((currentQuery) => {
      const normalizedPageSize = normalizePageSize(nextPageSize, currentQuery.pageSize)
      const normalizedPage = normalizePage(nextPage, currentQuery.page)
      const page = normalizedPageSize !== currentQuery.pageSize ? 1 : normalizedPage

      return {
        ...currentQuery,
        page,
        pageSize: normalizedPageSize,
      }
    })
  }, [])

  const handleSortFieldChange = useCallback((nextSortField: InventoryItemsTableSortField) => {
    setQuery((currentQuery) => ({
      ...currentQuery,
      page: 1,
      sortField: nextSortField,
    }))
  }, [])

  const handleSortDirectionChange = useCallback((nextSortDirection: InventoryItemsTableSortDirection) => {
    setQuery((currentQuery) => ({
      ...currentQuery,
      page: 1,
      sortDirection: nextSortDirection,
    }))
  }, [])

  useEffect(
    () => () => {
      requestAbortControllerRef.current?.abort()
    },
    [],
  )

  useEffect(() => {
    requestAbortControllerRef.current?.abort()

    if (!enabled || !positiveIntegerPattern.test(inventoryId)) {
      return
    }

    requestSequenceRef.current += 1
    const requestId = requestSequenceRef.current

    const abortController = new AbortController()
    requestAbortControllerRef.current = abortController

    void (async () => {
      setState((currentState) => ({
        ...currentState,
        status: 'loading',
        errorMessage: null,
        errorStatus: null,
      }))

      const response = await requestInventoryItemsTable(
        inventoryId,
        query,
        abortController.signal,
      )

      if (abortController.signal.aborted || requestId !== requestSequenceRef.current) {
        return
      }

      if (!response.ok) {
        setState((currentState) => ({
          ...currentState,
          status: 'error',
          errorMessage: toFailureMessage(response),
          errorStatus: response.status,
        }))
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
  }, [enabled, inventoryId, query, reloadToken])

  return useMemo(
    () => {
      if (!positiveIntegerPattern.test(inventoryId)) {
        return {
          ...initialState,
          status: 'error',
          errorMessage: 'Inventory id must be a positive numeric string.',
          errorStatus: null,
          ...query,
          columns: [],
          rows: [],
          totalCount: 0,
          retryLoad,
          handlePageChange,
          handleSortFieldChange,
          handleSortDirectionChange,
        } satisfies InventoryItemsTableModel
      }

      return {
        ...state,
        ...query,
        columns: state.data?.columns ?? [],
        rows: state.data?.rows ?? [],
        totalCount: state.data?.totalCount ?? 0,
        retryLoad,
        handlePageChange,
        handleSortFieldChange,
        handleSortDirectionChange,
      } satisfies InventoryItemsTableModel
    },
    [
      handlePageChange,
      handleSortDirectionChange,
      handleSortFieldChange,
      inventoryId,
      query,
      retryLoad,
      state,
    ],
  )
}
