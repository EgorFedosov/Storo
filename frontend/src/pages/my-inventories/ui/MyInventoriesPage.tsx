import { ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import type { TablePaginationConfig, TableProps } from 'antd'
import type { SortOrder, SorterResult } from 'antd/es/table/interface'
import { useMemo, useState } from 'react'
import { useCurrentUser } from '../../../features/auth/model/useCurrentUser.ts'
import { navigate } from '../../../shared/lib/router/navigation.ts'
import {
  myInventoriesContract,
  type InventoryRelation,
  type UserInventoryRow,
  type UserInventoriesSortDirection,
  type UserInventoriesSortField,
} from '../model/contracts.ts'
import { useMyInventoriesModel } from '../model/useMyInventoriesModel.ts'

const relationLabels: Record<InventoryRelation, string> = {
  owned: 'Owned',
  writable: 'Writable',
}

const relationDescriptions: Record<InventoryRelation, string> = {
  owned: 'Inventories created by you.',
  writable: 'Inventories where you can add or edit items.',
}

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatUtcDate(value: string): string {
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp)
    ? value
    : dateTimeFormatter.format(new Date(timestamp))
}

function resolveSortOrder(
  activeField: UserInventoriesSortField,
  activeDirection: UserInventoriesSortDirection,
  columnField: UserInventoriesSortField,
): SortOrder {
  if (activeField !== columnField) {
    return null
  }

  return activeDirection === 'asc' ? 'ascend' : 'descend'
}

function parseSortField(columnKey: unknown): UserInventoriesSortField | null {
  if (
    columnKey === 'updatedAt'
    || columnKey === 'createdAt'
    || columnKey === 'title'
    || columnKey === 'itemsCount'
  ) {
    return columnKey
  }

  return null
}

function parseSortDirection(order: SortOrder): UserInventoriesSortDirection | null {
  if (order === 'ascend') {
    return 'asc'
  }

  if (order === 'descend') {
    return 'desc'
  }

  return null
}

