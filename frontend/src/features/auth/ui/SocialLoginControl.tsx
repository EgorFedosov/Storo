import { GithubOutlined, GoogleOutlined, LoginOutlined, LogoutOutlined } from '@ant-design/icons'
import { Alert, Button, Divider, Form, Input, Modal, Space, Tooltip, Typography } from 'antd'
import { useCallback, useMemo, useState } from 'react'
import { apiRequest, type ApiFailure } from '../../../shared/api/httpClient.ts'
import { routes } from '../../../shared/config/routes.ts'
import { useSocialLoginModel } from '../model/useSocialLoginModel.ts'

type SocialLoginControlProps = {
  isAuthenticated: boolean
  pathname: string
  search: string
  hash: string
  disabled?: boolean
}

type AuthModalMode = 'login' | 'register'

type AuthCredentialsFormValues = {
  login: string
  password: string
  confirmPassword?: string
}

function buildReturnUrl(pathname: string, search: string, hash: string): string {
  if (pathname === routes.authError.path) {
    return routes.home.path
  }

  const normalizedPathname = pathname.startsWith('/') ? pathname : `/${pathname}`
  return `${normalizedPathname}${search}${hash}`
}

function firstValidationMessage(failure: ApiFailure): string | null {
  const errors = failure.problem?.errors ?? {}

  for (const messages of Object.values(errors)) {
    if (messages.length > 0) {
      return messages[0]
    }
  }

  return null
}

function resolveLocalAuthErrorMessage(failure: ApiFailure): string {
  const validationMessage = firstValidationMessage(failure)
  if (validationMessage !== null) {
    return validationMessage
  }

  return failure.error.message
}

