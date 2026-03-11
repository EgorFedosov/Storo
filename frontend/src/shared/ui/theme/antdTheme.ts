import type { ThemeConfig } from 'antd'

type UiTheme = 'light' | 'dark'

export function createAntdTheme(theme: UiTheme): ThemeConfig {
  const isDark = theme === 'dark'

  return {
    token: {
      colorPrimary: '#0f4c81',
      colorInfo: '#0f4c81',
      borderRadius: 10,
      fontFamily: '"Segoe UI", "Inter", sans-serif',
      ...(isDark
        ? {
            colorBgLayout: '#020617',
          }
        : {
            colorBgLayout: '#f3f5f9',
          }),
    },
    components: {
      Layout: isDark
        ? {
            bodyBg: '#020617',
          }
        : {
            headerBg: '#ffffff',
            bodyBg: '#f3f5f9',
          },
      Menu: {
        itemBorderRadius: 8,
        horizontalItemSelectedColor: '#0f4c81',
      },
      Table: isDark
        ? {
            headerBg: '#0f172a',
            headerSplitColor: '#1f2937',
            rowHoverBg: '#1e293b',
          }
        : {
            headerBg: '#f8fafc',
            headerSplitColor: '#e5e7eb',
            rowHoverBg: '#f8fbff',
          },
      Card: {
        bodyPadding: 20,
      },
    },
  }
}

