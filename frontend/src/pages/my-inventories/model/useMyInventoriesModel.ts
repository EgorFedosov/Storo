import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchCurrentUserInventories } from './api.ts'
import {
  createDefaultUserInventoriesQueryState,
  inventoryRelations,
  myInventoriesContract,
  type InventoryRelation,
  type UserInventoriesPageData,
  type UserInventoriesQueryState,
  type UserInventoriesSortDirection,
  type UserInventoriesSortField,
} from './contracts.ts'

export type RelationTableStatus = 'loading' | 'ready' | 'error'

export type RelationTableState = {
  controls: UserInventoriesQueryState
  draftQuery: string
  status: RelationTableStatus
  errorMessage: string | null
  data: UserInventoriesPageData | null
}

type RelationGridStateInput = {
  page: number
  pageSize: number
  sortField: UserInventoriesSortField
  sortDirection: UserInventoriesSortDirection
}

type MyInventoriesTablesState = Record<InventoryRelation, RelationTableState>

type RelationRequestControl = {
  requestId: number
  abortController: AbortController | null
}

type RequestControlMap = Record<InventoryRelation, RelationRequestControl>

function createInitialRelationState(): RelationTableState {
  const defaultControls = createDefaultUserInventoriesQueryState()

  return {
    controls: defaultControls,
    draftQuery: defaultControls.query,
    status: 'loading',
    errorMessage: null,
    data: null,
  }
}

function createInitialTablesState(): MyInventoriesTablesState {
  return {
    owned: createInitialRelationState(),
    writable: createInitialRelationState(),
  }
}

function createRequestControlMap(): RequestControlMap {
  return {
    owned: { requestId: 0, abortController: null },
    writable: { requestId: 0, abortController: null },
  }
}

function normalizePage(value: number): number {
  return Number.isInteger(value) && value >= 1
    ? value
    : myInventoriesContract.defaultPage
}

function normalizePageSize(value: number): number {
  return Number.isInteger(value) && value >= 1 && value <= myInventoriesContract.maxPageSize
    ? value
    : myInventoriesContract.defaultPageSize
}

export function useMyInventoriesModel() {
  const [tables, setTables] = useState<MyInventoriesTablesState>(() => createInitialTablesState())
  const tablesRef = useRef(tables)
  const requestControlsRef = useRef<RequestControlMap>(createRequestControlMap())

  useEffect(() => {
    tablesRef.current = tables
  }, [tables])

  const setRelationState = useCallback(
    (
      relation: InventoryRelation,
      updater: (state: RelationTableState) => RelationTableState,
    ) => {
      setTables((currentTables) => ({
        ...currentTables,
        [relation]: updater(currentTables[relation]),
      }))
    },
    [],
  )

  const loadRelationData = useCallback(
    async (relation: InventoryRelation, controls: UserInventoriesQueryState) => {
      const requestControls = requestControlsRef.current[relation]
      requestControls.requestId += 1
      const requestId = requestControls.requestId

      requestControls.abortController?.abort()
      const abortController = new AbortController()
      requestControls.abortController = abortController

      const result = await fetchCurrentUserInventories(relation, controls, abortController.signal)

      if (
        abortController.signal.aborted
        || requestId !== requestControlsRef.current[relation].requestId
      ) {
        return
      }

      if (!result.ok) {
        setRelationState(relation, (state) => ({
          ...state,
          status: 'error',
          errorMessage: result.errorMessage,
        }))
        return
      }

      setRelationState(relation, (state) => ({
        ...state,
        status: 'ready',
        errorMessage: null,
        data: result.data,
        controls: {
          ...state.controls,
          page: result.data.page,
          pageSize: result.data.pageSize,
          sortField: result.data.sort.field,
          sortDirection: result.data.sort.direction,
        },
      }))
    },
    [setRelationState],
  )

  useEffect(() => {
    const requestControls = requestControlsRef.current

    return () => {
      for (const relation of inventoryRelations) {
        requestControls[relation].abortController?.abort()
      }
    }
  }, [])

  const ownedControls = tables.owned.controls
  const ownedQuery = ownedControls.query
  const ownedPage = ownedControls.page
  const ownedPageSize = ownedControls.pageSize
  const ownedSortField = ownedControls.sortField
  const ownedSortDirection = ownedControls.sortDirection

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRelationData('owned', {
      query: ownedQuery,
      page: ownedPage,
      pageSize: ownedPageSize,
      sortField: ownedSortField,
      sortDirection: ownedSortDirection,
    })
  }, [
    loadRelationData,
    ownedQuery,
    ownedPage,
    ownedPageSize,
    ownedSortField,
    ownedSortDirection,
  ])

  const writableControls = tables.writable.controls
  const writableQuery = writableControls.query
  const writablePage = writableControls.page
  const writablePageSize = writableControls.pageSize
  const writableSortField = writableControls.sortField
  const writableSortDirection = writableControls.sortDirection

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRelationData('writable', {
      query: writableQuery,
      page: writablePage,
      pageSize: writablePageSize,
      sortField: writableSortField,
      sortDirection: writableSortDirection,
    })
  }, [
    loadRelationData,
    writableQuery,
    writablePage,
    writablePageSize,
    writableSortField,
    writableSortDirection,
  ])

  const updateDraftQuery = useCallback(
    (relation: InventoryRelation, query: string) => {
      setRelationState(relation, (state) => ({
        ...state,
        draftQuery: query,
      }))
    },
    [setRelationState],
  )

  const applyQuery = useCallback(
    (relation: InventoryRelation) => {
      const draftQuery = tablesRef.current[relation].draftQuery.trim()

      setRelationState(relation, (state) => ({
        ...state,
        status: 'loading',
        errorMessage: null,
        controls: {
          ...state.controls,
          query: draftQuery,
          page: myInventoriesContract.defaultPage,
        },
      }))
    },
    [setRelationState],
  )

  const resetQuery = useCallback(
    (relation: InventoryRelation) => {
      setRelationState(relation, (state) => ({
        ...state,
        status: 'loading',
        errorMessage: null,
        draftQuery: '',
        controls: {
          ...state.controls,
          query: '',
          page: myInventoriesContract.defaultPage,
        },
      }))
    },
    [setRelationState],
  )

  const updateGridState = useCallback(
    (relation: InventoryRelation, nextGridState: RelationGridStateInput) => {
      const normalizedPageSize = normalizePageSize(nextGridState.pageSize)
      const normalizedPage = normalizePage(nextGridState.page)

      setRelationState(relation, (state) => ({
        ...state,
        status: 'loading',
        errorMessage: null,
        controls: {
          ...state.controls,
          page: normalizedPage,
          pageSize: normalizedPageSize,
          sortField: nextGridState.sortField,
          sortDirection: nextGridState.sortDirection,
        },
      }))
    },
    [setRelationState],
  )

  const refreshRelation = useCallback(
    (relation: InventoryRelation) => {
      const controls = tablesRef.current[relation].controls
      setRelationState(relation, (state) => ({
        ...state,
        status: 'loading',
        errorMessage: null,
      }))
      void loadRelationData(relation, controls)
    },
    [loadRelationData, setRelationState],
  )

  return {
    tables,
    updateDraftQuery,
    applyQuery,
    resetQuery,
    updateGridState,
    refreshRelation,
  }
}
