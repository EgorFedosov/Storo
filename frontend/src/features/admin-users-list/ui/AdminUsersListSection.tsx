import { Alert, Button, Card, Form, Input, Select, Space, Table, Tag, Typography } from 'antd'
import type { TableProps } from 'antd'
import type { FilterValue, TablePaginationConfig } from 'antd/es/table/interface'
import { useCallback, useEffect, useMemo } from 'react'
import type { Key } from 'react'
import type {
  AdminUserListItem,
  AdminUsersBlockedFilter,
  AdminUsersRoleFilter,
  AdminUsersSortDirection,
  AdminUsersSortField,
} from '../../../entities/admin-user/model/types.ts'
import { adminUsersContract } from '../../../entities/admin-user/model/types.ts'
import { useAdminUsersListModel } from '../model/useAdminUsersListModel.ts'

type AdminUsersFiltersFormValues = {
  query: string
  blocked: AdminUsersBlockedFilter
  role: AdminUsersRoleFilter
}

const blockedFilterOptions: Array<{ label: string; value: AdminUsersBlockedFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Blocked only', value: 'true' },
  { label: 'Active only', value: 'false' },
]

const roleFilterOptions: Array<{ label: string; value: AdminUsersRoleFilter }> = [
  { label: 'All roles', value: 'all' },
  { label: 'Admins', value: 'admin' },
  { label: 'Users', value: 'user' },
]

function toSortOrder(direction: AdminUsersSortDirection): 'ascend' | 'descend' {
  return direction === 'asc' ? 'ascend' : 'descend'
}

function toDateTimeLabel(utcDateTime: string): string {
  const parsedValue = Date.parse(utcDateTime)
  if (Number.isNaN(parsedValue)) {
    return utcDateTime
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsedValue)
}

function toValidationErrorDescription(errors: Record<string, string>): string {
  return Object.entries(errors)
    .map(([field, message]) => `${field}: ${message}`)
    .join(' | ')
}

function toSortField(columnKey: Key | undefined): AdminUsersSortField | null {
  if (columnKey !== 'updatedAt' && columnKey !== 'createdAt' && columnKey !== 'userName' && columnKey !== 'email') {
    return null
  }

  return columnKey
}

function toSortDirection(order: 'ascend' | 'descend' | null | undefined): AdminUsersSortDirection | null {
  if (order === undefined || order === null) {
    return null
  }

  return order === 'ascend' ? 'asc' : 'desc'
}

