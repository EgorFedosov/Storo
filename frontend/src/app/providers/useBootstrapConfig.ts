import { useContext } from 'react'
import type { AppBootstrapConfig } from '../../shared/config/bootstrap.ts'
import { bootstrapConfigContext } from './bootstrapConfigContext.ts'

export function useBootstrapConfig(): AppBootstrapConfig {
  const contextValue = useContext(bootstrapConfigContext)

  if (contextValue === null) {
    throw new Error('useBootstrapConfig must be used within BootstrapConfigProvider.')
  }

  return contextValue
}
