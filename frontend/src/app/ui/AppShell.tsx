import {
  HomeOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons'
import { Alert, Avatar, Button, Layout, Menu, Result, Spin, Space, Tag, Typography } from 'antd'
import type { ReactNode } from 'react'
import { Suspense, useMemo } from 'react'
import { canAccessRoute } from '../../features/auth/model/authStore.tsx'
import { useCurrentUser } from '../../features/auth/model/useCurrentUser.ts'
import {
  shellNavigationModel,
  type AppShellNavKey,
} from '../../shared/config/routes.ts'
import { navigate, usePathname } from '../../shared/lib/router/navigation.ts'
import { useShellLayoutState } from '../model/useShellLayoutState.ts'

const navigationIcons: Record<AppShellNavKey, ReactNode> = {
  home: <HomeOutlined />,
  searchInventories: <SearchOutlined />,
  searchItems: <SearchOutlined />,
  myInventories: <UserSwitchOutlined />,
  adminUsers: <TeamOutlined />,
}

export function AppShell() {
  const pathname = usePathname()
  const { route, selectedNavigationKeys } = useShellLayoutState(pathname)
  const {
    access,
    currentUser,
    errorMessage,
    isAuthenticated,
    retryBootstrap,
    status,
  } = useCurrentUser()
  const Page = route.Page

  const canOpenRoute = canAccessRoute(route.key, access)
  const navigationItems = useMemo(
    () =>
      shellNavigationModel
        .filter((navRoute) => canAccessRoute(navRoute.key, access))
        .map((navRoute) => ({
          key: navRoute.key,
          icon: navigationIcons[navRoute.key],
          label: navRoute.label,
        })),
    [access],
  )

  const selectedNavigationKey = navigationItems.some((item) => item.key === route.navKey)
    ? selectedNavigationKeys
    : []

  const authStatusColor = status === 'loading'
    ? 'processing'
    : isAuthenticated
      ? 'success'
      : 'default'
  const authStatusLabel = status === 'loading'
    ? 'Auth Loading'
    : isAuthenticated
      ? 'Authenticated'
      : 'Guest'

  return (
    <Layout className="app-shell-layout">
      <Layout.Header className="app-shell-header">
        <div className="app-shell-title">
          <Typography.Title className="app-shell-title-text" level={4}>
            Inventory Frontend
          </Typography.Title>
          <Typography.Text className="app-shell-subtitle">
            Route skeleton for table-first inventory pages
          </Typography.Text>
        </div>

        <Space size="small" wrap>
          <Tag color={authStatusColor}>{authStatusLabel}</Tag>
          <Avatar icon={<UserOutlined />} size="small" />
          <Typography.Text className="app-shell-user-name" strong>
            {currentUser.displayName}
          </Typography.Text>
          <Typography.Text className="app-shell-user-roles">
            {currentUser.roles.length > 0 ? currentUser.roles.join(', ') : 'guest'}
          </Typography.Text>
        </Space>
      </Layout.Header>

      <Menu
        mode="horizontal"
        className="app-shell-nav"
        selectedKeys={selectedNavigationKey}
        items={navigationItems}
        onClick={({ key }) => {
          const targetRoute = shellNavigationModel.find((routeItem) => routeItem.key === key)
          if (targetRoute) {
            navigate(targetRoute.path)
          }
        }}
      />

      <Layout.Content className="app-shell-content">
        {errorMessage !== null ? (
          <Alert
            showIcon
            type="error"
            message="Auth bootstrap failed"
            description={errorMessage}
            action={(
              <Button type="primary" size="small" onClick={retryBootstrap}>
                Retry
              </Button>
            )}
            style={{ marginBottom: 16 }}
          />
        ) : null}

        {status === 'loading' ? (
          <div className="page-loader" role="status" aria-live="polite">
            <Spin size="large" />
          </div>
        ) : canOpenRoute ? (
          <Suspense
            fallback={(
              <div className="page-loader" role="status" aria-live="polite">
                <Spin size="large" />
              </div>
            )}
          >
            <Page />
          </Suspense>
        ) : (
          <Result
            status="403"
            title="Access denied"
            subTitle="Current user permissions do not allow opening this route."
          />
        )}
      </Layout.Content>
    </Layout>
  )
}
