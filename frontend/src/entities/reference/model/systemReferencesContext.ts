import { createContext } from 'react'
import type {
  InventoryCategoryOption,
  InventoryCategoryReference,
  SystemHealthStatus,
} from './types.ts'

export type SystemReferencesStatus = 'loading' | 'ready' | 'error'

export type SystemReferencesState = {
  status: SystemReferencesStatus
  health: SystemHealthStatus | null
  categories: ReadonlyArray<InventoryCategoryReference>
  categoriesById: Record<string, InventoryCategoryReference>
  categoryOptions: ReadonlyArray<InventoryCategoryOption>
  errorMessage: string | null
}

export type SystemReferencesContextValue = SystemReferencesState & {
  retryBootstrap: () => void
  getCategoryById: (categoryId: number | string | null | undefined) => InventoryCategoryReference | null
}

export const systemReferencesContext = createContext<SystemReferencesContextValue | null>(null)
