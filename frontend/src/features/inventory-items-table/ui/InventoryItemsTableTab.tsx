import { HeartFilled, HeartOutlined, ReloadOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Empty, Segmented, Select, Space, Spin, Table, Tag, Typography } from 'antd'
import type { TableProps } from 'antd'
import dayjs from 'dayjs'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { requestInventoryEditor } from '../../../entities/inventory/model/inventoryEditorApi.ts'
import type { InventoryCustomFieldType } from '../../../entities/inventory/model/inventoryEditorTypes.ts'
import type {
  InventoryItemsTableCellValue,
  InventoryItemsTableColumn,
  InventoryItemsTableRow,
  InventoryItemsTableSortDirection,
  InventoryItemsTableSortField,
} from '../../../entities/inventory/model/inventoryItemsTableTypes.ts'
import { useInventoryItemsTableModel } from '../model/useInventoryItemsTableModel.ts'
import type { InventoryItemCreateFieldDefinition } from '../model/useInventoryItemCreateModel.ts'
import { InventoryItemCreateModal } from './InventoryItemCreateModal.tsx'
import { navigate } from '../../../shared/lib/router/navigation.ts'
import { useCurrentUser } from '../../../features/auth/model/useCurrentUser.ts'
import { removeItemLike, setItemLike, type ItemLikeMutationFailure } from '../../../entities/item/model/itemLikesApi.ts'

type InventoryItemsTableTabProps = {
  inventoryId: string
  enabled: boolean
  canWriteItems: boolean
  canEditInventory: boolean
}

type LastCreatedItemState = {
  id: string
  customId: string
  version: number
  etag: string | null
}

type EditorCreateContextState = {
  fieldDefinitions: ReadonlyArray<InventoryItemCreateFieldDefinition> | null
  customIdValidationRegex: string | null
  customIdPreviewSample: string | null
  errorMessage: string | null
  isLoading: boolean
}

const emptyValueLabel = '-'

const sortDirectionOptions: ReadonlyArray<{ label: string; value: InventoryItemsTableSortDirection }> = [
  { label: 'По убыванию', value: 'desc' },
  { label: 'По возрастанию', value: 'asc' },
]

const defaultEditorCreateContextState: EditorCreateContextState = {
  fieldDefinitions: null,
  customIdValidationRegex: null,
  customIdPreviewSample: null,
  errorMessage: null,
  isLoading: false,
}

type TableLikeState = InventoryItemsTableRow['like']

type TableLikeOverrides = Record<string, TableLikeState>

type TableLikePendingMap = Record<string, boolean>

function toLikeFailureMessage(failure: ItemLikeMutationFailure): string {
  if (failure.status === 401) {
    return 'Войдите, чтобы ставить лайки.'
  }

  if (failure.status === 403) {
    return 'У вас нет прав ставить лайки в этом контексте.'
  }

  if (failure.status === 404) {
    return 'Элемент не найден.'
  }

  if (failure.status === 400) {
    for (const messages of Object.values(failure.validationErrors)) {
      if (messages.length > 0) {
        return messages[0]
      }
    }
  }

  if (failure.status === 0) {
    return failure.message.trim().length > 0
      ? failure.message
      : 'Запрос на лайк не дошел до API.'
  }

  return failure.message
}

function isCustomSortField(value: string): value is `field:${string}` {
  return /^field:[1-9]\d*$/.test(value)
}

function toSortFieldLabel(column: InventoryItemsTableColumn): string {
  if (column.key === 'customId') {
    return 'Пользовательский ID'
  }

  if (column.key === 'createdAt') {
    return 'Создано'
  }

  if (column.key === 'updatedAt') {
    return 'Обновлено'
  }

  if (column.kind === 'custom' && column.fieldType !== null) {
    return `${column.title} (${toFieldTypeLabel(column.fieldType)})`
  }

  return column.title
}

