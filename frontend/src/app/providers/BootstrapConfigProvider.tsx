import type { PropsWithChildren } from 'react'
import type { AppBootstrapConfig } from '../../shared/config/bootstrap.ts'
import { bootstrapConfigContext } from './bootstrapConfigContext.ts'

type BootstrapConfigProviderProps = PropsWithChildren<{
  value: AppBootstrapConfig
}>

export function BootstrapConfigProvider({ value, children }: BootstrapConfigProviderProps) {
  return <bootstrapConfigContext.Provider value={value}>{children}</bootstrapConfigContext.Provider>
}
