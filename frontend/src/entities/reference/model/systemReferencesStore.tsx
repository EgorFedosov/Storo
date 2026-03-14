import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import type { PropsWithChildren } from 'react'
import { apiRequest } from '../../../shared/api/httpClient.ts'
import { toLocalizedCategoryName } from '../../../shared/lib/categoryName.ts'
import {
  systemReferencesContext,
  type SystemReferencesContextValue,
  type SystemReferencesState,
} from './systemReferencesContext.ts'
import type {
  InventoryCategoryOption,
  InventoryCategoryReference,
  SystemHealthStatus,
} from './types.ts'

type SystemReferencesStateAction =
  | { type: 'bootstrap_started' }
  | {
      type: 'bootstrap_succeeded'
      payload: {
        health: SystemHealthStatus
        categories: ReadonlyArray<InventoryCategoryReference>
      }
    }
  | { type: 'bootstrap_failed'; payload: { errorMessage: string } }

const initialSystemReferencesState: SystemReferencesState = {
  status: 'loading',
  health: null,
  categories: [],
  categoriesById: {},
  categoryOptions: [],
  errorMessage: null,
}

function createCategoriesById(
  categories: ReadonlyArray<InventoryCategoryReference>,
): Record<string, InventoryCategoryReference> {
  const categoriesById: Record<string, InventoryCategoryReference> = {}

  for (const category of categories) {
    categoriesById[String(category.id)] = category
  }

  return categoriesById
}

function createCategoryOptions(
  categories: ReadonlyArray<InventoryCategoryReference>,
): InventoryCategoryOption[] {
  return categories.map((category) => ({
    value: category.id,
    label: category.name,
  }))
}

function systemReferencesStateReducer(
  state: SystemReferencesState,
  action: SystemReferencesStateAction,
): SystemReferencesState {
  switch (action.type) {
    case 'bootstrap_started':
      return {
        ...state,
        status: 'loading',
        errorMessage: null,
      }
    case 'bootstrap_succeeded': {
      const categoriesById = createCategoriesById(action.payload.categories)
      return {
        status: 'ready',
        health: action.payload.health,
        categories: action.payload.categories,
        categoriesById,
        categoryOptions: createCategoryOptions(action.payload.categories),
        errorMessage: null,
      }
    }
    case 'bootstrap_failed':
      return {
        ...state,
        status: 'error',
        errorMessage: action.payload.errorMessage,
      }
    default:
      return state
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalizedValue = value.trim()
  return normalizedValue.length > 0 ? normalizedValue : null
}

function normalizePositiveInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value
  }

  if (typeof value !== 'string') {
    return null
  }

  const normalizedValue = value.trim()
  if (!/^[1-9]\d*$/.test(normalizedValue)) {
    return null
  }

  const parsedValue = Number(normalizedValue)
  return Number.isSafeInteger(parsedValue) ? parsedValue : null
}

function normalizeUtcIsoDate(value: unknown): string | null {
  const normalizedValue = normalizeNonEmptyString(value)
  if (normalizedValue === null) {
    return null
  }

  return Number.isNaN(Date.parse(normalizedValue)) ? null : normalizedValue
}

function normalizePingPayload(payload: unknown): SystemHealthStatus | null {
  if (!isRecord(payload)) {
    return null
  }

  const message = normalizeNonEmptyString(payload.message)
  const utcNow = normalizeUtcIsoDate(payload.utcNow)

  if (message === null || utcNow === null) {
    return null
  }

  return {
    message,
    utcNow,
  }
}

