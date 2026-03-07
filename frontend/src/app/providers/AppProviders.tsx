import type { PropsWithChildren } from 'react'
import type { AppBootstrapConfig } from '../../shared/config/bootstrap.ts'
import { AuthProvider } from '../../features/auth/model/authStore.tsx'
import { AntdConfigProvider } from './AntdConfigProvider.tsx'
import { BootstrapConfigProvider } from './BootstrapConfigProvider.tsx'

type AppProvidersProps = PropsWithChildren<{
  bootstrapConfig: AppBootstrapConfig
}>

export function AppProviders({ bootstrapConfig, children }: AppProvidersProps) {
  return (
    <BootstrapConfigProvider value={bootstrapConfig}>
      <AuthProvider>
        <AntdConfigProvider>{children}</AntdConfigProvider>
      </AuthProvider>
    </BootstrapConfigProvider>
  )
}