export function SocialLoginControl({
  isAuthenticated,
  pathname,
  search,
  hash,
  disabled = false,
}: SocialLoginControlProps) {
  const [form] = Form.useForm<AuthCredentialsFormValues>()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [mode, setMode] = useState<AuthModalMode>('login')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(null)

  const {
    status,
    providers,
    errorMessage,
    isRedirecting,
    startSocialLogin,
  } = useSocialLoginModel(!isAuthenticated)

  const returnUrl = useMemo(
    () => buildReturnUrl(pathname, search, hash),
    [hash, pathname, search],
  )

  const availableProviders = useMemo(() => new Set(providers), [providers])

  const openModal = useCallback(() => {
    setMode('login')
    setSubmitErrorMessage(null)
    form.resetFields()
    setIsModalOpen(true)
  }, [form])

  const closeModal = useCallback(() => {
    setIsModalOpen(false)
    setSubmitErrorMessage(null)
    setIsSubmitting(false)
    form.resetFields()
  }, [form])

  const switchMode = useCallback(() => {
    setMode((currentMode) => (currentMode === 'login' ? 'register' : 'login'))
    setSubmitErrorMessage(null)
    form.resetFields()
  }, [form])

  const handleSocialLogin = useCallback(
    (provider: 'google' | 'github') => {
      startSocialLogin(provider, returnUrl)
    },
    [returnUrl, startSocialLogin],
  )

  const handleSubmit = useCallback(async (values: AuthCredentialsFormValues) => {
    setIsSubmitting(true)
    setSubmitErrorMessage(null)

    const path = mode === 'login' ? '/auth/login' : '/auth/register'
    const payload = mode === 'login'
      ? {
        login: values.login,
        password: values.password,
      }
      : {
        login: values.login,
        password: values.password,
        confirmPassword: values.confirmPassword,
      }

    const response = await apiRequest<unknown>(path, {
      method: 'POST',
      body: payload,
    })

    setIsSubmitting(false)

    if (!response.ok) {
      setSubmitErrorMessage(resolveLocalAuthErrorMessage(response))
      return
    }

    closeModal()
    window.location.reload()
  }, [closeModal, mode])

  const handleLogout = useCallback(async () => {
    setIsSigningOut(true)

    try {
      await apiRequest<unknown>('/auth/logout', {
        method: 'POST',
      })
    } finally {
      window.location.reload()
    }
  }, [])

  if (isAuthenticated) {
    return (
      <Button
        className="auth-open-modal-btn"
        type="primary"
        size="small"
        icon={<LogoutOutlined />}
        loading={isSigningOut}
        disabled={disabled || isSigningOut}
        onClick={handleLogout}
      >
        Выйти
      </Button>
    )
  }

  const socialProvidersBootstrapMessage = status === 'error'
    ? (errorMessage ?? 'Не удалось загрузить провайдеров соцвхода.')
    : (status === 'loading' ? 'Загружаем соцпровайдеров...' : undefined)

  const googleUnavailableMessage = availableProviders.has('google')
    ? undefined
    : 'Google вход недоступен в текущей конфигурации.'

  const gitHubUnavailableMessage = availableProviders.has('github')
    ? undefined
    : 'GitHub вход недоступен в текущей конфигурации.'

  const title = mode === 'login' ? 'Вход в аккаунт' : 'Регистрация'
  const submitLabel = mode === 'login' ? 'Войти' : 'Зарегистрироваться'

  return (
    <>
      <Button
        className="auth-open-modal-btn"
        type="primary"
        size="small"
        icon={<LoginOutlined />}
        disabled={disabled}
        onClick={openModal}
      >
        Войти
      </Button>

      <Modal
        title={title}
        open={isModalOpen}
        onCancel={closeModal}
        footer={null}
        destroyOnHidden
        centered
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {submitErrorMessage !== null ? (
            <Alert
              showIcon
              type="error"
              message={submitErrorMessage}
            />
          ) : null}

          <Form<AuthCredentialsFormValues>
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            requiredMark={false}
          >
            <Form.Item<AuthCredentialsFormValues>
              label="Логин"
              name="login"
              rules={[
                { required: true, message: 'Введите логин.' },
                { min: 3, message: 'Логин должен быть не короче 3 символов.' },
                { max: 100, message: 'Логин должен быть не длиннее 100 символов.' },
              ]}
            >
              <Input autoComplete="username" maxLength={100} />
            </Form.Item>

            <Form.Item<AuthCredentialsFormValues>
              label="Пароль"
              name="password"
              rules={[
                { required: true, message: 'Введите пароль.' },
                { min: 8, message: 'Пароль должен быть не короче 8 символов.' },
                { max: 200, message: 'Пароль должен быть не длиннее 200 символов.' },
              ]}
            >
              <Input.Password autoComplete={mode === 'login' ? 'current-password' : 'new-password'} maxLength={200} />
            </Form.Item>

            {mode === 'register' ? (
              <Form.Item<AuthCredentialsFormValues>
                label="Повторите пароль"
                name="confirmPassword"
                dependencies={['password']}
                rules={[
                  { required: true, message: 'Повторите пароль.' },
                  ({ getFieldValue }) => ({
                    validator(_, value: string | undefined) {
                      if (value === undefined || value.length === 0 || value === getFieldValue('password')) {
                        return Promise.resolve()
                      }

                      return Promise.reject(new Error('Пароли не совпадают.'))
                    },
                  }),
                ]}
              >
                <Input.Password autoComplete="new-password" maxLength={200} />
              </Form.Item>
            ) : null}

            <Button
              type="primary"
              htmlType="submit"
              block
              loading={isSubmitting}
              disabled={isSubmitting || isRedirecting}
            >
              {submitLabel}
            </Button>
          </Form>

          <Typography.Text type="secondary">
            {mode === 'login' ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}{' '}
            <Button type="link" onClick={switchMode} style={{ padding: 0 }}>
              {mode === 'login' ? 'Зарегистрируйтесь!' : 'Войдите!'}
            </Button>
          </Typography.Text>

          <Divider style={{ margin: '4px 0' }}>или через</Divider>

          <Space size="small" style={{ width: '100%' }}>
            <Tooltip title={socialProvidersBootstrapMessage ?? googleUnavailableMessage}>
              <Button
                className="social-login-provider-btn social-login-provider-btn-google"
                icon={<GoogleOutlined />}
                block
                loading={isRedirecting}
                disabled={
                  isSubmitting
                  || isRedirecting
                  || status !== 'ready'
                  || !availableProviders.has('google')
                }
                onClick={() => handleSocialLogin('google')}
              >
                Google
              </Button>
            </Tooltip>

            <Tooltip title={socialProvidersBootstrapMessage ?? gitHubUnavailableMessage}>
              <Button
                className="social-login-provider-btn social-login-provider-btn-github"
                icon={<GithubOutlined />}
                block
                loading={isRedirecting}
                disabled={
                  isSubmitting
                  || isRedirecting
                  || status !== 'ready'
                  || !availableProviders.has('github')
                }
                onClick={() => handleSocialLogin('github')}
              >
                GitHub
              </Button>
            </Tooltip>
          </Space>

          {status === 'error' && errorMessage !== null ? (
            <Alert
              showIcon
              type="warning"
              message="Социальный вход временно недоступен"
              description={errorMessage}
            />
          ) : null}
        </Space>
      </Modal>
    </>
  )
}