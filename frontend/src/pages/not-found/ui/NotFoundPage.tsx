import { Button, Result } from 'antd'
import { routes } from '../../../shared/config/routes.ts'
import { navigate } from '../../../shared/lib/router/navigation.ts'

export function NotFoundPage() {
  return (
    <Result
      status="404"
      title="Page not found"
      subTitle="The route is outside the current app shell contract."
      extra={
        <Button type="primary" onClick={() => navigate(routes.home.path)}>
          Go to home
        </Button>
      }
    />
  )
}
