import { Alert, Button, Card, Form, Input, Popconfirm, Result, Select, Space, Table, Tag, Typography, message } from 'antd'
import type { TableProps } from 'antd'
import type { FilterValue, TablePaginationConfig } from 'antd/es/table/interface'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Key } from 'react'
import type {
  AdminModerationAction,
  AdminUserListItem,
  AdminUsersBlockedFilter,
  AdminUsersRoleFilter,
  AdminUsersSortDirection,
  AdminUsersSortField,
} from '../../../entities/admin-user/model/types.ts'
import { adminUsersContract } from '../../../entities/admin-user/model/types.ts'
import { useCurrentUser } from '../../auth/model/useCurrentUser.ts'
import { useAdminUsersListModel } from '../model/useAdminUsersListModel.ts'

type AdminUsersFiltersFormValues = {
  query: string
  blocked: AdminUsersBlockedFilter
  role: AdminUsersRoleFilter
}

const blockedFilterOptions: Array<{ label: string; value: AdminUsersBlockedFilter }> = [
  { label: 'Все', value: 'all' },
  { label: 'Только заблокированные', value: 'true' },
  { label: 'Только активные', value: 'false' },
]

const roleFilterOptions: Array<{ label: string; value: AdminUsersRoleFilter }> = [
  { label: 'Все роли', value: 'all' },
  { label: 'Администраторы', value: 'admin' },
  { label: 'Пользователи', value: 'user' },
]

const moderationActionLabelMap: Record<AdminModerationAction, string> = {
  block: 'Блокировка',
  unblock: 'Разблокировка',
  grant_admin: 'Выдать админ-права',
  revoke_admin: 'Снять админ-права',
  delete: 'Удаление пользователя',
}

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

function hasAdminRole(user: AdminUserListItem): boolean {
  return user.roles.some((role) => role.trim().toLowerCase() === 'admin')
}

function getRoleTagStyle(role: string): { backgroundColor: string; borderColor: string; color: string } {
  const normalizedRole = role.trim().toLowerCase()
  if (normalizedRole === 'admin') {
    return {
      backgroundColor: '#fff7e6',
      borderColor: '#ffd591',
      color: '#ad6800',
    }
  }

  return {
    backgroundColor: '#f0f5ff',
    borderColor: '#adc6ff',
    color: '#1d39c4',
  }
}

function getStatusTagStyle(isBlocked: boolean): { backgroundColor: string; borderColor: string; color: string } {
  if (isBlocked) {
    return {
      backgroundColor: '#fff1f0',
      borderColor: '#ffa39e',
      color: '#cf1322',
    }
  }

  return {
    backgroundColor: '#f6ffed',
    borderColor: '#b7eb8f',
    color: '#389e0d',
  }
}

function normalizeSelectedTableKey(rawKey: Key | undefined): string | null {
  if (rawKey === undefined || rawKey === null) {
    return null
  }

  const normalizedKey = String(rawKey).trim()
  return normalizedKey.length > 0 ? normalizedKey : null
}

