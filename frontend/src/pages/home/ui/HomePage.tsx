import { ReloadOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Empty, Space, Table, Tag, Typography } from 'antd'
import type { TableProps } from 'antd'
import dayjs from 'dayjs'
import { useMemo } from 'react'
import { useHomePageModel } from '../../../features/home/model/useHomePageModel.ts'
import type { HomeInventorySummary, HomeTagCloudItem } from '../../../features/home/model/types.ts'
import {
  buildSearchRoutePath,
  searchRouteContract,
} from '../../../features/search-navigation/model/searchNavigation.ts'
import { navigate } from '../../../shared/lib/router/navigation.ts'

type InventoryTableColumns = NonNullable<TableProps<HomeInventorySummary>['columns']>

function formatUtcDateTime(value: string): string {
  const parsedDate = dayjs(value)
  return parsedDate.isValid() ? parsedDate.format('YYYY-MM-DD HH:mm') : value
}

function createLatestInventoriesColumns(openInventory: (inventoryId: string) => void): InventoryTableColumns {
  return [
    {
      title: 'Inventory',
      key: 'inventory',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Link
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              openInventory(record.id)
            }}
          >
            {record.title}
          </Typography.Link>
          <Typography.Text type="secondary">
            #{record.id}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'descriptionMarkdown',
      render: (value: string, record) => (
        <Space direction="vertical" size={8}>
          {record.imageUrl !== null ? (
            <img
              src={record.imageUrl}
              alt={`Preview for ${record.title}`}
              className="home-inventory-image-preview"
            />
          ) : null}
          <Typography.Paragraph
            ellipsis={{ rows: 2 }}
            style={{ marginBottom: 0 }}
          >
            {value.trim().length > 0 ? value : 'No description.'}
          </Typography.Paragraph>
        </Space>
      ),
    },
    {
      title: 'Creator',
      key: 'creator',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>
            {record.creator.displayName}
          </Typography.Text>
          <Typography.Text type="secondary">
            {record.creator.userName}
          </Typography.Text>
        </Space>
      ),
      width: 200,
    },
    {
      title: 'Items',
      dataIndex: 'itemsCount',
      width: 110,
      align: 'right',
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      width: 170,
      render: (value: string) => formatUtcDateTime(value),
    },
  ]
}

function createTopInventoriesColumns(openInventory: (inventoryId: string) => void): InventoryTableColumns {
  return [
    {
      title: '#',
      key: 'rank',
      width: 72,
      render: (_, __, index) => String(index + 1),
    },
    {
      title: 'Inventory',
      key: 'inventory',
      render: (_, record) => (
        <Typography.Link
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            openInventory(record.id)
          }}
        >
          {record.title}
        </Typography.Link>
      ),
    },
    {
      title: 'Creator',
      key: 'creator',
      render: (_, record) => record.creator.displayName,
      width: 220,
    },
    {
      title: 'Items',
      dataIndex: 'itemsCount',
      width: 110,
      align: 'right',
    },
    {
      title: 'Updated',
      dataIndex: 'updatedAt',
      width: 170,
      render: (value: string) => formatUtcDateTime(value),
    },
  ]
}

function resolveTagCloudFontSize(count: number, minCount: number, maxCount: number): number {
  if (minCount === maxCount) {
    return 14
  }

  const ratio = (count - minCount) / (maxCount - minCount)
  return Math.round(12 + ratio * 8)
}

function getTagCloudCountRange(tagCloud: readonly HomeTagCloudItem[]): { min: number; max: number } {
  if (tagCloud.length === 0) {
    return { min: 0, max: 0 }
  }

  let min = tagCloud[0].count
  let max = tagCloud[0].count

  for (const tag of tagCloud) {
    min = Math.min(min, tag.count)
    max = Math.max(max, tag.count)
  }

  return { min, max }
}

export function HomePage() {
  const { data, errorMessage, retryLoad, status } = useHomePageModel()

  const latestInventoriesColumns = useMemo(
    () =>
      createLatestInventoriesColumns((inventoryId) => {
        navigate(`/inventories/${inventoryId}`)
      }),
    [],
  )

  const topInventoriesColumns = useMemo(
    () =>
      createTopInventoriesColumns((inventoryId) => {
        navigate(`/inventories/${inventoryId}`)
      }),
    [],
  )

  const tagCloudCountRange = useMemo(() => getTagCloudCountRange(data.tagCloud), [data.tagCloud])

  const isLoading = status === 'loading'

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          Home
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          Public read-only dashboard with latest inventories, top popular inventories and tag cloud.
        </Typography.Paragraph>
      </Card>

      {errorMessage !== null ? (
        <Alert
          showIcon
          type="error"
          message="Failed to load home data"
          description={errorMessage}
          action={(
            <Button type="primary" size="small" icon={<ReloadOutlined />} onClick={retryLoad}>
              Retry
            </Button>
          )}
        />
      ) : null}

      <Card title={`Latest Inventories (${String(data.latestInventories.length)})`}>
        <Table<HomeInventorySummary>
          rowKey="id"
          columns={latestInventoriesColumns}
          dataSource={data.latestInventories}
          loading={isLoading}
          pagination={false}
          size="middle"
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Latest inventories are not available yet."
              />
            ),
          }}
          onRow={(record) => ({
            onClick: () => navigate(`/inventories/${record.id}`),
            style: { cursor: 'pointer' },
          })}
        />
      </Card>

      <Card title={`Top Popular Inventories (${String(data.topPopularInventories.length)})`}>
        <Table<HomeInventorySummary>
          rowKey="id"
          columns={topInventoriesColumns}
          dataSource={data.topPopularInventories}
          loading={isLoading}
          pagination={false}
          size="middle"
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Popular inventories are not available yet."
              />
            ),
          }}
          onRow={(record) => ({
            onClick: () => navigate(`/inventories/${record.id}`),
            style: { cursor: 'pointer' },
          })}
        />
      </Card>

      <Card
        title={`Tag Cloud (${String(data.tagCloud.length)})`}
        extra={(
          <Typography.Text type="secondary">
            Click tag to open search results
          </Typography.Text>
        )}
      >
        {data.tagCloud.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No tags available."
          />
        ) : (
          <Space size={[8, 8]} wrap>
            {data.tagCloud.map((tag) => {
              const fontSize = resolveTagCloudFontSize(
                tag.count,
                tagCloudCountRange.min,
                tagCloudCountRange.max,
              )
              const tagSearchPath = buildSearchRoutePath({
                scope: 'inventories',
                tag: tag.name,
                page: searchRouteContract.defaultPage,
              })

              return (
                <Tag
                  key={tag.id}
                  role="button"
                  tabIndex={0}
                  className="home-tag-cloud-item"
                  style={{ fontSize }}
                  onClick={() => navigate(tagSearchPath)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      navigate(tagSearchPath)
                    }
                  }}
                >
                  {tag.name} ({String(tag.count)})
                </Tag>
              )
            })}
          </Space>
        )}
      </Card>
    </Space>
  )
}