export function MyInventoriesPage() {
  const [activeRelation, setActiveRelation] = useState<InventoryRelation>('owned')
  const { currentUser } = useCurrentUser()
  const {
    tables,
    updateDraftQuery,
    applyQuery,
    resetQuery,
    updateGridState,
    refreshRelation,
  } = useMyInventoriesModel()

  const tabItems = useMemo(
    () =>
      (['owned', 'writable'] as const).map((relation) => {
        const tableState = tables[relation]

        const columns: NonNullable<TableProps<UserInventoryRow>['columns']> = [
          {
            title: 'Title',
            dataIndex: 'title',
            key: 'title',
            sorter: true,
            sortOrder: resolveSortOrder(
              tableState.controls.sortField,
              tableState.controls.sortDirection,
              'title',
            ),
            render: (_, row) => (
              <Typography.Link onClick={() => navigate(`/inventory/${row.id}`)}>
                {row.title}
              </Typography.Link>
            ),
          },
          {
            title: 'Category',
            dataIndex: ['category', 'name'],
            key: 'category',
            width: 180,
          },
          {
            title: 'Owner',
            dataIndex: 'owner',
            key: 'owner',
            width: 220,
            render: (_, row) => (
              <Space direction="vertical" size={0}>
                <Typography.Text>{row.owner.displayName}</Typography.Text>
                <Typography.Text type="secondary">@{row.owner.userName}</Typography.Text>
              </Space>
            ),
          },
          {
            title: 'Access',
            dataIndex: 'isPublic',
            key: 'isPublic',
            width: 120,
            render: (isPublic: boolean) => (
              <Tag color={isPublic ? 'green' : 'gold'}>
                {isPublic ? 'Public' : 'Restricted'}
              </Tag>
            ),
          },
          {
            title: 'Items',
            dataIndex: 'itemsCount',
            key: 'itemsCount',
            align: 'right',
            width: 110,
            sorter: true,
            sortOrder: resolveSortOrder(
              tableState.controls.sortField,
              tableState.controls.sortDirection,
              'itemsCount',
            ),
          },
          {
            title: 'Created',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 190,
            sorter: true,
            sortOrder: resolveSortOrder(
              tableState.controls.sortField,
              tableState.controls.sortDirection,
              'createdAt',
            ),
            render: (value: string) => formatUtcDate(value),
          },
          {
            title: 'Updated',
            dataIndex: 'updatedAt',
            key: 'updatedAt',
            width: 190,
            sorter: true,
            defaultSortOrder: 'descend',
            sortOrder: resolveSortOrder(
              tableState.controls.sortField,
              tableState.controls.sortDirection,
              'updatedAt',
            ),
            render: (value: string) => formatUtcDate(value),
          },
        ]

        const handleTableChange: TableProps<UserInventoryRow>['onChange'] = (
          pagination: TablePaginationConfig,
          _filters,
          sorter: SorterResult<UserInventoryRow> | SorterResult<UserInventoryRow>[],
        ) => {
          const nextSorter = Array.isArray(sorter) ? sorter[0] : sorter
          const sortFieldFromTable = parseSortField(nextSorter?.columnKey)
          const sortDirectionFromTable = parseSortDirection(nextSorter?.order ?? null)

          const nextSortField = sortFieldFromTable ?? myInventoriesContract.defaultSortField
          const nextSortDirection = sortDirectionFromTable ?? myInventoriesContract.defaultSortDirection
          const sortChanged = (
            nextSortField !== tableState.controls.sortField
            || nextSortDirection !== tableState.controls.sortDirection
          )

          const nextPageSize = pagination.pageSize ?? tableState.controls.pageSize
          const pageSizeChanged = nextPageSize !== tableState.controls.pageSize
          const nextPage = sortChanged || pageSizeChanged
            ? myInventoriesContract.defaultPage
            : (pagination.current ?? tableState.controls.page)

          updateGridState(relation, {
            page: nextPage,
            pageSize: nextPageSize,
            sortField: nextSortField,
            sortDirection: nextSortDirection,
          })
        }

        return {
          key: relation,
          label: (
            <Space size={8}>
              <span>{relationLabels[relation]}</span>
              {tableState.data !== null ? <Tag>{tableState.data.totalCount}</Tag> : null}
            </Space>
          ),
          children: (
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Card>
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Typography.Text type="secondary">
                    {relationDescriptions[relation]}
                  </Typography.Text>

                  <Space wrap>
                    <Input
                      allowClear
                      placeholder="Filter by inventory title"
                      value={tableState.draftQuery}
                      maxLength={myInventoriesContract.maxQueryLength}
                      onChange={(event) => updateDraftQuery(relation, event.target.value)}
                      onPressEnter={() => applyQuery(relation)}
                      style={{ width: 320 }}
                      prefix={<SearchOutlined />}
                    />
                    <Button
                      type="primary"
                      onClick={() => applyQuery(relation)}
                    >
                      Apply
                    </Button>
                    <Button onClick={() => resetQuery(relation)}>
                      Reset
                    </Button>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={() => refreshRelation(relation)}
                      loading={tableState.status === 'loading'}
                    >
                      Refresh
                    </Button>
                  </Space>
                </Space>
              </Card>

              {tableState.errorMessage !== null ? (
                <Alert
                  showIcon
                  type="error"
                  message={`Failed to load ${relationLabels[relation].toLowerCase()} inventories`}
                  description={tableState.errorMessage}
                  action={(
                    <Button size="small" type="primary" onClick={() => refreshRelation(relation)}>
                      Retry
                    </Button>
                  )}
                />
              ) : null}

              <Table<UserInventoryRow>
                rowKey="id"
                columns={columns}
                dataSource={[...(tableState.data?.items ?? [])]}
                loading={tableState.status === 'loading'}
                onChange={handleTableChange}
                onRow={(row) => ({
                  onClick: () => navigate(`/inventory/${row.id}`),
                  style: { cursor: 'pointer' },
                })}
                locale={{
                  emptyText: (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="No inventories found for current filters."
                    />
                  ),
                }}
                pagination={{
                  current: tableState.data?.page ?? tableState.controls.page,
                  pageSize: tableState.data?.pageSize ?? tableState.controls.pageSize,
                  total: tableState.data?.totalCount ?? 0,
                  showSizeChanger: true,
                  pageSizeOptions: ['10', '20', '50', '100'],
                  showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
                }}
              />
            </Space>
          ),
        }
      }),
    [tables, updateDraftQuery, applyQuery, resetQuery, updateGridState, refreshRelation],
  )

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 4 }}>
          My Inventories
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          Table-first personal workspace with separate views for owned and writable inventories.
        </Typography.Paragraph>
        <Space wrap size={8}>
          <Tag color="blue">{currentUser.displayName}</Tag>
          <Tag>@{currentUser.userName}</Tag>
        </Space>
      </Card>

      <Tabs
        activeKey={activeRelation}
        onChange={(nextKey) => setActiveRelation(nextKey as InventoryRelation)}
        items={tabItems}
      />
    </Space>
  )
}
