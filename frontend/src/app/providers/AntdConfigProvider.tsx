import { App as AntdApp, ConfigProvider, theme as antdThemeRuntime } from 'antd'
import { useEffect, useMemo } from 'react'
import type { PropsWithChildren } from 'react'
import { useCurrentUser } from '../../features/auth/model/useCurrentUser.ts'
import { antdTheme } from '../../shared/ui/theme/antdTheme.ts'

type AntdConfigProviderProps = PropsWithChildren

export function AntdConfigProvider({ children }: AntdConfigProviderProps) {
  const { currentUser } = useCurrentUser()
  const normalizedLanguage = currentUser.language.trim().toLowerCase() || 'en'
  const normalizedTheme = currentUser.theme === 'dark' ? 'dark' : 'light'

  const configuredTheme = useMemo(
    () => ({
      ...antdTheme,
      algorithm:
        normalizedTheme === 'dark'
          ? antdThemeRuntime.darkAlgorithm
          : antdThemeRuntime.defaultAlgorithm,
    }),
    [normalizedTheme],
  )

  useEffect(() => {
    document.documentElement.lang = normalizedLanguage
    document.documentElement.dataset.uiTheme = normalizedTheme
  }, [normalizedLanguage, normalizedTheme])

  return (
    <ConfigProvider theme={configuredTheme}>
      <AntdApp>{children}</AntdApp>
    </ConfigProvider>
  )
}
