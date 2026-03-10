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
  { label: 'Descending', value: 'desc' },
  { label: 'Ascending', value: 'asc' },
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
    return 'Sign in to like items.'
  }

  if (failure.status === 403) {
    return 'You do not have permission to like items in this context.'
  }

  if (failure.status === 404) {
    return 'Item was not found.'
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
      : 'Like request failed before reaching API.'
  }

  return failure.message
}

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
          { label: 'Updated At', value: 'updatedAt' },
          { label: 'Created At', value: 'createdAt' },
          { label: 'Custom ID', value: 'customId' },
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
      setLikeErrorMessage('Sign in to like items.')
      return
    }

    if (currentUser.isBlocked) {
      setLikeErrorMessage('Blocked users cannot like items.')
      return
    }

    if (!permissions.canLike) {
      setLikeErrorMessage('You do not have permission to like items.')
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
        title: 'Likes',
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
                {row.like.likedByCurrentUser ? 'Unlike' : 'Like'}
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

      {canEditInventory && activeEditorCreateContext.errorMessage !== null ? (
        <Alert
          showIcon
          type="warning"
          message="Create schema fallback is active"
          description={(
            <>
              {activeEditorCreateContext.errorMessage}
              {' '}
              Falling back to visible table fields only.
            </>
          )}
        />
      ) : null}

      {likeErrorMessage !== null ? (
        <Alert
          showIcon
          type="error"
          message="Failed to update like"
          description={likeErrorMessage}
          closable
          onClose={() => setLikeErrorMessage(null)}
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
          <Tag color={canLikeItems ? 'magenta' : 'default'}>
            {canLikeItems ? 'Likes enabled' : 'Likes disabled'}
          </Tag>
        </Space>
        <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
          Dynamic table from `GET /api/v1/inventories/:inventoryId/items` (`columns + rows`).
        </Typography.Paragraph>
        {lastCreatedItem === null ? null : (
          <Alert
            showIcon
            type="success"
            style={{ marginTop: 12 }}
            message={`Item ${lastCreatedItem.customId} created`}
            description={(
              <Space size={8} wrap>
                <Tag color="green">Item #{lastCreatedItem.id}</Tag>
                <Tag>Version: {String(lastCreatedItem.version)}</Tag>
                {lastCreatedItem.etag === null ? null : <Tag>ETag: {lastCreatedItem.etag}</Tag>}
                <Typography.Link onClick={() => navigate(`/items/${lastCreatedItem.id}`)}>
                  Open item
                </Typography.Link>
              </Space>
            )}
          />
        )}
      </Card>

      <Card
        title="Items"
        extra={(
          <Space wrap>
            {canWriteItems ? (
              <Button
                type="primary"
                onClick={() => setIsCreateModalOpen(true)}
                disabled={!canOpenCreateFlow || status === 'loading' || activeEditorCreateContext.isLoading}
              >
                Create Item
              </Button>
            ) : null}
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



