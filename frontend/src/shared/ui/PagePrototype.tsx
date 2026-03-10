import { useCallback, useMemo, useState } from 'react'
import type { Key } from 'react'
import { Alert, Button, Card, Form, Input, Select, Space, Tag, Typography } from 'antd'
import type { TableProps } from 'antd'
import { TableFirstCard } from './kit/TableFirstCard.tsx'
import { uiKitContract } from './kit/contracts.ts'
import { useTableInteractionModel } from './model/useTableInteractionModel.ts'

type PagePrototypeProps = {
  title: string
  description: string
  checklist: readonly string[]
}

type ChecklistStatus = 'in_scope' | 'pending'

type ChecklistRow = {
  id: string
  rule: string
  status: ChecklistStatus
}

type FilterValues = {
  query?: string
  status?: 'all' | ChecklistStatus
}

const checklistStatusOptions: Array<{ value: 'all' | ChecklistStatus; label: string }> = [
  {
    value: 'all',
    label: 'Все',
  },
  {
    value: 'in_scope',
    label: 'В зоне охвата',
  },
  {
    value: 'pending',
    label: 'В ожидании',
  },
]

const checklistStatusColor: Record<ChecklistStatus, string> = {
  in_scope: 'blue',
  pending: 'default',
}

async function wait(ms: number) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function filterRows(rows: readonly ChecklistRow[], values: FilterValues): ChecklistRow[] {
  const normalizedQuery = values.query?.trim().toLowerCase() ?? ''
  const selectedStatus = values.status ?? 'all'

  return rows.filter((row) => {
    const matchesQuery = normalizedQuery.length === 0
      ? true
      : row.rule.toLowerCase().includes(normalizedQuery)
    const matchesStatus = selectedStatus === 'all'
      ? true
      : row.status === selectedStatus

    return matchesQuery && matchesStatus
  })
}

export function PagePrototype({ title, description, checklist }: PagePrototypeProps) {
  const [form] = Form.useForm<FilterValues>()
  const sourceRows = useMemo<ChecklistRow[]>(
    () =>
      checklist.map((rule, index) => ({
        id: String(index + 1),
        rule,
        status: index === 0 ? 'in_scope' : 'pending',
      })),
    [checklist],
  )

  const [rows, setRows] = useState<ChecklistRow[]>(sourceRows)
  const {
    selectedRowKeys,
    setSelectedRowKeys,
    isLoading,
    errorMessage,
    execute,
    resetInteractionState,
  } = useTableInteractionModel()

  const columns = useMemo<NonNullable<TableProps<ChecklistRow>['columns']>>(
    () => [
      {
        title: '#',
        dataIndex: 'id',
        width: 72,
      },
      {
        title: 'Правило UI-контракта',
        dataIndex: 'rule',
      },
      {
        title: 'Статус',
        dataIndex: 'status',
        width: 140,
        render: (value: ChecklistStatus) => (
          <Tag color={checklistStatusColor[value]}>
            {value === 'in_scope' ? 'В зоне охвата' : 'В ожидании'}
          </Tag>
        ),
      },
    ],
    [],
  )

  const handleApplyFilters = useCallback(
    (values: FilterValues) => {
      void execute(async () => {
        await wait(uiKitContract.interactions.simulatedLatencyMs)
        setRows(filterRows(sourceRows, values))
        setSelectedRowKeys([])
      })
    },
    [execute, setSelectedRowKeys, sourceRows],
  )

  const handleReset = useCallback(() => {
    form.resetFields()
    setRows(sourceRows)
    resetInteractionState()
  }, [form, resetInteractionState, sourceRows])

  const handleSelectionChange = useCallback((nextSelectedRowKeys: Key[]) => {
    setSelectedRowKeys(nextSelectedRowKeys)
  }, [setSelectedRowKeys])

  const handleRemoveSelected = useCallback(() => {
    if (selectedRowKeys.length === 0) {
      return
    }

    void execute(async () => {
      await wait(uiKitContract.interactions.simulatedLatencyMs)
      setRows((currentRows) =>
        currentRows.filter((row) => !selectedRowKeys.includes(row.id)))
      setSelectedRowKeys([])
    })
  }, [execute, selectedRowKeys, setSelectedRowKeys])

  const handleSimulateFailure = useCallback(() => {
    void execute(async () => {
      await wait(uiKitContract.interactions.simulatedLatencyMs)
      throw new Error('Не удалось применить групповое действие. Повторите попытку.')
    })
  }, [execute])

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          {title}
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {description}
        </Typography.Paragraph>
      </Card>

      <Card title="Фильтры и действия">
        <Form<FilterValues>
          form={form}
          layout="inline"
          initialValues={{ status: 'all' }}
          onFinish={handleApplyFilters}
        >
          <Form.Item<FilterValues>
            label="Поиск"
            name="query"
            rules={[
              {
                max: uiKitContract.filters.maxQueryLength,
                message: `Максимум ${uiKitContract.filters.maxQueryLength} символов.`,
              },
              {
                validator: (_, value: string | undefined) => {
                  if (value === undefined || value.trim().length === 0) {
                    return Promise.resolve()
                  }

                  if (value.trim().length >= uiKitContract.filters.minQueryLength) {
                    return Promise.resolve()
                  }

                  return Promise.reject(
                    new Error(`Минимум ${uiKitContract.filters.minQueryLength} символа(ов).`),
                  )
                },
              },
            ]}
          >
            <Input
              allowClear
              placeholder="Фильтр по тексту контракта"
              style={{ width: 260 }}
            />
          </Form.Item>

          <Form.Item<FilterValues> label="Статус" name="status">
            <Select
              options={checklistStatusOptions}
              style={{ width: 170 }}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={isLoading}>
                Применить
              </Button>
              <Button onClick={handleReset} disabled={isLoading}>
                Сбросить
              </Button>
              <Button onClick={handleSimulateFailure} disabled={isLoading}>
                Смоделировать ошибку
              </Button>
            </Space>
          </Form.Item>
        </Form>

        <Alert
          showIcon
          type="info"
          message="Базовый табличный UX: действия выполняются из панели инструментов, а не из кнопок в строках."
          style={{ marginTop: 12 }}
        />
      </Card>

      <TableFirstCard<ChecklistRow>
        title="Базовый контракт таблицы"
        columns={columns}
        dataSource={rows}
        rowKey="id"
        loading={isLoading}
        selectedRowKeys={selectedRowKeys}
        onSelectionChange={handleSelectionChange}
        errorMessage={errorMessage}
        emptyDescription="По текущим фильтрам правила не найдены."
        toolbar={(
          <Button
            danger
            onClick={handleRemoveSelected}
            disabled={selectedRowKeys.length === 0 || isLoading}
          >
            Удалить выбранные
          </Button>
        )}
      />
    </Space>
  )
}

