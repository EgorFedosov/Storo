import { ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Empty, Form, Input, Select, Space, Table, Tag, Typography } from 'antd'
import type { TableProps } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { navigate } from '../../../shared/lib/router/navigation.ts'
import {
  inventorySearchContract,
  inventorySearchSortOptions,
  normalizeInventorySearchQueryInput,
  normalizeInventorySearchTagInput,
  toRouteSortParam,
  useSearchInventoriesModel,
  type InventorySearchSortValue,
  type SearchInventoriesRouteState,
} from '../model/useSearchInventoriesModel.ts'

export type SearchInventoriesRoutePatch = Partial<
Pick<SearchInventoriesRouteState, 'q' | 'tag' | 'page' | 'pageSize' | 'sort'>
>

type SearchInventoriesScreenProps = {
  routeState: SearchInventoriesRouteState
  onApplyRoute: (routePatch: SearchInventoriesRoutePatch) => void
}

type SearchInventoriesFormValues = {
  q: string
  tag: string
}

type SearchInventoryTableRow = {
  key: string
  id: string
  title: string
  descriptionMarkdown: string
  categoryName: string
  creatorDisplayName: string
  creatorUserName: string
  tags: ReadonlyArray<{ id: string; name: string }>
  isPublic: boolean
  itemsCount: number
  updatedAt: string
}

const pageSizeOptions = ['20', '50', '100']

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString()
}

function createSearchSummary(routeState: SearchInventoriesRouteState): string {
  if (routeState.q !== null && routeState.tag !== null) {
    return `q="${routeState.q}", tag="${routeState.tag}"`
  }

  if (routeState.q !== null) {
    return `q="${routeState.q}"`
  }

  if (routeState.tag !== null) {
    return `tag="${routeState.tag}"`
  }

  return 'пустой запрос'
}

function resolveSortLabel(value: InventorySearchSortValue): string {
  switch (value) {
    case 'relevance:desc':
      return 'Релевантность (лучшее совпадение)'
    case 'relevance:asc':
      return 'Релевантность (слабее совпадения выше)'
    case 'updatedAt:desc':
      return 'По обновлению (сначала новые)'
    case 'updatedAt:asc':
      return 'По обновлению (сначала старые)'
    case 'createdAt:desc':
      return 'По созданию (сначала новые)'
    case 'createdAt:asc':
      return 'По созданию (сначала старые)'
    case 'title:asc':
      return 'Название (А-Я)'
    case 'title:desc':
      return 'Название (Я-А)'
    default:
      return value
  }
}

