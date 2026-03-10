import { Button, Result } from 'antd'
import { routes } from '../../../shared/config/routes.ts'
import { navigate } from '../../../shared/lib/router/navigation.ts'

export function NotFoundPage() {
  return (
    <Result
      status="404"
      title="Страница не найдена"
      subTitle="Маршрут не входит в текущий контракт оболочки приложения."
      extra={
        <Button type="primary" onClick={() => navigate(routes.home.path)}>
          На главную
        </Button>
      }
    />
  )
}
