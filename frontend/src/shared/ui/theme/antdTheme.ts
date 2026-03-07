import type { ThemeConfig } from 'antd'

export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: '#0f4c81',
    colorInfo: '#0f4c81',
    borderRadius: 10,
    colorBgLayout: '#f3f5f9',
    fontFamily: '"Segoe UI", "Inter", sans-serif',
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      bodyBg: '#f3f5f9',
    },
    Menu: {
      itemBorderRadius: 8,
      horizontalItemSelectedColor: '#0f4c81',
    },
    Table: {
      headerBg: '#f8fafc',
      headerSplitColor: '#e5e7eb',
      rowHoverBg: '#f8fbff',
    },
    Card: {
      bodyPadding: 20,
    },
  },
}
