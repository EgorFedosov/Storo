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
  return parsedValue.isValid() ? parsedValue.format('DD.MM.YYYY HH:mm') : value
}

function formatMetricValue(value: number | null): string {
  if (value === null) {
    return 'н/д'
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
        title: 'Поле',
        dataIndex: 'title',
        key: 'title',
      },
      {
        title: 'ID поля',
        dataIndex: 'fieldId',
        key: 'fieldId',
        width: 140,
      },
      {
        title: 'Мин.',
        dataIndex: 'min',
        key: 'min',
        width: 140,
        render: (value: number | null) => formatMetricValue(value),
      },
      {
        title: 'Макс.',
        dataIndex: 'max',
        key: 'max',
        width: 140,
        render: (value: number | null) => formatMetricValue(value),
      },
      {
        title: 'Среднее',
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
        title: 'Поле',
        dataIndex: 'title',
        key: 'title',
      },
      {
        title: 'ID поля',
        dataIndex: 'fieldId',
        key: 'fieldId',
        width: 140,
      },
      {
        title: 'Самое частое значение',
        dataIndex: 'mostFrequentValue',
        key: 'mostFrequentValue',
        render: (value: string | null) => {
          if (value === null) {
            return <Typography.Text type="secondary">н/д</Typography.Text>
          }

          return value.length > 0 ? value : '(пустая строка)'
        },
      },
      {
        title: 'Частота',
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
            Загрузка статистики инвентаря...
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
          message={errorStatus === 404 ? 'Статистика недоступна' : 'Не удалось загрузить статистику'}
          description={errorMessage ?? 'Ошибка запроса статистики.'}
          action={(
            <Button type="primary" size="small" icon={<ReloadOutlined />} onClick={retryLoad}>
              Повторить
            </Button>
          )}
        />
      ) : null}

      {data !== null ? (
        <Card>
          <Space size={8} wrap>
            <Tag color="blue">Инвентарь #{data.inventoryId}</Tag>
            <Tag>Элементов: {String(data.itemsCount)}</Tag>
            <Tag>Числовых полей: {String(data.numericFields.length)}</Tag>
            <Tag>Строковых полей: {String(data.stringFields.length)}</Tag>
            <Tag>Обновлено: {formatUtcDateTime(data.updatedAt)} UTC</Tag>
          </Space>
          <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
            Статистика из `GET /api/v1/inventories/:inventoryId/statistics`.
          </Typography.Paragraph>
        </Card>
      ) : null}

      <Card title="Числовые агрегаты">
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
                description="Числовые агрегаты отсутствуют."
              />
            ),
          }}
        />
      </Card>

      <Card title="Строковые агрегаты">
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
                description="Строковые агрегаты отсутствуют."
              />
            ),
          }}
        />
      </Card>
    </Space>
  )
}
