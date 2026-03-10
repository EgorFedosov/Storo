import { Alert, Button, Card, Result, Space, Tag, Typography } from 'antd'
import { useCurrentUser } from '../../../features/auth/model/useCurrentUser.ts'
import { CreateInventoryForm } from '../../../features/create-inventory/ui/CreateInventoryForm.tsx'
import { useSystemReferences } from '../../../entities/reference/model/useSystemReferences.ts'

export function CreateInventoryPage() {
  const { currentUser, permissions } = useCurrentUser()
  const {
    status: referencesStatus,
    categoryOptions,
    errorMessage: referencesErrorMessage,
    retryBootstrap: retryReferencesBootstrap,
  } = useSystemReferences()

  if (!permissions.canCreateInventory) {
    return (
      <Result
        status="403"
        title="Создание инвентаря недоступно"
        subTitle="Эту страницу могут открывать только авторизованные пользователи с правом создания."
      />
    )
  }

  const formDisabled = referencesStatus !== 'ready'

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 4 }}>
          Создание инвентаря
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          Создайте новый шаблон инвентаря и перейдите к карточке и редактору.
        </Typography.Paragraph>
        <Space wrap size={8}>
          <Tag color="blue">{currentUser.displayName}</Tag>
          <Tag>@{currentUser.userName}</Tag>
        </Space>
      </Card>

      {referencesStatus === 'loading' ? (
        <Alert
          showIcon
          type="info"
          message="Загрузка категорий"
          description="Загружается справочник категорий. Отправка формы временно недоступна."
        />
      ) : null}

      {referencesErrorMessage !== null ? (
        <Alert
          showIcon
          type="error"
          message="Справочные данные недоступны"
          description={referencesErrorMessage}
          action={(
            <Button type="primary" size="small" onClick={retryReferencesBootstrap}>
              Повторить
            </Button>
          )}
        />
      ) : null}

      <Card>
        <CreateInventoryForm categoryOptions={categoryOptions} disabled={formDisabled} />
      </Card>
    </Space>
  )
}
