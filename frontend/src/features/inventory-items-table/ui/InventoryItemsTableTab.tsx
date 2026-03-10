import { ReloadOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Empty, Segmented, Select, Space, Spin, Table, Tag, Typography } from 'antd'
import type { TableProps } from 'antd'
import dayjs from 'dayjs'
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import type { InventoryCustomFieldType } from '../../../entities/inventory/model/inventoryEditorTypes.ts'
import type {
  InventoryItemsTableCellValue,
  InventoryItemsTableColumn,
  InventoryItemsTableRow,
  InventoryItemsTableSortDirection,
  InventoryItemsTableSortField,
} from '../../../entities/inventory/model/inventoryItemsTableTypes.ts'
import { useInventoryItemsTableModel } from '../model/useInventoryItemsTableModel.ts'
import { navigate } from '../../../shared/lib/router/navigation.ts'

type InventoryItemsTableTabProps = {
  inventoryId: string
  enabled: boolean
  canWriteItems: boolean
}

const emptyValueLabel = '-'

const sortDirectionOptions: ReadonlyArray<{ label: string; value: InventoryItemsTableSortDirection }> = [
  { label: 'Descending', value: 'desc' },
  { label: 'Ascending', value: 'asc' },
]

function isCustomSortField(value: string): value is `field:${string}` {
  return /^field:[1-9]\d*$/.test(value)
}

function toSortFieldLabel(column: InventoryItemsTableColumn): string {
  if (column.key === 'customId') {
    return 'Custom ID'
  }

  if (column.key === 'createdAt') {
    return 'Created At'
  }

  if (column.key === 'updatedAt') {
    return 'Updated At'
  }

  if (column.kind === 'custom' && column.fieldType !== null) {
    return `${column.title} (${toFieldTypeLabel(column.fieldType)})`
  }

  return column.title
}

function toFieldTypeLabel(fieldType: InventoryCustomFieldType): string {
  switch (fieldType) {
    case 'single_line':
      return 'Single line'
    case 'multi_line':
      return 'Multi line'
    case 'number':
      return 'Number'
    case 'link':
      return 'Link'
    case 'bool':
      return 'Boolean'
    default:
      return fieldType
  }
}

function formatDateTimeCell(value: InventoryItemsTableCellValue): string {
  if (typeof value !== 'string') {
    return emptyValueLabel
  }

  const parsedValue = dayjs(value)
  return parsedValue.isValid() ? parsedValue.format('YYYY-MM-DD HH:mm') : value
}

function renderCustomFieldValue(value: InventoryItemsTableCellValue, fieldType: InventoryCustomFieldType): ReactNode {
  if (value === null) {
    return <Typography.Text type="secondary">{emptyValueLabel}</Typography.Text>
  }

  if (fieldType === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return <Typography.Text type="secondary">{emptyValueLabel}</Typography.Text>
    }

    return new Intl.NumberFormat().format(value)
  }

  if (fieldType === 'bool') {
    if (typeof value !== 'boolean') {
      return <Typography.Text type="secondary">{emptyValueLabel}</Typography.Text>
    }

    return (
      <Tag color={value ? 'green' : 'default'}>
        {value ? 'True' : 'False'}
      </Tag>
    )
  }

  if (fieldType === 'link') {
    if (typeof value !== 'string' || value.trim().length === 0) {
      return <Typography.Text type="secondary">{emptyValueLabel}</Typography.Text>
    }

    return (
      <Typography.Link href={value} target="_blank" rel="noreferrer">
        {value}
      </Typography.Link>
    )
  }

  if (typeof value !== 'string') {
    return <Typography.Text type="secondary">{emptyValueLabel}</Typography.Text>
  }

  if (fieldType === 'multi_line') {
    return (
      <Typography.Text style={{ whiteSpace: 'pre-wrap' }}>
        {value.length > 0 ? value : emptyValueLabel}
      </Typography.Text>
    )
  }

  return value.length > 0 ? value : emptyValueLabel
}

function renderCellValue(column: InventoryItemsTableColumn, row: InventoryItemsTableRow): ReactNode {
  const cellValue = row.cells[column.key] ?? null

  if (column.key === 'customId') {
    if (typeof cellValue !== 'string' || cellValue.trim().length === 0) {
      return <Typography.Text type="secondary">{emptyValueLabel}</Typography.Text>
    }

    return (
      <Typography.Link onClick={() => navigate(`/items/${row.itemId}`)}>
        {cellValue}
      </Typography.Link>
    )
  }

  if (column.key === 'createdAt' || column.key === 'updatedAt') {
    return formatDateTimeCell(cellValue)
  }

  if (column.kind === 'custom' && column.fieldType !== null) {
    return renderCustomFieldValue(cellValue, column.fieldType)
  }

  if (cellValue === null) {
    return <Typography.Text type="secondary">{emptyValueLabel}</Typography.Text>
  }

  return String(cellValue)
}

