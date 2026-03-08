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

function formatProviderLabel(provider: string): string {
  if (provider === 'google') {
    return 'Google'
  }

  if (provider === 'facebook') {
    return 'Facebook'
  }

  return provider.slice(0, 1).toUpperCase() + provider.slice(1)
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
    [providers],
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
      <Tooltip title={errorMessage ?? 'Failed to load social login providers.'}>
        <Button
          size="small"
          icon={<ReloadOutlined />}
          onClick={retryProvidersBootstrap}
          disabled={disabled || isRedirecting}
        >
          Retry Login
        </Button>
      </Tooltip>
    )
  }

  if (status === 'loading') {
    return (
      <Button
        size="small"
        icon={<LoginOutlined />}
        loading
        disabled
      >
        Loading Login
      </Button>
    )
  }

  if (providers.length === 0) {
    return (
      <Tooltip title="No social providers are available in backend configuration.">
        <Button
          size="small"
          icon={<LoginOutlined />}
          disabled
        >
          Sign In
        </Button>
      </Tooltip>
    )
  }

  if (providers.length === 1) {
    const provider = providers[0]

    return (
      <Button
        type="primary"
        size="small"
        icon={<LoginOutlined />}
        loading={isRedirecting}
        disabled={disabled || isRedirecting}
        onClick={() => handleProviderClick(provider)}
      >
        Sign in with {formatProviderLabel(provider)}
      </Button>
    )
  }

  const defaultProvider = providers[0]

  return (
    <Dropdown.Button
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
      Sign in with {formatProviderLabel(defaultProvider)}
    </Dropdown.Button>
  )
}
