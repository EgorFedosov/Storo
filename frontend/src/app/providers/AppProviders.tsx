import type { PropsWithChildren } from 'react'
import type { AppBootstrapConfig } from '../../shared/config/bootstrap.ts'
import { AuthProvider } from '../../features/auth/model/authStore.tsx'
import { SystemReferencesProvider } from '../../entities/reference/model/systemReferencesStore.tsx'
import { UiPreferencesProvider } from '../../features/preferences/model/uiPreferencesStore.tsx'
import { AntdConfigProvider } from './AntdConfigProvider.tsx'
import { BootstrapConfigProvider } from './BootstrapConfigProvider.tsx'

type AppProvidersProps = PropsWithChildren<{
  bootstrapConfig: AppBootstrapConfig
}>

export function AppProviders({ bootstrapConfig, children }: AppProvidersProps) {
  return (
    <BootstrapConfigProvider value={bootstrapConfig}>
      <SystemReferencesProvider>
        <AuthProvider>
          <UiPreferencesProvider>
            <AntdConfigProvider>{children}</AntdConfigProvider>
          </UiPreferencesProvider>
        </AuthProvider>
      </SystemReferencesProvider>
    </BootstrapConfigProvider>
  )
}