export function InventoryItemsTableTab({ inventoryId, enabled, canWriteItems }: InventoryItemsTableTabProps) {
  const {
    status,
    data,
    errorMessage,
    errorStatus,
    columns,
    rows,
    totalCount,
    page,
    pageSize,
    sortField,
    sortDirection,
    retryLoad,
    handlePageChange,
    handleSortFieldChange,
    handleSortDirectionChange,
  } = useInventoryItemsTableModel(inventoryId, enabled)

  const sortFieldOptions = useMemo<ReadonlyArray<{ label: string; value: InventoryItemsTableSortField }>>(
    () => {
      const options = columns
        .filter((column) => column.key === 'customId'
          || column.key === 'createdAt'
          || column.key === 'updatedAt'
          || isCustomSortField(column.key))
        .map((column) => ({
          label: toSortFieldLabel(column),
          value: column.key as InventoryItemsTableSortField,
        }))

      if (options.length === 0) {
        return [
          { label: 'Updated At', value: 'updatedAt' },
          { label: 'Created At', value: 'createdAt' },
          { label: 'Custom ID', value: 'customId' },
        ]
      }

      return options
    },
    [columns],
  )

  const tableColumns = useMemo<NonNullable<TableProps<InventoryItemsTableRow>['columns']>>(
    () => {
      const mappedColumns: NonNullable<TableProps<InventoryItemsTableRow>['columns']> = columns.map((column) => {
        if (column.key === 'customId') {
          return {
            title: column.title,
            key: column.key,
            width: 220,
            fixed: 'left',
            render: (_, row) => renderCellValue(column, row),
          }
        }

        if (column.key === 'createdAt' || column.key === 'updatedAt') {
          return {
            title: column.title,
            key: column.key,
            width: 180,
            render: (_, row) => renderCellValue(column, row),
          }
        }

        return {
          title: column.title,
          key: column.key,
          render: (_, row) => renderCellValue(column, row),
        }
      })

      mappedColumns.push({
        title: 'Likes',
        key: 'like',
        width: 140,
        fixed: 'right',
        render: (_, row) => (
          <Space size={6} wrap>
            <Tag color="blue">{String(row.like.count)}</Tag>
            {row.like.likedByCurrentUser ? (
              <Tag color="green">Liked</Tag>
            ) : null}
          </Space>
        ),
      })

      return mappedColumns
    },
    [columns],
  )

  if (!enabled && status === 'idle') {
    return null
  }

  if ((status === 'idle' || status === 'loading') && data === null) {
    return (
      <Card>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Typography.Text type="secondary">
            Loading inventory items table...
          </Typography.Text>
          <div className="inventory-details-loader" role="status" aria-live="polite">
            <Spin size="large" />
          </div>
        </Space>
      </Card>
    )
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {status === 'error' ? (
        <Alert
          showIcon
          type={errorStatus === 404 ? 'warning' : 'error'}
          message={errorStatus === 404 ? 'Inventory items are unavailable' : 'Failed to load items table'}
          description={errorMessage ?? 'Items table request failed.'}
          action={(
            <Button type="primary" size="small" icon={<ReloadOutlined />} onClick={retryLoad}>
              Retry
            </Button>
          )}
        />
      ) : null}

      <Card>
        <Space size={8} wrap>
          <Tag color="blue">Inventory #{inventoryId}</Tag>
          <Tag>Version: {String(data?.version ?? 'n/a')}</Tag>
          <Tag>Rows: {String(rows.length)}</Tag>
          <Tag>Total: {String(totalCount)}</Tag>
          <Tag color={canWriteItems ? 'green' : 'default'}>
            {canWriteItems ? 'Write access' : 'Read-only access'}
          </Tag>
        </Space>
        <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
          Dynamic table from `GET /api/v1/inventories/:inventoryId/items` (`columns + rows`).
        </Typography.Paragraph>
      </Card>

      <Card
        title="Items"
        extra={(
          <Space>
            <Select<InventoryItemsTableSortField>
              value={sortField}
              options={[...sortFieldOptions]}
              onChange={handleSortFieldChange}
              style={{ width: 240 }}
              disabled={status === 'loading'}
              aria-label="Items sort field"
            />
            <Segmented<InventoryItemsTableSortDirection>
              value={sortDirection}
              options={[...sortDirectionOptions]}
              onChange={handleSortDirectionChange}
              disabled={status === 'loading'}
            />
          </Space>
        )}
      >
        <Table<InventoryItemsTableRow>
          rowKey="itemId"
          columns={tableColumns}
          dataSource={[...rows]}
          loading={status === 'loading'}
          onChange={(paginationState) => {
            handlePageChange(
              paginationState.current ?? page,
              paginationState.pageSize ?? pageSize,
            )
          }}
          scroll={{ x: 960 }}
          pagination={{
            current: page,
            pageSize,
            total: totalCount,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (count, range) => `${String(range[0])}-${String(range[1])} of ${String(count)}`,
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No items in this inventory."
              />
            ),
          }}
          size="middle"
        />
      </Card>
    </Space>
  )
}
