import { App as AntdApp, ConfigProvider, theme as antdThemeRuntime } from 'antd'
import ruRU from 'antd/locale/ru_RU'
import { useEffect, useMemo } from 'react'
import type { PropsWithChildren } from 'react'
import { useUiPreferences } from '../../features/preferences/model/uiPreferencesStore.tsx'
import { createAntdTheme } from '../../shared/ui/theme/antdTheme.ts'

type AntdConfigProviderProps = PropsWithChildren

export function AntdConfigProvider({ children }: AntdConfigProviderProps) {
  const { theme } = useUiPreferences()
  const normalizedTheme = theme === 'dark' ? 'dark' : 'light'

  const configuredTheme = useMemo(
    () => ({
      ...createAntdTheme(normalizedTheme),
      algorithm:
        normalizedTheme === 'dark'
          ? antdThemeRuntime.darkAlgorithm
          : antdThemeRuntime.defaultAlgorithm,
    }),
    [normalizedTheme],
  )

  useEffect(() => {
    document.documentElement.lang = 'ru'
    document.documentElement.dataset.uiTheme = normalizedTheme
  }, [normalizedTheme])

  return (
    <ConfigProvider theme={configuredTheme} locale={ruRU}>
      <AntdApp>{children}</AntdApp>
    </ConfigProvider>
  )
}

