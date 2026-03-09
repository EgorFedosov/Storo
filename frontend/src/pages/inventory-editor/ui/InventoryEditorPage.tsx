import { ReloadOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Result, Space, Spin, Typography } from 'antd'
import { useMemo } from 'react'
import { useInventoryEditorModel } from '../../../features/inventory-editor/model/useInventoryEditorModel.ts'
import { InventoryEditorShell } from '../../../features/inventory-editor/ui/InventoryEditorShell.tsx'
import { navigate, useLocationSnapshot } from '../../../shared/lib/router/navigation.ts'

function parseInventoryIdFromEditorPath(pathname: string): string | null {
  const normalizedPath = pathname.trim().replace(/\/+$/, '')
  const match = /^\/inventor(?:y|ies)\/([1-9]\d*)\/edit$/i.exec(normalizedPath)
  if (match === null) {
    return null
  }

  return match[1]
}

export function InventoryEditorPage() {
  const locationSnapshot = useLocationSnapshot()
  const inventoryId = useMemo(
    () => parseInventoryIdFromEditorPath(locationSnapshot.pathname),
    [locationSnapshot.pathname],
  )
  const {
    status,
    editor,
    etag,
    errorMessage,
    errorStatus,
    tabStates,
    activeTabKey,
    setActiveTabKey,
    retryLoad,
  } = useInventoryEditorModel(inventoryId)

  if (status === 'loading' || status === 'idle') {
    return (
      <Card>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 0 }}>
            Inventory Editor
          </Typography.Title>
          <Typography.Text type="secondary">
            Loading editor aggregate and tabs model...
          </Typography.Text>
          <div className="inventory-details-loader" role="status" aria-live="polite">
            <Spin size="large" />
          </div>
        </Space>
      </Card>
    )
  }

  if (status === 'error') {
    if (errorStatus === 401) {
      return (
        <Result
          status="403"
          title="Sign in required"
          subTitle="Inventory editor is available only for authenticated users."
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

    if (errorStatus === 403) {
      return (
        <Result
          status="403"
          title="Editor access denied"
          subTitle="Only inventory creator or admin can open this editor."
          extra={(
            <Space wrap>
              <Button type="primary" icon={<ReloadOutlined />} onClick={retryLoad}>
                Retry
              </Button>
              <Button onClick={() => navigate(`/inventories/${inventoryId ?? ''}`)}>
                Open Inventory Details
              </Button>
            </Space>
          )}
        />
      )
    }

    if (errorStatus === 404) {
      return (
        <Result
          status="404"
          title="Inventory editor not found"
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
        message="Failed to load inventory editor"
        description={errorMessage ?? 'Inventory editor request failed.'}
        action={(
          <Button type="primary" size="small" icon={<ReloadOutlined />} onClick={retryLoad}>
            Retry
          </Button>
        )}
      />
    )
  }

  if (editor === null) {
    return (
      <Result
        status="error"
        title="Inventory editor is unavailable"
        subTitle="API returned an unexpected response."
        extra={(
          <Button type="primary" icon={<ReloadOutlined />} onClick={retryLoad}>
            Retry
          </Button>
        )}
      />
    )
  }

  return (
    <InventoryEditorShell
      editor={editor}
      etag={etag}
      activeTabKey={activeTabKey}
      tabStates={tabStates}
      onTabChange={setActiveTabKey}
    />
  )
}
