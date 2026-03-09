import { Card, Empty, Space, Table, Tag, Typography } from 'antd'
import type { TableProps } from 'antd'
import dayjs from 'dayjs'
import { useMemo } from 'react'
import type { InventoryDetails } from '../../../entities/inventory/model/types.ts'

type InventoryDetailsViewProps = {
  details: InventoryDetails
  etag: string | null
}

type SnapshotRow = {
  key: string
  property: string
  value: string
}

type TagRow = {
  key: string
  id: string
  name: string
}

type PermissionRow = {
  key: string
  capability: string
  allowed: boolean
  scope: string
}

function formatUtcDateTime(value: string): string {
  const parsedValue = dayjs(value)
  return parsedValue.isValid() ? parsedValue.format('YYYY-MM-DD HH:mm') : value
}

function toSnapshotRows(details: InventoryDetails, etag: string | null): SnapshotRow[] {
  return [
    { key: 'id', property: 'Inventory ID', value: details.id },
    { key: 'category', property: 'Category', value: details.header.category.name },
    { key: 'creator', property: 'Creator', value: `${details.creator.displayName} (@${details.creator.userName})` },
    { key: 'access', property: 'Access mode', value: details.header.isPublic ? 'Public' : 'Restricted' },
    { key: 'items', property: 'Items count', value: String(details.summary.itemsCount) },
    { key: 'createdAt', property: 'Created at (UTC)', value: formatUtcDateTime(details.header.createdAt) },
    { key: 'updatedAt', property: 'Updated at (UTC)', value: formatUtcDateTime(details.header.updatedAt) },
    { key: 'version', property: 'Version', value: String(details.version) },
    { key: 'etag', property: 'ETag', value: etag ?? `(missing; fallback "${String(details.version)}")` },
  ]
}

function toPermissionRows(details: InventoryDetails): PermissionRow[] {
  return [
    {
      key: 'canEditInventory',
      capability: 'Edit inventory settings',
      allowed: details.permissions.canEditInventory,
      scope: 'Creator/Admin',
    },
    {
      key: 'canManageAccess',
      capability: 'Manage access list',
      allowed: details.permissions.canManageAccess,
      scope: 'Creator/Admin',
    },
    {
      key: 'canManageCustomFields',
      capability: 'Manage custom fields',
      allowed: details.permissions.canManageCustomFields,
      scope: 'Creator/Admin',
    },
    {
      key: 'canManageCustomIdTemplate',
      capability: 'Manage custom ID template',
      allowed: details.permissions.canManageCustomIdTemplate,
      scope: 'Creator/Admin',
    },
    {
      key: 'canWriteItems',
      capability: 'Create or edit items',
      allowed: details.permissions.canWriteItems,
      scope: 'Writer/Creator/Admin',
    },
    {
      key: 'canComment',
      capability: 'Post discussion comments',
      allowed: details.permissions.canComment,
      scope: 'Authenticated user',
    },
    {
      key: 'canLike',
      capability: 'Like items',
      allowed: details.permissions.canLike,
      scope: 'Authenticated user',
    },
  ]
}

export function InventoryDetailsView({ details, etag }: InventoryDetailsViewProps) {
  const snapshotRows = useMemo(() => toSnapshotRows(details, etag), [details, etag])
  const tagRows = useMemo<TagRow[]>(
    () =>
      details.tags.map((tag) => ({
        key: tag.id,
        id: tag.id,
        name: tag.name,
      })),
    [details.tags],
  )
  const permissionRows = useMemo(() => toPermissionRows(details), [details])

  const snapshotColumns = useMemo<NonNullable<TableProps<SnapshotRow>['columns']>>(
    () => [
      {
        title: 'Property',
        dataIndex: 'property',
        key: 'property',
        width: 260,
      },
      {
        title: 'Value',
        dataIndex: 'value',
        key: 'value',
      },
    ],
    [],
  )

  const tagColumns = useMemo<NonNullable<TableProps<TagRow>['columns']>>(
    () => [
      {
        title: 'Tag',
        dataIndex: 'name',
        key: 'name',
        render: (value: string) => <Tag>{value}</Tag>,
      },
      {
        title: 'Tag ID',
        dataIndex: 'id',
        key: 'id',
        width: 180,
      },
    ],
    [],
  )

  const permissionColumns = useMemo<NonNullable<TableProps<PermissionRow>['columns']>>(
    () => [
      {
        title: 'Capability',
        dataIndex: 'capability',
        key: 'capability',
      },
      {
        title: 'Allowed',
        dataIndex: 'allowed',
        key: 'allowed',
        width: 140,
        render: (allowed: boolean) => (
          <Tag color={allowed ? 'green' : 'default'}>
            {allowed ? 'Yes' : 'No'}
          </Tag>
        ),
      },
      {
        title: 'Permission scope',
        dataIndex: 'scope',
        key: 'scope',
        width: 220,
      },
    ],
    [],
  )

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 0 }}>
            {details.header.title}
          </Typography.Title>
          <Space size={8} wrap>
            <Tag color="blue">Inventory #{details.id}</Tag>
            <Tag color={details.header.isPublic ? 'green' : 'gold'}>
              {details.header.isPublic ? 'Public write access' : 'Restricted write access'}
            </Tag>
            <Tag>Items: {String(details.summary.itemsCount)}</Tag>
          </Space>
          <Typography.Text type="secondary">
            Read-only inventory page built from `GET /api/v1/inventories/:inventoryId`.
          </Typography.Text>
          {details.header.imageUrl !== null ? (
            <img
              src={details.header.imageUrl}
              alt={`Inventory illustration for ${details.header.title}`}
              className="inventory-details-image"
            />
          ) : null}
        </Space>
      </Card>

      <Card title="Inventory Snapshot">
        <Table<SnapshotRow>
          rowKey="key"
          columns={snapshotColumns}
          dataSource={snapshotRows}
          pagination={false}
          size="middle"
        />
      </Card>

      <Card title="Description">
        <Typography.Paragraph className="inventory-details-description">
          {details.header.descriptionMarkdown.trim().length > 0
            ? details.header.descriptionMarkdown
            : 'No description provided.'}
        </Typography.Paragraph>
      </Card>

      <Card title={`Tags (${String(tagRows.length)})`}>
        <Table<TagRow>
          rowKey="key"
          columns={tagColumns}
          dataSource={tagRows}
          pagination={false}
          size="middle"
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No tags assigned to this inventory."
              />
            ),
          }}
        />
      </Card>

      <Card title="Permission Matrix">
        <Table<PermissionRow>
          rowKey="key"
          columns={permissionColumns}
          dataSource={permissionRows}
          pagination={false}
          size="middle"
        />
      </Card>
    </Space>
  )
}
