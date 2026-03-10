import { ReloadOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Empty, Space, Spin, Table, Tag, Typography } from 'antd'
import type { TableProps } from 'antd'
import dayjs from 'dayjs'
import { useMemo } from 'react'
import type { InventoryStatistics } from '../../../entities/inventory/model/inventoryStatisticsTypes.ts'
import { useInventoryStatisticsModel } from '../model/useInventoryStatisticsModel.ts'

type InventoryStatisticsTabProps = {
  inventoryId: string
  active: boolean
}

type NumericStatisticRow = {
  key: string
  fieldId: string
  title: string
  min: number | null
  max: number | null
  avg: number | null
}

type StringStatisticRow = {
  key: string
  fieldId: string
  title: string
  mostFrequentValue: string | null
  mostFrequentCount: number
}

function formatUtcDateTime(value: string): string {
  const parsedValue = dayjs(value)
  return parsedValue.isValid() ? parsedValue.format('YYYY-MM-DD HH:mm') : value
}

function formatMetricValue(value: number | null): string {
  if (value === null) {
    return 'n/a'
  }

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 4,
  }).format(value)
}

function toNumericRows(data: InventoryStatistics): NumericStatisticRow[] {
  return data.numericFields.map((field) => ({
    key: field.fieldId,
    fieldId: field.fieldId,
    title: field.title,
    min: field.min,
    max: field.max,
    avg: field.avg,
  }))
}

function toStringRows(data: InventoryStatistics): StringStatisticRow[] {
  return data.stringFields.map((field) => ({
    key: field.fieldId,
    fieldId: field.fieldId,
    title: field.title,
    mostFrequentValue: field.mostFrequentValue,
    mostFrequentCount: field.mostFrequentCount,
  }))
}

export function InventoryStatisticsTab({ inventoryId, active }: InventoryStatisticsTabProps) {
  const { data, errorMessage, errorStatus, retryLoad, status } = useInventoryStatisticsModel(inventoryId, active)

  const numericRows = useMemo(
    () => (data === null ? [] : toNumericRows(data)),
    [data],
  )

  const stringRows = useMemo(
    () => (data === null ? [] : toStringRows(data)),
    [data],
  )

  const numericColumns = useMemo<NonNullable<TableProps<NumericStatisticRow>['columns']>>(
    () => [
      {
        title: 'Field',
        dataIndex: 'title',
        key: 'title',
      },
      {
        title: 'Field ID',
        dataIndex: 'fieldId',
        key: 'fieldId',
        width: 140,
      },
      {
        title: 'Min',
        dataIndex: 'min',
        key: 'min',
        width: 140,
        render: (value: number | null) => formatMetricValue(value),
      },
      {
        title: 'Max',
        dataIndex: 'max',
        key: 'max',
        width: 140,
        render: (value: number | null) => formatMetricValue(value),
      },
      {
        title: 'Avg',
        dataIndex: 'avg',
        key: 'avg',
        width: 140,
        render: (value: number | null) => formatMetricValue(value),
      },
    ],
    [],
  )

  const stringColumns = useMemo<NonNullable<TableProps<StringStatisticRow>['columns']>>(
    () => [
      {
        title: 'Field',
        dataIndex: 'title',
        key: 'title',
      },
      {
        title: 'Field ID',
        dataIndex: 'fieldId',
        key: 'fieldId',
        width: 140,
      },
      {
        title: 'Most Frequent Value',
        dataIndex: 'mostFrequentValue',
        key: 'mostFrequentValue',
        render: (value: string | null) => {
          if (value === null) {
            return <Typography.Text type="secondary">n/a</Typography.Text>
          }

          return value.length > 0 ? value : '(empty string)'
        },
      },
      {
        title: 'Frequency',
        dataIndex: 'mostFrequentCount',
        key: 'mostFrequentCount',
        width: 140,
      },
    ],
    [],
  )

  if (!active && status === 'idle') {
    return null
  }

  if ((status === 'idle' || status === 'loading') && data === null) {
    return (
      <Card>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Typography.Text type="secondary">
            Loading inventory statistics...
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
          message={errorStatus === 404 ? 'Statistics are unavailable' : 'Failed to load statistics'}
          description={errorMessage ?? 'Statistics request failed.'}
          action={(
            <Button type="primary" size="small" icon={<ReloadOutlined />} onClick={retryLoad}>
              Retry
            </Button>
          )}
        />
      ) : null}

      {data !== null ? (
        <Card>
          <Space size={8} wrap>
            <Tag color="blue">Inventory #{data.inventoryId}</Tag>
            <Tag>Items: {String(data.itemsCount)}</Tag>
            <Tag>Numeric fields: {String(data.numericFields.length)}</Tag>
            <Tag>String fields: {String(data.stringFields.length)}</Tag>
            <Tag>Updated: {formatUtcDateTime(data.updatedAt)} UTC</Tag>
          </Space>
          <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
            Statistics from `GET /api/v1/inventories/:inventoryId/statistics`.
          </Typography.Paragraph>
        </Card>
      ) : null}

      <Card title="Numeric Aggregates">
        <Table<NumericStatisticRow>
          rowKey="key"
          columns={numericColumns}
          dataSource={numericRows}
          pagination={false}
          size="middle"
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No numeric aggregates available."
              />
            ),
          }}
        />
      </Card>

      <Card title="String Aggregates">
        <Table<StringStatisticRow>
          rowKey="key"
          columns={stringColumns}
          dataSource={stringRows}
          pagination={false}
          size="middle"
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No string aggregates available."
              />
            ),
          }}
        />
      </Card>
    </Space>
  )
}
