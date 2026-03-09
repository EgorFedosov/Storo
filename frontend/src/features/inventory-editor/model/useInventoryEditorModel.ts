import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  requestInventoryEditor,
  type InventoryEditorRequestResult,
} from '../../../entities/inventory/model/inventoryEditorApi.ts'
import type { InventoryEditor } from '../../../entities/inventory/model/inventoryEditorTypes.ts'
import { useVersionedMutationModel } from '../../../shared/ui/model/useVersionedMutationModel.ts'

export type InventoryEditorStatus = 'idle' | 'loading' | 'ready' | 'error'
export type InventoryEditorTabKey = 'settings' | 'tags' | 'access' | 'customFields' | 'customIdTemplate'

export type InventoryEditorTabState = {
  key: InventoryEditorTabKey
  label: string
  disabled: boolean
}

type InventoryEditorState = {
  status: InventoryEditorStatus
  editor: InventoryEditor | null
  errorMessage: string | null
  errorStatus: number | null
}

type InventoryEditorModel = InventoryEditorState & {
  etag: string | null
  activeTabKey: InventoryEditorTabKey
  tabStates: ReadonlyArray<InventoryEditorTabState>
  setActiveTabKey: (nextTabKey: InventoryEditorTabKey) => void
  retryLoad: () => void
}

const initialState: InventoryEditorState = {
  status: 'idle',
  editor: null,
  errorMessage: null,
  errorStatus: null,
}

function toFailureMessage(failure: InventoryEditorRequestResult & { ok: false }): string {
  if (failure.status === 401) {
    return 'Sign in to open the inventory editor.'
  }

  if (failure.status === 403) {
    return 'Only the inventory creator or admin can open editor tabs.'
  }

  if (failure.status === 404) {
    return 'Inventory editor data was not found.'
  }

  if (failure.status === 400) {
    return failure.message
  }

  if (failure.status === 0) {
    return failure.message.trim().length > 0
      ? failure.message
      : 'Editor request failed before reaching API.'
  }

  return failure.message
}

function createTabStates(editor: InventoryEditor | null): ReadonlyArray<InventoryEditorTabState> {
  if (editor === null) {
    return []
  }

  return [
    {
      key: 'settings',
      label: 'Settings',
      disabled: !editor.permissions.canEditInventory,
    },
    {
      key: 'tags',
      label: 'Tags',
      disabled: !editor.permissions.canEditInventory,
    },
    {
      key: 'access',
      label: 'Access',
      disabled: !editor.permissions.canManageAccess,
    },
    {
      key: 'customFields',
      label: 'Custom Fields',
      disabled: !editor.permissions.canManageCustomFields,
    },
    {
      key: 'customIdTemplate',
      label: 'Custom ID',
      disabled: !editor.permissions.canManageCustomIdTemplate,
    },
  ] satisfies ReadonlyArray<InventoryEditorTabState>
}

function resolveActiveTab(
  requestedTab: InventoryEditorTabKey,
  tabs: ReadonlyArray<InventoryEditorTabState>,
): InventoryEditorTabKey {
  if (tabs.length === 0) {
    return requestedTab
  }

  const selectedTab = tabs.find((tab) => tab.key === requestedTab)
  if (selectedTab !== undefined && !selectedTab.disabled) {
    return selectedTab.key
  }

  const firstEnabledTab = tabs.find((tab) => !tab.disabled)
  return firstEnabledTab?.key ?? requestedTab
}

export function useInventoryEditorModel(inventoryId: string | null): InventoryEditorModel {
  const [state, setState] = useState<InventoryEditorState>(initialState)
  const [activeTabKey, setActiveTabKeyState] = useState<InventoryEditorTabKey>('settings')
  const [reloadToken, setReloadToken] = useState(0)

  const requestSequenceRef = useRef(0)
  const requestAbortControllerRef = useRef<AbortController | null>(null)

  const {
    versionStamp,
    setVersionStamp,
    resetVersionStamp,
    clearConcurrencyProblem,
  } = useVersionedMutationModel()

  const retryLoad = useCallback(() => {
    setReloadToken((currentValue) => currentValue + 1)
  }, [])

  const setActiveTabKey = useCallback((nextTabKey: InventoryEditorTabKey) => {
    setActiveTabKeyState(nextTabKey)
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
      resetVersionStamp()
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

      clearConcurrencyProblem()
      setState((currentState) => ({
        ...currentState,
        status: 'loading',
        errorMessage: null,
        errorStatus: null,
      }))

      const response = await requestInventoryEditor(inventoryId, abortController.signal)

      if (abortController.signal.aborted || requestId !== requestSequenceRef.current) {
        return
      }

      if (!response.ok) {
        resetVersionStamp()
        setState({
          status: 'error',
          editor: null,
          errorMessage: toFailureMessage(response),
          errorStatus: response.status,
        })
        return
      }

      setVersionStamp(response.versionStamp)
      setState({
        status: 'ready',
        editor: response.data,
        errorMessage: null,
        errorStatus: null,
      })
    })()

    return () => {
      abortController.abort()
    }
  }, [
    clearConcurrencyProblem,
    inventoryId,
    reloadToken,
    resetVersionStamp,
    setVersionStamp,
  ])

  const tabStates = useMemo(
    () => createTabStates(state.editor),
    [state.editor],
  )

  const normalizedActiveTabKey = useMemo(
    () => resolveActiveTab(activeTabKey, tabStates),
    [activeTabKey, tabStates],
  )

  return useMemo(
    () => {
      if (inventoryId === null) {
        return {
          status: 'error',
          editor: null,
          etag: null,
          errorMessage: 'Inventory editor URL must contain a positive numeric id.',
          errorStatus: null,
          activeTabKey: 'settings',
          tabStates: [],
          setActiveTabKey,
          retryLoad,
        } satisfies InventoryEditorModel
      }

      return {
        ...state,
        etag: versionStamp?.etag ?? null,
        activeTabKey: normalizedActiveTabKey,
        tabStates,
        setActiveTabKey,
        retryLoad,
      } satisfies InventoryEditorModel
    },
    [
      inventoryId,
      normalizedActiveTabKey,
      retryLoad,
      setActiveTabKey,
      state,
      tabStates,
      versionStamp?.etag,
    ],
  )
}
