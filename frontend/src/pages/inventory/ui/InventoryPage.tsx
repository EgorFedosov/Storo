import { ReloadOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Result, Space, Spin, Typography } from 'antd'
import { useMemo } from 'react'
import { useInventoryDetailsModel } from '../../../features/inventory-details/model/useInventoryDetailsModel.ts'
import { InventoryDetailsView } from '../../../features/inventory-details/ui/InventoryDetailsView.tsx'
import { navigate, useLocationSnapshot } from '../../../shared/lib/router/navigation.ts'

function parseInventoryIdFromPath(pathname: string): string | null {
  const normalizedPath = pathname.trim().replace(/\/+$/, '')
  const match = /^\/inventor(?:y|ies)\/([1-9]\d*)$/i.exec(normalizedPath)
  if (match === null) {
    return null
  }

  return match[1]
}

export function InventoryPage() {
  const locationSnapshot = useLocationSnapshot()
  const inventoryId = useMemo(
    () => parseInventoryIdFromPath(locationSnapshot.pathname),
    [locationSnapshot.pathname],
  )
  const { details, errorMessage, errorStatus, etag, retryLoad, status } = useInventoryDetailsModel(inventoryId)

  if (status === 'loading' || status === 'idle') {
    return (
      <Card>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 0 }}>
            Inventory
          </Typography.Title>
          <Typography.Text type="secondary">
            Loading inventory details...
          </Typography.Text>
          <div className="inventory-details-loader" role="status" aria-live="polite">
            <Spin size="large" />
          </div>
        </Space>
      </Card>
    )
  }

  if (status === 'error') {
    if (errorStatus === 404) {
      return (
        <Result
          status="404"
          title="Inventory not found"
          subTitle="Requested inventory does not exist or was removed."
          extra={(
            <Space wrap>
              <Button type="primary" icon={<ReloadOutlined />} onClick={retryLoad}>
                Retry
              </Button>
              <Button onClick={() => navigate('/home')}>
                Go to Home
              </Button>
            </Space>
          )}
        />
      )
    }

    return (
      <Alert
        showIcon
        type="error"
        message="Failed to load inventory details"
        description={errorMessage ?? 'Inventory details request failed.'}
        action={(
          <Button type="primary" size="small" icon={<ReloadOutlined />} onClick={retryLoad}>
            Retry
          </Button>
        )}
      />
    )
  }

  if (details === null) {
    return (
      <Result
        status="error"
        title="Inventory details are unavailable"
        subTitle="API returned an unexpected response."
        extra={(
          <Button type="primary" icon={<ReloadOutlined />} onClick={retryLoad}>
            Retry
          </Button>
        )}
      />
    )
  }

  return <InventoryDetailsView details={details} etag={etag} />
}
