import { Button, Result, Space, Typography } from 'antd'
import {
  getExternalAuthErrorPresentation,
  resolveExternalAuthErrorCode,
} from '../../../features/auth/model/externalAuthError.ts'
import { routes } from '../../../shared/config/routes.ts'
import { navigate, useLocationSnapshot } from '../../../shared/lib/router/navigation.ts'

export function AuthErrorPage() {
  const locationSnapshot = useLocationSnapshot()
  const errorCode = resolveExternalAuthErrorCode(locationSnapshot.search)
  const errorPresentation = getExternalAuthErrorPresentation(errorCode)

  return (
    <Result
      status="error"
      title={errorPresentation.title}
      subTitle={errorPresentation.description}
      extra={(
        <Space direction="vertical" size="small">
          <Space>
            <Button type="primary" onClick={() => navigate(routes.home.path)}>
              Go to home
            </Button>
            {errorPresentation.retryAllowed ? (
              <Button onClick={() => navigate(routes.home.path)}>
                Retry sign-in
              </Button>
            ) : null}
          </Space>
          {errorCode !== null ? (
            <Typography.Text type="secondary">
              Error code: {errorCode}
            </Typography.Text>
          ) : null}
        </Space>
      )}
    />
  )
}
