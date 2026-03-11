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
import { SocialLoginControl } from '../../features/auth/ui/SocialLoginControl.tsx'
import { UserPreferencesControl } from '../../features/preferences/ui/UserPreferencesControl.tsx'
import { GlobalSearchEntry } from '../../features/search-navigation/ui/GlobalSearchEntry.tsx'
import { useSystemReferences } from '../../entities/reference/model/useSystemReferences.ts'
import {
  shellNavigationModel,
  type AppShellNavKey,
} from '../../shared/config/routes.ts'
import { navigate, useLocationSnapshot } from '../../shared/lib/router/navigation.ts'
import { useShellLayoutState } from '../model/useShellLayoutState.ts'

const navigationIcons: Record<AppShellNavKey, ReactNode> = {
  home: <HomeOutlined />,
  searchInventories: <SearchOutlined />,
  searchItems: <SearchOutlined />,
  myInventories: <UserSwitchOutlined />,
  adminUsers: <TeamOutlined />,
}

export function AppShell() {
  const locationSnapshot = useLocationSnapshot()
  const { route, selectedNavigationKeys } = useShellLayoutState(locationSnapshot.pathname)
  const {
    errorMessage: referencesErrorMessage,
    retryBootstrap: retryReferencesBootstrap,
    status: referencesStatus,
  } = useSystemReferences()
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
          label: navRoute.key === 'home'
            ? 'Главная'
            : navRoute.key === 'searchInventories'
              ? 'Поиск инвентарей'
              : navRoute.key === 'searchItems'
                ? 'Поиск предметов'
                : navRoute.key === 'myInventories'
                  ? 'Мои инвентари'
                  : 'Пользователи',
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
    ? 'Проверка входа'
    : isAuthenticated
      ? 'Вы вошли'
      : 'Гость'

  return (
    <Layout className="app-shell-layout">
      <Layout.Header className="app-shell-header">
        <div className="app-shell-title">
          <Typography.Title className="app-shell-title-text" level={4}>
            <Typography.Link
              className="app-shell-title-link"
              onClick={() => navigate('/home')}
            >
              Storo
            </Typography.Link>
          </Typography.Title>
        </div>

        <GlobalSearchEntry
          pathname={locationSnapshot.pathname}
          search={locationSnapshot.search}
          disabled={referencesStatus === 'loading'}
        />

        <Space size="small" wrap className="app-shell-header-meta">
          <Tag color={authStatusColor}>{authStatusLabel}</Tag>
          <SocialLoginControl
            isAuthenticated={isAuthenticated}
            pathname={locationSnapshot.pathname}
            search={locationSnapshot.search}
            hash={locationSnapshot.hash}
            disabled={status === 'loading'}
          />
          <UserPreferencesControl />
          <Avatar icon={<UserOutlined />} size="small" />
          <Typography.Text className="app-shell-user-name" strong>
            {currentUser.displayName}
          </Typography.Text>
          <Typography.Text className="app-shell-user-roles">
            {currentUser.roles.length > 0 ? currentUser.roles.join(', ') : 'гость'}
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
        {referencesErrorMessage !== null ? (
          <Alert
            showIcon
            type="warning"
            message="Не удалось загрузить справочные данные"
            description={referencesErrorMessage}
            action={(
              <Button type="primary" size="small" onClick={retryReferencesBootstrap}>
                Повторить
              </Button>
            )}
            style={{ marginBottom: 16 }}
          />
        ) : null}

        {errorMessage !== null ? (
          <Alert
            showIcon
            type="error"
            message="Не удалось загрузить данные пользователя"
            description={errorMessage}
            action={(
              <Button type="primary" size="small" onClick={retryBootstrap}>
                Повторить
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
            title="Доступ запрещен"
            subTitle="У текущего пользователя нет прав на открытие этой страницы."
          />
        )}
      </Layout.Content>
    </Layout>
  )
}
