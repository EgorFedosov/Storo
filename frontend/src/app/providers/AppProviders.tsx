import type { PropsWithChildren } from 'react'
import type { AppBootstrapConfig } from '../../shared/config/bootstrap.ts'
import { BootstrapConfigProvider } from './BootstrapConfigProvider.tsx'

type AppProvidersProps = PropsWithChildren<{
  bootstrapConfig: AppBootstrapConfig
}>

export function AppProviders({ bootstrapConfig, children }: AppProvidersProps) {
  return <BootstrapConfigProvider value={bootstrapConfig}>{children}</BootstrapConfigProvider>
}
