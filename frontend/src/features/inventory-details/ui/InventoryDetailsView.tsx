import { EditOutlined } from '@ant-design/icons'
import { Button, Card, Empty, Space, Table, Tag, Typography } from 'antd'
import type { TableProps } from 'antd'
import dayjs from 'dayjs'
import { useMemo } from 'react'
import type { InventoryDetails } from '../../../entities/inventory/model/types.ts'
import { navigate } from '../../../shared/lib/router/navigation.ts'

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
  return parsedValue.isValid() ? parsedValue.format('DD.MM.YYYY HH:mm') : value
}

function toSnapshotRows(details: InventoryDetails, etag: string | null): SnapshotRow[] {
  return [
    { key: 'id', property: 'ID инвентаря', value: details.id },
    { key: 'category', property: 'Категория', value: details.header.category.name },
    { key: 'creator', property: 'Создатель', value: `${details.creator.displayName} (@${details.creator.userName})` },
    { key: 'access', property: 'Режим доступа', value: details.header.isPublic ? 'Публичный' : 'Ограниченный' },
    { key: 'items', property: 'Количество элементов', value: String(details.summary.itemsCount) },
    { key: 'createdAt', property: 'Создано (UTC)', value: formatUtcDateTime(details.header.createdAt) },
    { key: 'updatedAt', property: 'Обновлено (UTC)', value: formatUtcDateTime(details.header.updatedAt) },
    { key: 'version', property: 'Версия', value: String(details.version) },
    { key: 'etag', property: 'ETag', value: etag ?? `(отсутствует, используется версия "${String(details.version)}")` },
  ]
}

function toPermissionRows(details: InventoryDetails): PermissionRow[] {
  return [
    {
      key: 'canEditInventory',
      capability: 'Редактирование настроек инвентаря',
      allowed: details.permissions.canEditInventory,
      scope: 'Создатель/Админ',
    },
    {
      key: 'canManageAccess',
      capability: 'Управление доступом',
      allowed: details.permissions.canManageAccess,
      scope: 'Создатель/Админ',
    },
    {
      key: 'canManageCustomFields',
      capability: 'Управление пользовательскими полями',
      allowed: details.permissions.canManageCustomFields,
      scope: 'Создатель/Админ',
    },
    {
      key: 'canManageCustomIdTemplate',
      capability: 'Управление шаблоном ID',
      allowed: details.permissions.canManageCustomIdTemplate,
      scope: 'Создатель/Админ',
    },
    {
      key: 'canWriteItems',
      capability: 'Создание и редактирование элементов',
      allowed: details.permissions.canWriteItems,
      scope: 'Писатель/Создатель/Админ',
    },
    {
      key: 'canComment',
      capability: 'Публикация комментариев в обсуждении',
      allowed: details.permissions.canComment,
      scope: 'Авторизованный пользователь',
    },
    {
      key: 'canLike',
      capability: 'Лайки для элементов',
      allowed: details.permissions.canLike,
      scope: 'Авторизованный пользователь',
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
        title: 'Параметр',
        dataIndex: 'property',
        key: 'property',
        width: 260,
      },
      {
        title: 'Значение',
        dataIndex: 'value',
        key: 'value',
      },
    ],
    [],
  )

  const tagColumns = useMemo<NonNullable<TableProps<TagRow>['columns']>>(
    () => [
      {
        title: 'Тег',
        dataIndex: 'name',
        key: 'name',
        render: (value: string) => <Tag>{value}</Tag>,
      },
      {
        title: 'ID тега',
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
        title: 'Возможность',
        dataIndex: 'capability',
        key: 'capability',
      },
      {
        title: 'Разрешено',
        dataIndex: 'allowed',
        key: 'allowed',
        width: 140,
        render: (allowed: boolean) => (
          <Tag color={allowed ? 'green' : 'default'}>
            {allowed ? 'Да' : 'Нет'}
          </Tag>
        ),
      },
      {
        title: 'Область прав',
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
            <Tag color="blue">Инвентарь #{details.id}</Tag>
            <Tag color={details.header.isPublic ? 'green' : 'gold'}>
              {details.header.isPublic ? 'Публичный доступ на запись' : 'Ограниченный доступ на запись'}
            </Tag>
            <Tag>Элементов: {String(details.summary.itemsCount)}</Tag>
            {details.permissions.canEditInventory ? (
              <Button
                size="small"
                type="primary"
                icon={<EditOutlined />}
                onClick={() => navigate(`/inventories/${details.id}/edit`)}
              >
                Открыть редактор
              </Button>
            ) : null}
          </Space>
          <Typography.Text type="secondary">
            Страница инвентаря в режиме чтения, собранная из `GET /api/v1/inventories/:inventoryId`.
          </Typography.Text>
          {details.header.imageUrl !== null ? (
            <img
              src={details.header.imageUrl}
              alt={`Изображение инвентаря «${details.header.title}»`}
              className="inventory-details-image"
            />
          ) : null}
        </Space>
      </Card>

      <Card title="Сводка инвентаря">
        <Table<SnapshotRow>
          rowKey="key"
          columns={snapshotColumns}
          dataSource={snapshotRows}
          pagination={false}
          size="middle"
        />
      </Card>

      <Card title="Описание">
        <Typography.Paragraph className="inventory-details-description">
          {details.header.descriptionMarkdown.trim().length > 0
            ? details.header.descriptionMarkdown
            : 'Описание отсутствует.'}
        </Typography.Paragraph>
      </Card>

      <Card title={`Теги (${String(tagRows.length)})`}>
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
                description="Для этого инвентаря теги не заданы."
              />
            ),
          }}
        />
      </Card>

      <Card title="Матрица прав">
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