export function SearchInventoriesScreen({ routeState, onApplyRoute }: SearchInventoriesScreenProps) {
  const [form] = Form.useForm<SearchInventoriesFormValues>()
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null)

  const {
    data,
    isLoading,
    canRequest,
    errorMessage,
    apiValidationMessages,
    routeValidationMessages,
    normalizedSort,
    retry,
  } = useSearchInventoriesModel(routeState)

  useEffect(() => {
    form.setFieldsValue({
      q: routeState.q ?? '',
      tag: routeState.tag ?? '',
    })
  }, [form, routeState.q, routeState.tag])

  const tableRows = useMemo<SearchInventoryTableRow[]>(
    () =>
      (data?.items ?? []).map((inventory) => ({
        key: inventory.id,
        id: inventory.id,
        title: inventory.title,
        descriptionMarkdown: inventory.descriptionMarkdown,
        categoryName: inventory.category.name,
        creatorDisplayName: inventory.creator.displayName,
        creatorUserName: inventory.creator.userName,
        tags: inventory.tags,
        isPublic: inventory.isPublic,
        itemsCount: inventory.itemsCount,
        updatedAt: inventory.updatedAt,
      })),
    [data],
  )

  const handleSubmit = useCallback(
    (values: SearchInventoriesFormValues) => {
      const normalizedQuery = normalizeInventorySearchQueryInput(values.q)
      const normalizedTag = normalizeInventorySearchTagInput(values.tag)

      if (normalizedQuery === null && normalizedTag === null) {
        setFormErrorMessage('Укажите q или tag для запуска поиска.')
        return
      }

      setFormErrorMessage(null)
      onApplyRoute({
        q: normalizedQuery,
        tag: normalizedTag,
        page: 1,
      })
    },
    [onApplyRoute],
  )

  const handleSortChange = useCallback(
    (nextSort: InventorySearchSortValue) => {
      onApplyRoute({
        sort: toRouteSortParam(nextSort),
        page: 1,
      })
    },
    [onApplyRoute],
  )

  const handleTableChange = useCallback<NonNullable<TableProps<SearchInventoryTableRow>['onChange']>>(
    (paginationState) => {
      const nextPage = paginationState.current ?? routeState.page
      const nextPageSize = paginationState.pageSize ?? routeState.pageSize
      const normalizedPage = nextPageSize !== routeState.pageSize ? 1 : nextPage

      if (normalizedPage === routeState.page && nextPageSize === routeState.pageSize) {
        return
      }

      onApplyRoute({
        page: normalizedPage,
        pageSize: nextPageSize,
      })
    },
    [onApplyRoute, routeState.page, routeState.pageSize],
  )

  const sortOptions = useMemo(
    () => inventorySearchSortOptions.map((option) => ({
      value: option.value,
      label: resolveSortLabel(option.value),
    })),
    [],
  )

  const columns = useMemo<NonNullable<TableProps<SearchInventoryTableRow>['columns']>>(
    () => [
      {
        title: 'Инвентарь',
        dataIndex: 'title',
        key: 'title',
        width: 340,
        render: (_, row) => (
          <Space direction="vertical" size={2}>
            <Typography.Link onClick={() => navigate(`/inventory/${row.id}`)}>
              {row.title}
            </Typography.Link>
            <Typography.Text type="secondary">
              {row.descriptionMarkdown.length > 0 ? row.descriptionMarkdown : 'Без описания'}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: 'Категория',
        dataIndex: 'categoryName',
        key: 'categoryName',
        width: 180,
      },
      {
        title: 'Автор',
        dataIndex: 'creatorDisplayName',
        key: 'creator',
        width: 220,
        render: (_, row) => (
          <Space direction="vertical" size={2}>
            <span>{row.creatorDisplayName}</span>
            <Typography.Text type="secondary">@{row.creatorUserName}</Typography.Text>
          </Space>
        ),
      },
      {
        title: 'Теги',
        dataIndex: 'tags',
        key: 'tags',
        width: 260,
        render: (tags: SearchInventoryTableRow['tags']) => (
          <Space size={[4, 4]} wrap>
            {tags.length > 0
              ? tags.map((tag) => (
                <Tag key={tag.id}>
                  {tag.name}
                </Tag>
              ))
              : <Typography.Text type="secondary">Без тегов</Typography.Text>}
          </Space>
        ),
      },
      {
        title: 'Доступ',
        dataIndex: 'isPublic',
        key: 'isPublic',
        width: 120,
        render: (isPublic: boolean) => (
          <Tag color={isPublic ? 'green' : 'default'}>
            {isPublic ? 'Публичный' : 'Ограниченный'}
          </Tag>
        ),
      },
      {
        title: 'Предметы',
        dataIndex: 'itemsCount',
        key: 'itemsCount',
        width: 100,
        align: 'right',
      },
      {
        title: 'Обновлен',
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        width: 190,
        render: (updatedAt: string) => formatDateTime(updatedAt),
      },
    ],
    [],
  )

  const routeValidationMessage = routeValidationMessages.join(' | ')
  const apiValidationMessage = apiValidationMessages.join(' | ')

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card
        title="Поиск инвентарей"
        extra={(
          <Space size={8}>
            <Typography.Text type="secondary">
              {canRequest ? createSearchSummary(routeState) : 'Ожидаются корректные параметры запроса'}
            </Typography.Text>
            <Button
              icon={<ReloadOutlined />}
              onClick={retry}
              disabled={!canRequest || isLoading}
            >
              Обновить
            </Button>
          </Space>
        )}
      >
        <Form<SearchInventoriesFormValues>
          form={form}
          layout="inline"
          onFinish={handleSubmit}
        >
          <Form.Item<SearchInventoriesFormValues> label="q" name="q">
            <Input
              allowClear
              maxLength={inventorySearchContract.maxQueryLength}
              placeholder="Текст поиска"
              style={{ width: 260 }}
            />
          </Form.Item>

          <Form.Item<SearchInventoriesFormValues> label="tag" name="tag">
            <Input
              allowClear
              maxLength={inventorySearchContract.maxTagLength}
              placeholder="Фильтр по тегу"
              style={{ width: 220 }}
            />
          </Form.Item>

          <Form.Item label="Сортировка">
            <Select<InventorySearchSortValue>
              value={normalizedSort.value}
              options={sortOptions}
              onChange={handleSortChange}
              style={{ width: 250 }}
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={isLoading}>
              Найти
            </Button>
          </Form.Item>
        </Form>

        {formErrorMessage !== null ? (
          <Alert
            showIcon
            type="warning"
            message="Проверка формы поиска"
            description={formErrorMessage}
            style={{ marginTop: 12 }}
          />
        ) : null}

        {routeValidationMessages.length > 0 ? (
          <Alert
            showIcon
            type="warning"
            message="Некорректные параметры в URL"
            description={routeValidationMessage}
            style={{ marginTop: 12 }}
          />
        ) : null}

        {apiValidationMessages.length > 0 ? (
          <Alert
            showIcon
            type="warning"
            message="Ошибка валидации API поиска"
            description={apiValidationMessage}
            style={{ marginTop: 12 }}
          />
        ) : null}

        {errorMessage !== null ? (
          <Alert
            showIcon
            type="error"
            message="Ошибка поиска инвентарей"
            description={errorMessage}
            style={{ marginTop: 12 }}
          />
        ) : null}
      </Card>

      <Card title="Таблица инвентарей">
        <Table<SearchInventoryTableRow>
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={tableRows}
          loading={isLoading}
          pagination={{
            current: data?.page ?? routeState.page,
            pageSize: data?.pageSize ?? routeState.pageSize,
            total: data?.totalCount ?? 0,
            pageSizeOptions,
            showSizeChanger: true,
            showTotal: (total, range) => `${String(range[0])}-${String(range[1])} из ${String(total)}`,
          }}
          onChange={handleTableChange}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  canRequest
                    ? 'По текущим фильтрам ничего не найдено.'
                    : 'Укажите параметры поиска, чтобы увидеть результат.'
                }
              />
            ),
          }}
        />
      </Card>
    </Space>
  )
}
