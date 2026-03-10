import { Button, Result, Space, Typography } from 'antd'
import {
  type ExternalAuthErrorCode,
  resolveExternalAuthErrorCode,
} from '../../../features/auth/model/externalAuthError.ts'
import { routes } from '../../../shared/config/routes.ts'
import { navigate, useLocationSnapshot } from '../../../shared/lib/router/navigation.ts'

type AuthErrorPresentation = {
  title: string
  description: string
  retryAllowed: boolean
}

function resolveAuthErrorPresentation(errorCode: string | null): AuthErrorPresentation {
  if (errorCode === null) {
    return {
      title: 'Социальный вход завершился ошибкой',
      description: 'Редирект от бэкенда не передал код ошибки.',
      retryAllowed: true,
    }
  }

  if (errorCode === 'external_auth_failed') {
    return {
      title: 'Не удалось завершить вход через соцсеть',
      description: 'Ошибка произошла на этапе аутентификации у провайдера. Попробуйте еще раз.',
      retryAllowed: true,
    }
  }

  if (errorCode === 'external_provider_unavailable') {
    return {
      title: 'Провайдер недоступен',
      description: 'Выбранный социальный провайдер сейчас не настроен.',
      retryAllowed: false,
    }
  }

  if (errorCode === 'missing_external_identity') {
    return {
      title: 'Провайдер не вернул обязательные данные',
      description: 'В ответе провайдера отсутствуют необходимые поля. Попробуйте другой аккаунт.',
      retryAllowed: true,
    }
  }

  if (errorCode === 'user_blocked') {
    return {
      title: 'Аккаунт заблокирован',
      description: 'Вход выполнен, но этот пользователь заблокирован и не может открыть сессию.',
      retryAllowed: false,
    }
  }

  return {
    title: 'Неизвестная ошибка социального входа',
    description: 'Бэкенд вернул неподдерживаемый код ошибки. Проверьте конфигурацию сервера.',
    retryAllowed: true,
  }
}

export function AuthErrorPage() {
  const locationSnapshot = useLocationSnapshot()
  const errorCode = resolveExternalAuthErrorCode(locationSnapshot.search)
  const errorPresentation = resolveAuthErrorPresentation(errorCode as ExternalAuthErrorCode | null)

  return (
    <Result
      status="error"
      title={errorPresentation.title}
      subTitle={errorPresentation.description}
      extra={(
        <Space direction="vertical" size="small">
          <Space>
            <Button type="primary" onClick={() => navigate(routes.home.path)}>
              На главную
            </Button>
            {errorPresentation.retryAllowed ? (
              <Button onClick={() => navigate(routes.home.path)}>
                Повторить вход
              </Button>
            ) : null}
          </Space>
          {errorCode !== null ? (
            <Typography.Text type="secondary">
              Код ошибки: {errorCode}
            </Typography.Text>
          ) : null}
        </Space>
      )}
    />
  )
}

