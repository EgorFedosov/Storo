import { ReloadOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Result, Space, Spin, Tabs, Typography } from 'antd'
import { useMemo, useState } from 'react'
import { useInventoryDetailsModel } from '../../../features/inventory-details/model/useInventoryDetailsModel.ts'
import { InventoryDetailsView } from '../../../features/inventory-details/ui/InventoryDetailsView.tsx'
import { InventoryDiscussionTab } from '../../../features/inventory-discussion/ui/InventoryDiscussionTab.tsx'
import { InventoryItemsTableTab } from '../../../features/inventory-items-table/ui/InventoryItemsTableTab.tsx'
import { navigate, useLocationSnapshot } from '../../../shared/lib/router/navigation.ts'

type InventoryPageTabKey = 'items' | 'overview' | 'discussion'

function isInventoryPageTabKey(value: string): value is InventoryPageTabKey {
  return value === 'items' || value === 'overview' || value === 'discussion'
}

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
  const [activeTabKey, setActiveTabKey] = useState<InventoryPageTabKey>('items')

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
            Инвентарь
          </Typography.Title>
          <Typography.Text type="secondary">
            Загрузка данных инвентаря...
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
          title="Инвентарь не найден"
          subTitle="Запрошенный инвентарь не существует или был удален."
          extra={(
            <Space wrap>
              <Button type="primary" icon={<ReloadOutlined />} onClick={retryLoad}>
                Повторить
              </Button>
              <Button onClick={() => navigate('/home')}>
                На главную
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
        message="Не удалось загрузить данные инвентаря"
        description={errorMessage ?? 'Запрос данных инвентаря завершился ошибкой.'}
        action={(
          <Button type="primary" size="small" icon={<ReloadOutlined />} onClick={retryLoad}>
            Повторить
          </Button>
        )}
      />
    )
  }

  if (details === null) {
    return (
      <Result
        status="error"
        title="Данные инвентаря недоступны"
        subTitle="API вернул неожиданный ответ."
        extra={(
          <Button type="primary" icon={<ReloadOutlined />} onClick={retryLoad}>
            Повторить
          </Button>
        )}
      />
    )
  }

  return (
    <Card>
      <Tabs
        destroyInactiveTabPane
        activeKey={activeTabKey}
        onChange={(nextTabKey) => {
          if (isInventoryPageTabKey(nextTabKey)) {
            setActiveTabKey(nextTabKey)
          }
        }}
        items={[
          {
            key: 'items',
            label: 'Предметы',
            children: (
              <InventoryItemsTableTab
                key={details.id}
                inventoryId={details.id}
                enabled={activeTabKey === 'items'}
                canWriteItems={details.permissions.canWriteItems}
                canEditInventory={details.permissions.canEditInventory}
              />
            ),
          },
          {
            key: 'overview',
            label: 'Обзор',
            children: <InventoryDetailsView details={details} etag={etag} />,
          },
          {
            key: 'discussion',
            label: 'Обсуждение',
            children: (
              <InventoryDiscussionTab
                inventoryId={details.id}
                canComment={details.permissions.canComment}
                enabled={activeTabKey === 'discussion'}
              />
            ),
          },
        ]}
      />
    </Card>
  )
}
