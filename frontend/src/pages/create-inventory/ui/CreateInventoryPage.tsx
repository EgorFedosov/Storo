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
        title="Create inventory is unavailable"
        subTitle="Only authenticated users with create permission can open this page."
      />
    )
  }

  const formDisabled = referencesStatus !== 'ready'

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 4 }}>
          Create Inventory
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          Create a new inventory template and continue to the inventory details/editor flow.
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
          message="Loading categories"
          description="Category dictionary is loading. Form submission is temporarily disabled."
        />
      ) : null}

      {referencesErrorMessage !== null ? (
        <Alert
          showIcon
          type="error"
          message="System references are unavailable"
          description={referencesErrorMessage}
          action={(
            <Button type="primary" size="small" onClick={retryReferencesBootstrap}>
              Retry
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