function toFieldTypeLabel(fieldType: InventoryCustomFieldType): string {
  switch (fieldType) {
    case 'single_line':
      return 'Однострочное'
    case 'multi_line':
      return 'Многострочное'
    case 'number':
      return 'Число'
    case 'link':
      return 'Ссылка'
    case 'bool':
      return 'Логическое'
    default:
      return fieldType
  }
}

function formatDateTimeCell(value: InventoryItemsTableCellValue): string {
  if (typeof value !== 'string') {
    return emptyValueLabel
  }

  const parsedValue = dayjs(value)
  return parsedValue.isValid() ? parsedValue.format('DD.MM.YYYY HH:mm') : value
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
        {value ? 'Да' : 'Нет'}
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

function toEditorCreateFieldDefinitions(
  customFields: ReadonlyArray<{
    id: string
    title: string
    fieldType: InventoryCustomFieldType
  }>,
): ReadonlyArray<InventoryItemCreateFieldDefinition> {
  return customFields.map((field) => ({
    fieldId: field.id,
    title: field.title,
    fieldType: field.fieldType,
  }))
}

export function InventoryItemsTableTab({
  inventoryId,
  enabled,
  canWriteItems,
  canEditInventory,
}: InventoryItemsTableTabProps) {
  const { isAuthenticated, currentUser, permissions } = useCurrentUser()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [likeOverrides, setLikeOverrides] = useState<TableLikeOverrides>({})
  const [likePendingByItemId, setLikePendingByItemId] = useState<TableLikePendingMap>({})
  const [likeErrorMessage, setLikeErrorMessage] = useState<string | null>(null)
  const [lastCreatedItem, setLastCreatedItem] = useState<LastCreatedItemState | null>(null)
  const [editorCreateContext, setEditorCreateContext] = useState<EditorCreateContextState>(
    defaultEditorCreateContextState,
  )
  const editorRequestSequenceRef = useRef(0)
  const editorAbortControllerRef = useRef<AbortController | null>(null)

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
          { label: 'Обновлено', value: 'updatedAt' },
          { label: 'Создано', value: 'createdAt' },
          { label: 'Пользовательский ID', value: 'customId' },
        ]
      }

      return options
    },
    [columns],
  )

  const createFieldDefinitions = useMemo<ReadonlyArray<InventoryItemCreateFieldDefinition>>(
    () => columns
      .filter((column) => column.kind === 'custom' && column.fieldId !== null && column.fieldType !== null)
      .map((column) => ({
        fieldId: column.fieldId!,
        title: column.title,
        fieldType: column.fieldType!,
      })),
    [columns],
  )

  useEffect(
    () => () => {
      editorAbortControllerRef.current?.abort()
    },
    [],
  )

  useEffect(() => {
    editorAbortControllerRef.current?.abort()

    if (!enabled || !canEditInventory) {
      return
    }

    editorRequestSequenceRef.current += 1
    const requestId = editorRequestSequenceRef.current
    const abortController = new AbortController()
    editorAbortControllerRef.current = abortController

    void (async () => {
      if (abortController.signal.aborted || requestId !== editorRequestSequenceRef.current) {
        return
      }

      setEditorCreateContext((currentContext) => ({
        ...currentContext,
        isLoading: true,
        errorMessage: null,
      }))

      const response = await requestInventoryEditor(inventoryId, abortController.signal)

      if (abortController.signal.aborted || requestId !== editorRequestSequenceRef.current) {
        return
      }

      if (!response.ok) {
        setEditorCreateContext({
          fieldDefinitions: null,
          customIdValidationRegex: null,
          customIdPreviewSample: null,
          errorMessage: response.message,
          isLoading: false,
        })
        return
      }

      setEditorCreateContext({
        fieldDefinitions: toEditorCreateFieldDefinitions(response.data.customFields),
        customIdValidationRegex: response.data.customIdTemplate.derivedValidationRegex,
        customIdPreviewSample: response.data.customIdTemplate.preview.sampleCustomId,
        errorMessage: null,
        isLoading: false,
      })
    })()

    return () => {
      abortController.abort()
    }
  }, [canEditInventory, enabled, inventoryId])

  const activeEditorCreateContext = enabled && canEditInventory
    ? editorCreateContext
    : defaultEditorCreateContextState
  const resolvedCreateFieldDefinitions = activeEditorCreateContext.fieldDefinitions ?? createFieldDefinitions
  const canOpenCreateFlow = canWriteItems && data !== null && errorStatus !== 404
  const canLikeItems = isAuthenticated && !currentUser.isBlocked && permissions.canLike

  useEffect(() => {
    setLikeOverrides((currentState) => {
      const nextState: TableLikeOverrides = {}
      for (const row of rows) {
        if (currentState[row.itemId] !== undefined) {
          nextState[row.itemId] = currentState[row.itemId]
        }
      }

      return nextState
    })

    setLikePendingByItemId((currentState) => {
      const nextState: TableLikePendingMap = {}
      for (const row of rows) {
        if (currentState[row.itemId] === true) {
          nextState[row.itemId] = true
        }
      }

      return nextState
    })
  }, [rows])

  const resolvedRows = useMemo<ReadonlyArray<InventoryItemsTableRow>>(
    () => rows.map((row) => {
      const overriddenLike = likeOverrides[row.itemId]
      return overriddenLike === undefined
        ? row
        : {
            ...row,
            like: overriddenLike,
          }
    }),
    [likeOverrides, rows],
  )

  const handleToggleLike = useCallback(async (row: InventoryItemsTableRow) => {
    if (!isAuthenticated) {
      setLikeErrorMessage('Войдите, чтобы ставить лайки.')
      return
    }

    if (currentUser.isBlocked) {
      setLikeErrorMessage('Заблокированные пользователи не могут ставить лайки.')
      return
    }

    if (!permissions.canLike) {
      setLikeErrorMessage('У вас нет прав ставить лайки.')
      return
    }

    if (likePendingByItemId[row.itemId] === true) {
      return
    }

    setLikeErrorMessage(null)
    setLikePendingByItemId((currentState) => ({
      ...currentState,
      [row.itemId]: true,
    }))

    try {
      const shouldLike = !row.like.likedByCurrentUser
      const response = shouldLike
        ? await setItemLike(row.itemId)
        : await removeItemLike(row.itemId)

      if (!response.ok) {
        setLikeErrorMessage(toLikeFailureMessage(response))
        return
      }

      setLikeOverrides((currentState) => ({
        ...currentState,
        [row.itemId]: {
          count: response.data.count,
          likedByCurrentUser: response.data.likedByCurrentUser,
        },
      }))
    } finally {
      setLikePendingByItemId((currentState) => {
        const nextState = { ...currentState }
        delete nextState[row.itemId]
        return nextState
      })
    }
  }, [currentUser.isBlocked, isAuthenticated, likePendingByItemId, permissions.canLike])

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
        title: 'Лайки',
        key: 'like',
        width: 210,
        fixed: 'right',
        render: (_, row) => {
          const isLikePending = likePendingByItemId[row.itemId] === true

          return (
            <Space size={6} wrap>
              <Tag color="blue">{String(row.like.count)}</Tag>
              <Button
                size="small"
                type={row.like.likedByCurrentUser ? 'primary' : 'default'}
                icon={row.like.likedByCurrentUser ? <HeartFilled /> : <HeartOutlined />}
                loading={isLikePending}
                disabled={!canLikeItems || isLikePending || status === 'loading'}
                onClick={() => {
                  void handleToggleLike(row)
                }}
              >
                {row.like.likedByCurrentUser ? 'Убрать лайк' : 'Лайк'}
              </Button>
            </Space>
          )
        },
      })

      return mappedColumns
    },
    [canLikeItems, columns, handleToggleLike, likePendingByItemId, status],
  )

  if (!enabled && status === 'idle') {
    return null
  }

  if ((status === 'idle' || status === 'loading') && data === null) {
    return (
      <Card>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Typography.Text type="secondary">
            Загрузка таблицы элементов инвентаря...
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
          message={errorStatus === 404 ? 'Элементы инвентаря недоступны' : 'Не удалось загрузить таблицу элементов'}
          description={errorMessage ?? 'Ошибка запроса таблицы элементов.'}
          action={(
            <Button type="primary" size="small" icon={<ReloadOutlined />} onClick={retryLoad}>
              Повторить
            </Button>
          )}
        />
      ) : null}

      {canEditInventory && activeEditorCreateContext.errorMessage !== null ? (
        <Alert
          showIcon
          type="warning"
          message="Используется резервная схема создания"
          description={(
            <>
              {activeEditorCreateContext.errorMessage}
              {' '}
              Используются только видимые поля таблицы.
            </>
          )}
        />
      ) : null}

      {likeErrorMessage !== null ? (
        <Alert
          showIcon
          type="error"
          message="Не удалось обновить лайк"
          description={likeErrorMessage}
          closable
          onClose={() => setLikeErrorMessage(null)}
        />
      ) : null}

      <Card>
        <Space size={8} wrap>
          <Tag color="blue">Инвентарь #{inventoryId}</Tag>
          <Tag>Версия: {String(data?.version ?? 'н/д')}</Tag>
          <Tag>Строк: {String(rows.length)}</Tag>
          <Tag>Всего: {String(totalCount)}</Tag>
          <Tag color={canWriteItems ? 'green' : 'default'}>
            {canWriteItems ? 'Доступ на запись' : 'Только чтение'}
          </Tag>
          <Tag color={canLikeItems ? 'magenta' : 'default'}>
            {canLikeItems ? 'Лайки разрешены' : 'Лайки отключены'}
          </Tag>
        </Space>
        <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
          Динамическая таблица из `GET /api/v1/inventories/:inventoryId/items` (`columns + rows`).
        </Typography.Paragraph>
        {lastCreatedItem === null ? null : (
          <Alert
            showIcon
            type="success"
            style={{ marginTop: 12 }}
            message={`Элемент ${lastCreatedItem.customId} создан`}
            description={(
              <Space size={8} wrap>
                <Tag color="green">Элемент #{lastCreatedItem.id}</Tag>
                <Tag>Версия: {String(lastCreatedItem.version)}</Tag>
                {lastCreatedItem.etag === null ? null : <Tag>ETag: {lastCreatedItem.etag}</Tag>}
                <Typography.Link onClick={() => navigate(`/items/${lastCreatedItem.id}`)}>
                  Открыть элемент
                </Typography.Link>
              </Space>
            )}
          />
        )}
      </Card>

      <Card
        title="Элементы"
        extra={(
          <Space wrap>
            {canWriteItems ? (
              <Button
                type="primary"
                onClick={() => setIsCreateModalOpen(true)}
                disabled={!canOpenCreateFlow || status === 'loading' || activeEditorCreateContext.isLoading}
              >
                Создать элемент
              </Button>
            ) : null}
            <Select<InventoryItemsTableSortField>
              value={sortField}
              options={[...sortFieldOptions]}
              onChange={handleSortFieldChange}
              style={{ width: 240 }}
              disabled={status === 'loading'}
              aria-label="Поле сортировки элементов"
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
          dataSource={[...resolvedRows]}
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
            showTotal: (count, range) => `${String(range[0])}-${String(range[1])} из ${String(count)}`,
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="В этом инвентаре пока нет элементов."
              />
            ),
          }}
          size="middle"
        />
      </Card>

      <InventoryItemCreateModal
        open={isCreateModalOpen}
        inventoryId={inventoryId}
        canWriteItems={canWriteItems}
        fieldDefinitions={resolvedCreateFieldDefinitions}
        customIdValidationRegex={activeEditorCreateContext.customIdValidationRegex}
        customIdPreviewSample={activeEditorCreateContext.customIdPreviewSample}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={({ item, etag }) => {
          setLastCreatedItem({
            id: item.id,
            customId: item.customId,
            version: item.version,
            etag,
          })
          setIsCreateModalOpen(false)
          handlePageChange(1, pageSize)
        }}
      />
    </Space>
  )
}
