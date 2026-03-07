import type { PropsWithChildren } from 'react'
import { App as AntdApp, ConfigProvider } from 'antd'
import { antdTheme } from '../../shared/ui/theme/antdTheme.ts'

type AntdConfigProviderProps = PropsWithChildren

export function AntdConfigProvider({ children }: AntdConfigProviderProps) {
  return (
    <ConfigProvider theme={antdTheme}>
      <AntdApp>{children}</AntdApp>
    </ConfigProvider>
  )
}
