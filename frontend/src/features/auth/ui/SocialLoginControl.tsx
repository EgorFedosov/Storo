import { LoginOutlined, ReloadOutlined } from '@ant-design/icons'
import { Button, Dropdown, Tooltip } from 'antd'
import type { MenuProps } from 'antd'
import { useCallback, useMemo } from 'react'
import { routes } from '../../../shared/config/routes.ts'
import { useSocialLoginModel } from '../model/useSocialLoginModel.ts'

type SocialLoginControlProps = {
  isAuthenticated: boolean
  pathname: string
  search: string
  hash: string
  disabled?: boolean
}

function buildReturnUrl(pathname: string, search: string, hash: string): string {
  if (pathname === routes.authError.path) {
    return routes.home.path
  }

  const normalizedPathname = pathname.startsWith('/') ? pathname : `/${pathname}`
  return `${normalizedPathname}${search}${hash}`
}

export function SocialLoginControl({
  isAuthenticated,
  pathname,
  search,
  hash,
  disabled = false,
}: SocialLoginControlProps) {
  const {
    status,
    providers,
    errorMessage,
    isRedirecting,
    retryProvidersBootstrap,
    startSocialLogin,
  } = useSocialLoginModel(!isAuthenticated)

  const returnUrl = useMemo(
    () => buildReturnUrl(pathname, search, hash),
    [hash, pathname, search],
  )

  const formatProviderLabel = useCallback(
    (provider: string): string => {
      if (provider === 'google') {
        return 'Google'
      }

      if (provider === 'facebook') {
        return 'Facebook'
      }

      return provider.slice(0, 1).toUpperCase() + provider.slice(1)
    },
    [],
  )

  const handleProviderClick = useCallback(
    (provider: string) => {
      startSocialLogin(provider, returnUrl)
    },
    [returnUrl, startSocialLogin],
  )

  const providerItems = useMemo<MenuProps['items']>(
    () =>
      providers.map((provider) => ({
        key: provider,
        label: formatProviderLabel(provider),
      })),
    [formatProviderLabel, providers],
  )

  const handleMenuClick = useCallback<NonNullable<MenuProps['onClick']>>(
    ({ key }) => {
      handleProviderClick(String(key))
    },
    [handleProviderClick],
  )

  if (isAuthenticated) {
    return null
  }

  if (status === 'error') {
    return (
      <Tooltip title={errorMessage ?? 'Не удалось загрузить провайдеров социального входа.'}>
        <Button
          className="social-login-control-btn"
          size="small"
          icon={<ReloadOutlined />}
          onClick={retryProvidersBootstrap}
          disabled={disabled || isRedirecting}
        >
          Повторить вход
        </Button>
      </Tooltip>
    )
  }

  if (status === 'loading') {
    return (
      <Button
        className="social-login-control-btn"
        size="small"
        icon={<LoginOutlined />}
        loading
        disabled
      >
        Загрузка входа
      </Button>
    )
  }

  if (providers.length === 0) {
    return (
      <Tooltip title="В текущей конфигурации бэкенда нет доступных соцпровайдеров.">
        <Button
          className="social-login-control-btn"
          size="small"
          icon={<LoginOutlined />}
          disabled
        >
          Войти
        </Button>
      </Tooltip>
    )
  }

  if (providers.length === 1) {
    const provider = providers[0]

    return (
      <Button
        className="social-login-control-btn"
        type="primary"
        size="small"
        icon={<LoginOutlined />}
        loading={isRedirecting}
        disabled={disabled || isRedirecting}
        onClick={() => handleProviderClick(provider)}
      >
        Войти через {formatProviderLabel(provider)}
      </Button>
    )
  }

  const defaultProvider = providers[0]

  return (
    <Dropdown.Button
      className="social-login-control-btn"
      type="primary"
      size="small"
      icon={<LoginOutlined />}
      loading={isRedirecting}
      disabled={disabled || isRedirecting}
      menu={{
        items: providerItems,
        onClick: handleMenuClick,
      }}
      onClick={() => handleProviderClick(defaultProvider)}
    >
      Войти через {formatProviderLabel(defaultProvider)}
    </Dropdown.Button>
  )
}

