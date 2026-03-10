import type { Key, ReactNode } from 'react'
import { Alert, Card, Empty, Table, Typography } from 'antd'
import type { TableProps } from 'antd'
import { uiKitContract } from './contracts.ts'

type TableFirstCardProps<TRecord extends object> = {
  title: string
  columns: NonNullable<TableProps<TRecord>['columns']>
  dataSource: readonly TRecord[]
  rowKey: TableProps<TRecord>['rowKey']
  selectedRowKeys: Key[]
  onSelectionChange: (selectedKeys: Key[]) => void
  loading?: boolean
  errorMessage?: string | null
  emptyDescription?: string
  toolbar?: ReactNode
}

export function TableFirstCard<TRecord extends object>({
  title,
  columns,
  dataSource,
  rowKey,
  selectedRowKeys,
  onSelectionChange,
  loading = false,
  errorMessage = null,
  emptyDescription = 'Нет данных для отображения.',
  toolbar,
}: TableFirstCardProps<TRecord>) {
  return (
    <Card title={title} extra={toolbar}>
      {errorMessage !== null ? (
        <Alert
          showIcon
          type="error"
          message="Ошибка операции"
          description={errorMessage}
          style={{ marginBottom: 12 }}
        />
      ) : null}

      <Table<TRecord>
        rowKey={rowKey}
        columns={columns}
        dataSource={[...dataSource]}
        loading={loading}
        rowSelection={{
          selectedRowKeys,
          onChange: (nextSelectedKeys) => onSelectionChange(nextSelectedKeys),
        }}
        locale={{
          emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyDescription} />,
        }}
        pagination={{
          defaultPageSize: uiKitContract.table.defaultPageSize,
          pageSizeOptions: [...uiKitContract.table.pageSizeOptions],
          showSizeChanger: true,
        }}
        size="middle"
      />

      {selectedRowKeys.length > 0 ? (
        <Typography.Text type="secondary">
          Выбрано строк: {selectedRowKeys.length}
        </Typography.Text>
      ) : null}
    </Card>
  )
}