export function AdminUsersListSection() {
  const [form] = Form.useForm<AdminUsersFiltersFormValues>()
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [messageApi, messageContextHolder] = message.useMessage()
  const { currentUser, isAuthenticated, permissions, retryBootstrap } = useCurrentUser()
  const {
    queryState,
    routeValidationErrors,
    pageData,
    isLoading,
    errorMessage,
    moderationErrorMessage,
    moderationInFlight,
    applyFilters,
    resetFilters,
    applyTableChange,
    retry,
    clearModerationError,
    executeModerationAction,
  } = useAdminUsersListModel(isAuthenticated)

  useEffect(() => {
    form.setFieldsValue({
      query: queryState.query ?? '',
      blocked: queryState.blocked,
      role: queryState.role,
    })
  }, [form, queryState.blocked, queryState.query, queryState.role])

  const selectedUser = useMemo(() => {
    if (selectedUserId === null || pageData === null) {
      return null
    }

    return pageData.items.find((item) => item.id === selectedUserId) ?? null
  }, [pageData, selectedUserId])

  const selectedUserHasAdminRole = selectedUser !== null && hasAdminRole(selectedUser)
  const canModerateUsers = permissions.canManageUsers
  const moderationActionInFlight = moderationInFlight?.action ?? null
  const moderationBusy = moderationInFlight !== null

  const canBlock = canModerateUsers && selectedUser !== null && !selectedUser.isBlocked && !isLoading && !moderationBusy
  const canUnblock = canModerateUsers && selectedUser !== null && selectedUser.isBlocked && !isLoading && !moderationBusy
  const canGrantAdmin = canModerateUsers && selectedUser !== null && !selectedUserHasAdminRole && !isLoading && !moderationBusy
  const canRevokeAdmin = canModerateUsers && selectedUser !== null && selectedUserHasAdminRole && !isLoading && !moderationBusy
  const canDelete = canModerateUsers && selectedUser !== null && !isLoading && !moderationBusy

  const columns = useMemo<NonNullable<TableProps<AdminUserListItem>['columns']>>(
    () => [
      {
        title: 'Имя пользователя',
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
        title: 'Отображаемое имя',
        dataIndex: 'displayName',
        key: 'displayName',
      },
      {
        title: 'Роли',
        dataIndex: 'roles',
        key: 'roles',
        render: (roles: readonly string[]) => (
          <Space size={[4, 4]} wrap>
            {roles.map((role) => (
              <Tag
                key={role}
                color={role.toLowerCase() === 'admin' ? 'gold' : 'geekblue'}
                style={getRoleTagStyle(role)}
              >
                {role}
              </Tag>
            ))}
          </Space>
        ),
      },
      {
        title: 'Статус',
        dataIndex: 'isBlocked',
        key: 'isBlocked',
        render: (isBlocked: boolean) => (
          <Tag color={isBlocked ? 'red' : 'green'} style={getStatusTagStyle(isBlocked)}>
            {isBlocked ? 'Заблокирован' : 'Активен'}
          </Tag>
        ),
      },
      {
        title: 'Создан',
        dataIndex: 'createdAt',
        key: 'createdAt',
        sorter: true,
        sortOrder: queryState.sortField === 'createdAt' ? toSortOrder(queryState.sortDirection) : null,
        render: (value: string) => toDateTimeLabel(value),
      },
      {
        title: 'Обновлен',
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

  const rowSelection = useMemo<NonNullable<TableProps<AdminUserListItem>['rowSelection']>>(
    () => ({
      type: 'radio',
      selectedRowKeys: selectedUser === null ? [] : [selectedUser.id],
      onChange: (selectedRowKeys) => {
        const nextSelectedUserId = normalizeSelectedTableKey(selectedRowKeys[0])
        setSelectedUserId(nextSelectedUserId)
        clearModerationError()
      },
    }),
    [clearModerationError, selectedUser],
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

  const handleModerationAction = useCallback(
    async (action: AdminModerationAction) => {
      if (!canModerateUsers) {
        messageApi.warning('Действия модерации доступны только администраторам.')
        return
      }

      if (selectedUser === null) {
        return
      }

      const affectsCurrentUser = selectedUser.id === currentUser.id
      const result = await executeModerationAction(action, selectedUser)

      if (result.ok) {
        messageApi.success(result.message)
        if (action === 'delete') {
          setSelectedUserId((currentValue) => (currentValue === selectedUser.id ? null : currentValue))
        }

        if (affectsCurrentUser) {
          retryBootstrap()
        }

        return
      }

      if (result.message !== 'Запрос модерации был отменен.') {
        messageApi.error(result.message)
      }
    },
    [canModerateUsers, currentUser.id, executeModerationAction, messageApi, retryBootstrap, selectedUser],
  )

  if (!isAuthenticated) {
    return (
      <Result
        status="403"
        title="Требуется авторизация"
        subTitle="Чтобы просматривать список пользователей, войдите в аккаунт."
      />
    )
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {messageContextHolder}

      <Card>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          Пользователи
        </Typography.Title>
      </Card>

      <Card title="Фильтры">
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
            label="Поиск"
            name="query"
            rules={[
              {
                max: adminUsersContract.maxQueryLength,
                message: `Максимум ${String(adminUsersContract.maxQueryLength)} символов.`,
              },
            ]}
          >
            <Input
              allowClear
              placeholder="имя пользователя или email"
              maxLength={adminUsersContract.maxQueryLength}
              style={{ width: 260 }}
            />
          </Form.Item>

          <Form.Item<AdminUsersFiltersFormValues> label="Блокировка" name="blocked">
            <Select options={blockedFilterOptions} style={{ width: 170 }} />
          </Form.Item>

          <Form.Item<AdminUsersFiltersFormValues> label="Роль" name="role">
            <Select options={roleFilterOptions} style={{ width: 170 }} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={isLoading}>
                Применить
              </Button>
              <Button onClick={handleFiltersReset} disabled={isLoading}>
                Сбросить
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card title="Пользователи">
        {Object.keys(normalizedRouteValidationErrors).length > 0 ? (
          <Alert
            showIcon
            type="warning"
            message="Некорректные параметры в URL"
            description={toValidationErrorDescription(normalizedRouteValidationErrors)}
            style={{ marginBottom: 12 }}
          />
        ) : null}

        {errorMessage !== null ? (
          <Alert
            showIcon
            type="error"
            message="Не удалось загрузить список пользователей"
            description={errorMessage}
            action={(
              <Button type="primary" size="small" onClick={retry}>
                Повторить
              </Button>
            )}
            style={{ marginBottom: 12 }}
          />
        ) : null}

        {moderationErrorMessage !== null ? (
          <Alert
            showIcon
            type="error"
            message="Ошибка действия модерации"
            description={moderationErrorMessage}
            closable
            onClose={clearModerationError}
            style={{ marginBottom: 12 }}
          />
        ) : null}

        <Card
          size="small"
          title="Действия модерации"
          style={{ marginBottom: 12 }}
        >
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            <Typography.Text type="secondary">
              Выберите одну строку в таблице и примените действие модерации.
            </Typography.Text>
            {!canModerateUsers ? (
              <Alert
                showIcon
                type="info"
                message="Режим только для просмотра"
                description="Модерация пользователей доступна только администраторам."
              />
            ) : null}

            <Space size={[8, 8]} wrap>
              <Tag
                color={selectedUser === null ? 'orange' : 'blue'}
                style={
                  selectedUser === null
                    ? { backgroundColor: '#fff7e6', borderColor: '#ffd591', color: '#d46b08' }
                    : { backgroundColor: '#e6f4ff', borderColor: '#91caff', color: '#0958d9' }
                }
              >
                {selectedUser === null ? 'Пользователь не выбран' : `@${selectedUser.userName}`}
              </Tag>
              {selectedUser !== null ? (
                <Tag
                  color={selectedUser.isBlocked ? 'red' : 'green'}
                  style={getStatusTagStyle(selectedUser.isBlocked)}
                >
                  {selectedUser.isBlocked ? 'Заблокирован' : 'Активен'}
                </Tag>
              ) : null}
              {selectedUser !== null && selectedUserHasAdminRole ? (
                <Tag color="gold" style={{ backgroundColor: '#fff7e6', borderColor: '#ffd591', color: '#ad6800' }}>Администратор</Tag>
              ) : null}
              {moderationInFlight !== null ? (
                <Tag color="processing" style={{ backgroundColor: '#e6f4ff', borderColor: '#91caff', color: '#0958d9' }}>
                  {`${moderationActionLabelMap[moderationInFlight.action]}...`}
                </Tag>
              ) : null}
            </Space>

            <Space size={[8, 8]} wrap>
              <Popconfirm
                title="Заблокировать выбранного пользователя?"
                description={selectedUser === null ? '' : `@${selectedUser.userName} не сможет входить в систему.`}
                okText="Заблокировать"
                cancelText="Отмена"
                onConfirm={() => void handleModerationAction('block')}
                disabled={!canBlock}
              >
                <Button
                  disabled={!canBlock}
                  loading={moderationActionInFlight === 'block'}
                >
                  Заблокировать
                </Button>
              </Popconfirm>

              <Popconfirm
                title="Разблокировать выбранного пользователя?"
                description={selectedUser === null ? '' : `@${selectedUser.userName} восстановит обычный доступ.`}
                okText="Разблокировать"
                cancelText="Отмена"
                onConfirm={() => void handleModerationAction('unblock')}
                disabled={!canUnblock}
              >
                <Button
                  disabled={!canUnblock}
                  loading={moderationActionInFlight === 'unblock'}
                >
                  Разблокировать
                </Button>
              </Popconfirm>

              <Popconfirm
                title="Выдать роль администратора?"
                description={selectedUser === null ? '' : `@${selectedUser.userName} получит права администратора.`}
                okText="Выдать"
                cancelText="Отмена"
                onConfirm={() => void handleModerationAction('grant_admin')}
                disabled={!canGrantAdmin}
              >
                <Button
                  disabled={!canGrantAdmin}
                  loading={moderationActionInFlight === 'grant_admin'}
                >
                  Выдать админ-права
                </Button>
              </Popconfirm>

              <Popconfirm
                title="Снять роль администратора?"
                description={selectedUser === null ? '' : `@${selectedUser.userName} потеряет права администратора.`}
                okText="Снять"
                cancelText="Отмена"
                onConfirm={() => void handleModerationAction('revoke_admin')}
                disabled={!canRevokeAdmin}
              >
                <Button
                  disabled={!canRevokeAdmin}
                  loading={moderationActionInFlight === 'revoke_admin'}
                >
                  Снять админ-права
                </Button>
              </Popconfirm>

              <Popconfirm
                title="Удалить выбранного пользователя?"
                description={selectedUser === null ? '' : `Удалить пользователя @${selectedUser.userName} безвозвратно.`}
                okText="Удалить"
                cancelText="Отмена"
                onConfirm={() => void handleModerationAction('delete')}
                disabled={!canDelete}
              >
                <Button
                  danger
                  disabled={!canDelete}
                  loading={moderationActionInFlight === 'delete'}
                >
                  Удалить пользователя
                </Button>
              </Popconfirm>
            </Space>
          </Space>
        </Card>

        <Table<AdminUserListItem>
          rowKey="id"
          columns={columns}
          dataSource={pageData?.items ? [...pageData.items] : []}
          rowSelection={rowSelection}
          loading={isLoading}
          onChange={handleTableChange}
          onRow={(record) => ({
            onClick: () => {
              setSelectedUserId(record.id)
              clearModerationError()
            },
          })}
          pagination={{
            current: queryState.page,
            pageSize: queryState.pageSize,
            total: pageData?.totalCount ?? 0,
            showSizeChanger: true,
            pageSizeOptions: ['20', '50', '100'],
            showTotal: (total, range) => `${String(range[0])}-${String(range[1])} из ${String(total)}`,
          }}
          locale={{
            emptyText: 'По текущим фильтрам пользователи не найдены.',
          }}
        />
      </Card>
    </Space>
  )
}