export function AdminUsersListSection() {
  const [form] = Form.useForm<AdminUsersFiltersFormValues>()
  const {
    queryState,
    routeValidationErrors,
    pageData,
    isLoading,
    errorMessage,
    applyFilters,
    resetFilters,
    applyTableChange,
    retry,
  } = useAdminUsersListModel()

  useEffect(() => {
    form.setFieldsValue({
      query: queryState.query ?? '',
      blocked: queryState.blocked,
      role: queryState.role,
    })
  }, [form, queryState.blocked, queryState.query, queryState.role])

  const columns = useMemo<NonNullable<TableProps<AdminUserListItem>['columns']>>(
    () => [
      {
        title: 'User Name',
        dataIndex: 'userName',
        key: 'userName',
        sorter: true,
        sortOrder: queryState.sortField === 'userName' ? toSortOrder(queryState.sortDirection) : null,
      },
      {
        title: 'Email',
        dataIndex: 'email',
        key: 'email',
        sorter: true,
        sortOrder: queryState.sortField === 'email' ? toSortOrder(queryState.sortDirection) : null,
      },
      {
        title: 'Display Name',
        dataIndex: 'displayName',
        key: 'displayName',
      },
      {
        title: 'Roles',
        dataIndex: 'roles',
        key: 'roles',
        render: (roles: readonly string[]) => (
          <Space size={[4, 4]} wrap>
            {roles.map((role) => (
              <Tag key={role} color={role.toLowerCase() === 'admin' ? 'gold' : 'default'}>
                {role}
              </Tag>
            ))}
          </Space>
        ),
      },
      {
        title: 'Status',
        dataIndex: 'isBlocked',
        key: 'isBlocked',
        render: (isBlocked: boolean) => (
          <Tag color={isBlocked ? 'red' : 'green'}>
            {isBlocked ? 'Blocked' : 'Active'}
          </Tag>
        ),
      },
      {
        title: 'Created',
        dataIndex: 'createdAt',
        key: 'createdAt',
        sorter: true,
        sortOrder: queryState.sortField === 'createdAt' ? toSortOrder(queryState.sortDirection) : null,
        render: (value: string) => toDateTimeLabel(value),
      },
      {
        title: 'Updated',
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        sorter: true,
        defaultSortOrder: 'descend',
        sortOrder: queryState.sortField === 'updatedAt' ? toSortOrder(queryState.sortDirection) : null,
        render: (value: string) => toDateTimeLabel(value),
      },
    ],
    [queryState.sortDirection, queryState.sortField],
  )

  const handleFiltersSubmit = useCallback(
    (values: AdminUsersFiltersFormValues) => {
      applyFilters({
        blocked: values.blocked,
        role: values.role,
        query: values.query ?? '',
      })
    },
    [applyFilters],
  )

  const handleFiltersReset = useCallback(() => {
    form.resetFields()
    resetFilters()
  }, [form, resetFilters])

  const handleTableChange = useCallback(
    (
      pagination: TablePaginationConfig,
      _: Record<string, FilterValue | null>,
      sorter: Parameters<NonNullable<TableProps<AdminUserListItem>['onChange']>>[2],
    ) => {
      const nextPage = pagination.current ?? queryState.page
      const nextPageSize = pagination.pageSize ?? queryState.pageSize
      const primarySorter = Array.isArray(sorter) ? sorter[0] : sorter
      const nextSortField = toSortField(primarySorter?.columnKey)
      const nextSortDirection = toSortDirection(primarySorter?.order)

      applyTableChange({
        page: nextPage,
        pageSize: nextPageSize,
        sortField: nextSortField,
        sortDirection: nextSortDirection,
      })
    },
    [applyTableChange, queryState.page, queryState.pageSize],
  )

  const normalizedRouteValidationErrors = Object.fromEntries(
    Object.entries(routeValidationErrors).filter(([, message]) => typeof message === 'string' && message.length > 0),
  ) as Record<string, string>

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          Admin Users
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          Table-first list of users with server-side filters, sorting, and pagination via
          {' '}
          <Typography.Text code>/api/v1/admin/users</Typography.Text>
          .
        </Typography.Paragraph>
      </Card>

      <Card title="Filters">
        <Form<AdminUsersFiltersFormValues>
          form={form}
          layout="inline"
          initialValues={{
            query: queryState.query ?? '',
            blocked: queryState.blocked,
            role: queryState.role,
          }}
          onFinish={handleFiltersSubmit}
        >
          <Form.Item<AdminUsersFiltersFormValues>
            label="Query"
            name="query"
            rules={[
              {
                max: adminUsersContract.maxQueryLength,
                message: `Max ${String(adminUsersContract.maxQueryLength)} characters.`,
              },
            ]}
          >
            <Input
              allowClear
              placeholder="userName or email"
              maxLength={adminUsersContract.maxQueryLength}
              style={{ width: 260 }}
            />
          </Form.Item>

          <Form.Item<AdminUsersFiltersFormValues> label="Blocked" name="blocked">
            <Select options={blockedFilterOptions} style={{ width: 170 }} />
          </Form.Item>

          <Form.Item<AdminUsersFiltersFormValues> label="Role" name="role">
            <Select options={roleFilterOptions} style={{ width: 170 }} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={isLoading}>
                Apply
              </Button>
              <Button onClick={handleFiltersReset} disabled={isLoading}>
                Reset
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card title="Users">
        {Object.keys(normalizedRouteValidationErrors).length > 0 ? (
          <Alert
            showIcon
            type="warning"
            message="Invalid route query params"
            description={toValidationErrorDescription(normalizedRouteValidationErrors)}
            style={{ marginBottom: 12 }}
          />
        ) : null}

        {errorMessage !== null ? (
          <Alert
            showIcon
            type="error"
            message="Failed to load admin users list"
            description={errorMessage}
            action={(
              <Button type="primary" size="small" onClick={retry}>
                Retry
              </Button>
            )}
            style={{ marginBottom: 12 }}
          />
        ) : null}

        <Table<AdminUserListItem>
          rowKey="id"
          columns={columns}
          dataSource={pageData?.items ? [...pageData.items] : []}
          loading={isLoading}
          onChange={handleTableChange}
          pagination={{
            current: queryState.page,
            pageSize: queryState.pageSize,
            total: pageData?.totalCount ?? 0,
            showSizeChanger: true,
            pageSizeOptions: ['20', '50', '100'],
            showTotal: (total, range) => `${String(range[0])}-${String(range[1])} of ${String(total)}`,
          }}
          locale={{
            emptyText: 'No users matched current filters.',
          }}
        />
      </Card>
    </Space>
  )
}
