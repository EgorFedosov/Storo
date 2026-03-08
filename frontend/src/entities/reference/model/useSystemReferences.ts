import { useContext } from 'react'
import {
  systemReferencesContext,
  type SystemReferencesContextValue,
} from './systemReferencesContext.ts'

export function useSystemReferences(): SystemReferencesContextValue {
  const contextValue = useContext(systemReferencesContext)

  if (contextValue === null) {
    throw new Error('useSystemReferences must be used within SystemReferencesProvider.')
  }

  return contextValue
}