function normalizeCategoriesPayload(payload: unknown): InventoryCategoryReference[] | null {
  if (!isRecord(payload) || !Array.isArray(payload.categories)) {
    return null
  }

  const seenIds = new Set<number>()
  const normalizedCategories: InventoryCategoryReference[] = []

  for (const rawCategory of payload.categories) {
    if (!isRecord(rawCategory)) {
      return null
    }

    const id = normalizePositiveInteger(rawCategory.id)
    const categoryName = normalizeNonEmptyString(rawCategory.name)

    if (id === null || categoryName === null || seenIds.has(id)) {
      return null
    }

    seenIds.add(id)
    normalizedCategories.push({
      id,
      name: toLocalizedCategoryName(categoryName),
    })
  }

  normalizedCategories.sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }))

  return normalizedCategories
}

function normalizeBootstrapFailure(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim()
  }

  return 'Не удалось инициализировать системные справочники.'
}

function normalizeCategoryId(categoryId: number | string | null | undefined): string | null {
  if (categoryId === null || categoryId === undefined) {
    return null
  }

  const normalizedId = normalizePositiveInteger(categoryId)
  return normalizedId === null ? null : String(normalizedId)
}

export function SystemReferencesProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(systemReferencesStateReducer, initialSystemReferencesState)
  const requestSequenceRef = useRef(0)
  const requestAbortControllerRef = useRef<AbortController | null>(null)

  const bootstrapSystemReferences = useCallback(() => {
    requestSequenceRef.current += 1
    const requestId = requestSequenceRef.current

    requestAbortControllerRef.current?.abort()
    const abortController = new AbortController()
    requestAbortControllerRef.current = abortController

    dispatch({ type: 'bootstrap_started' })

    void (async () => {
      try {
        const [pingResult, categoriesResult] = await Promise.all([
          apiRequest<unknown>('/ping', { signal: abortController.signal }),
          apiRequest<unknown>('/categories', { signal: abortController.signal }),
        ])

        if (abortController.signal.aborted || requestId !== requestSequenceRef.current) {
          return
        }

        if (!pingResult.ok) {
          dispatch({
            type: 'bootstrap_failed',
            payload: { errorMessage: pingResult.error.message },
          })
          return
        }

        if (!categoriesResult.ok) {
          dispatch({
            type: 'bootstrap_failed',
            payload: { errorMessage: categoriesResult.error.message },
          })
          return
        }

        const normalizedHealth = normalizePingPayload(pingResult.data)
        if (normalizedHealth === null) {
          dispatch({
            type: 'bootstrap_failed',
            payload: { errorMessage: 'Получен некорректный формат ответа от /ping.' },
          })
          return
        }

        const normalizedCategories = normalizeCategoriesPayload(categoriesResult.data)
        if (normalizedCategories === null) {
          dispatch({
            type: 'bootstrap_failed',
            payload: { errorMessage: 'Получен некорректный формат ответа от /categories.' },
          })
          return
        }

        dispatch({
          type: 'bootstrap_succeeded',
          payload: {
            health: normalizedHealth,
            categories: normalizedCategories,
          },
        })
      } catch (error) {
        if (abortController.signal.aborted || requestId !== requestSequenceRef.current) {
          return
        }

        dispatch({
          type: 'bootstrap_failed',
          payload: { errorMessage: normalizeBootstrapFailure(error) },
        })
      }
    })()
  }, [])

  useEffect(() => {
    bootstrapSystemReferences()

    return () => {
      requestAbortControllerRef.current?.abort()
    }
  }, [bootstrapSystemReferences])

  const getCategoryById = useCallback(
    (categoryId: number | string | null | undefined): InventoryCategoryReference | null => {
      const normalizedId = normalizeCategoryId(categoryId)
      if (normalizedId === null) {
        return null
      }

      return state.categoriesById[normalizedId] ?? null
    },
    [state.categoriesById],
  )

  const contextValue = useMemo<SystemReferencesContextValue>(
    () => ({
      ...state,
      retryBootstrap: bootstrapSystemReferences,
      getCategoryById,
    }),
    [state, bootstrapSystemReferences, getCategoryById],
  )

  return (
    <systemReferencesContext.Provider value={contextValue}>
      {children}
    </systemReferencesContext.Provider>
  )
}

