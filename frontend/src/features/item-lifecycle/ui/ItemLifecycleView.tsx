import { DeleteOutlined, HeartFilled, HeartOutlined, ReloadOutlined } from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { FormInstance, TableProps } from 'antd'
import dayjs from 'dayjs'
import { useCallback, useEffect, useMemo, type ReactNode } from 'react'
import type { ItemDetails } from '../../../entities/item/model/types.ts'
import type { InventoryCustomFieldType } from '../../../entities/inventory/model/inventoryEditorTypes.ts'
import type { ConcurrencyProblem } from '../../../shared/api/concurrency.ts'
import { navigate } from '../../../shared/lib/router/navigation.ts'
import { ConcurrencyAlert } from '../../../shared/ui/kit/ConcurrencyAlert.tsx'
import { itemLifecycleContract, type ItemLifecycleUpdateDraft } from '../model/useItemLifecycleModel.ts'

type ItemLifecycleViewProps = {
  item: ItemDetails
  etag: string | null
  isAuthenticated: boolean
  isBlocked: boolean
  isUpdating: boolean
  isDeleting: boolean
  isLikeUpdating: boolean
  updateErrorMessage: string | null
  updateFieldErrors: Record<string, string[]>
  deleteErrorMessage: string | null
  likeErrorMessage: string | null
  concurrencyProblem: ConcurrencyProblem | null
  canLike: boolean
  onReloadLatest: () => void
  onClearConcurrencyProblem: () => void
  onClearMutationErrors: () => void
  onSubmitUpdate: (draft: ItemLifecycleUpdateDraft) => Promise<{ ok: boolean; fieldErrors: Record<string, string[]> }>
  onDelete: () => Promise<void>
  onSubmitLike: (shouldLike: boolean) => Promise<boolean>
}

type ItemFormValues = {
  customId: string
  fields: Record<string, string | number | boolean | null | undefined>
}

type ItemSnapshotRow = {
  key: string
  property: string
  value: ReactNode
}

type ItemLifecycleFormFieldName = ['customId'] | ['fields', string]

const serverIndexedFieldPattern = /^fields\[(\d+)]\.(fieldId|value)$/i
const modelMappedFieldPattern = /^fields\.(\d+)$/i

function formatUtcDateTime(value: string): string {
  const parsedValue = dayjs(value)
  return parsedValue.isValid() ? parsedValue.format('DD.MM.YYYY HH:mm') : value
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

function toFieldLabel(field: ItemDetails['fields'][number]): string {
  return `${field.title} (${toFieldTypeLabel(field.fieldType)})`
}

function createFormValues(item: ItemDetails): ItemFormValues {
  const fields: ItemFormValues['fields'] = {}

  for (const field of item.fields) {
    if (field.fieldType === 'bool') {
      fields[field.fieldId] = typeof field.value === 'boolean' ? field.value : false
      continue
    }

    if (field.fieldType === 'number') {
      fields[field.fieldId] = typeof field.value === 'number' ? field.value : null
      continue
    }

    fields[field.fieldId] = typeof field.value === 'string' ? field.value : undefined
  }

  return {
    customId: item.customId,
    fields,
  }
}

function clearServerFieldErrors(form: FormInstance<ItemFormValues>, item: ItemDetails): void {
  form.setFields([
    { name: ['customId'], errors: [] },
    ...item.fields.map((field) => ({
      name: ['fields', field.fieldId] as ['fields', string],
      errors: [],
    })),
  ])
}

function resolveFieldName(serverFieldName: string, item: ItemDetails): ItemLifecycleFormFieldName | null {
  if (serverFieldName === 'customId') {
    return ['customId']
  }

  const indexedFieldMatch = serverIndexedFieldPattern.exec(serverFieldName)
  if (indexedFieldMatch !== null) {
    const index = Number(indexedFieldMatch[1])
    const fieldDefinition = Number.isSafeInteger(index) ? item.fields[index] : undefined
    if (fieldDefinition !== undefined) {
      return ['fields', fieldDefinition.fieldId]
    }
  }

  const mappedFieldMatch = modelMappedFieldPattern.exec(serverFieldName)
  if (mappedFieldMatch !== null) {
    const fieldId = mappedFieldMatch[1]
    if (item.fields.some((field) => field.fieldId === fieldId)) {
      return ['fields', fieldId]
    }
  }

  return null
}

function applyServerFieldErrors(
  form: FormInstance<ItemFormValues>,
  fieldErrors: Record<string, string[]>,
  item: ItemDetails,
): void {
  const mergedErrors = new Map<string, { name: ItemLifecycleFormFieldName; errors: string[] }>()

  for (const [serverFieldName, errors] of Object.entries(fieldErrors)) {
    if (errors.length === 0) {
      continue
    }

    const normalizedName = resolveFieldName(serverFieldName, item)
    if (normalizedName === null) {
      continue
    }

    const mapKey = normalizedName.join('.')
    const previousErrors = mergedErrors.get(mapKey)?.errors ?? []
    mergedErrors.set(mapKey, {
      name: normalizedName,
      errors: [...previousErrors, ...errors],
    })
  }

  if (mergedErrors.size === 0) {
    return
  }

  form.setFields(Array.from(mergedErrors.values()))
}

function toSnapshotRows(item: ItemDetails): ItemSnapshotRow[] {
  return [
    { key: 'itemId', property: 'ID элемента', value: item.id },
    { key: 'customId', property: 'Пользовательский ID', value: item.customId },
    {
      key: 'inventory',
      property: 'Инвентарь',
      value: (
        <Typography.Link onClick={() => navigate(`/inventories/${item.inventory.id}`)}>
          {item.inventory.title} (#{item.inventory.id})
        </Typography.Link>
      ),
    },
    {
      key: 'createdBy',
      property: 'Создал',
      value: item.fixedFields.createdBy === null
        ? 'Неизвестно'
        : `${item.fixedFields.createdBy.displayName} (@${item.fixedFields.createdBy.userName})`,
    },
    {
      key: 'updatedBy',
      property: 'Обновил',
      value: item.fixedFields.updatedBy === null
        ? 'Неизвестно'
        : `${item.fixedFields.updatedBy.displayName} (@${item.fixedFields.updatedBy.userName})`,
    },
    { key: 'createdAt', property: 'Создано (UTC)', value: formatUtcDateTime(item.fixedFields.createdAt) },
    { key: 'updatedAt', property: 'Обновлено (UTC)', value: formatUtcDateTime(item.fixedFields.updatedAt) },
    { key: 'version', property: 'Версия', value: String(item.version) },
    {
      key: 'likes',
      property: 'Лайки',
      value: (
        <Space size={6} wrap>
          <Tag color="blue">{String(item.like.count)}</Tag>
        </Space>
      ),
    },
  ]
}

function normalizeFormInput(values: ItemFormValues): ItemLifecycleUpdateDraft {
  return {
    customId: values.customId ?? '',
    fields: values.fields ?? {},
  }
}

export function ItemLifecycleView({
  item,
  isAuthenticated,
  isBlocked,
  isUpdating,
  isDeleting,
  isLikeUpdating,
  updateErrorMessage,
  updateFieldErrors,
  deleteErrorMessage,
  likeErrorMessage,
  concurrencyProblem,
  canLike,
  onReloadLatest,
  onClearConcurrencyProblem,
  onClearMutationErrors,
  onSubmitUpdate,
  onDelete,
  onSubmitLike,
}: ItemLifecycleViewProps) {
  const [form] = Form.useForm<ItemFormValues>()
  const [messageApi, messageContextHolder] = message.useMessage()

  const snapshotRows = useMemo(() => toSnapshotRows(item), [item])
  const formValues = useMemo(() => createFormValues(item), [item])

  useEffect(() => {
    form.setFieldsValue(formValues)
    clearServerFieldErrors(form, item)
  }, [form, formValues, item])

  useEffect(() => {
    clearServerFieldErrors(form, item)
    applyServerFieldErrors(form, updateFieldErrors, item)
  }, [form, item, updateFieldErrors])

  const snapshotColumns = useMemo<NonNullable<TableProps<ItemSnapshotRow>['columns']>>(
    () => [
      {
        title: 'Параметр',
        dataIndex: 'property',
        key: 'property',
        width: 240,
      },
      {
        title: 'Значение',
        dataIndex: 'value',
        key: 'value',
      },
    ],
    [],
  )

  const canEdit = item.permissions.canEdit
  const canDelete = item.permissions.canDelete
  const canLikeItem = canLike && isAuthenticated && !isBlocked

  const handleReset = useCallback(() => {
    form.setFieldsValue(formValues)
    clearServerFieldErrors(form, item)
    onClearMutationErrors()
  }, [form, formValues, item, onClearMutationErrors])

  const handleSubmit = useCallback(async (values: ItemFormValues) => {
    clearServerFieldErrors(form, item)
    onClearMutationErrors()

    const result = await onSubmitUpdate(normalizeFormInput(values))
    if (result.ok) {
      messageApi.success('Элемент обновлен.')
      return
    }

    applyServerFieldErrors(form, result.fieldErrors, item)
  }, [form, item, messageApi, onClearMutationErrors, onSubmitUpdate])

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {messageContextHolder}

      <Card>
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <Space size={8} wrap>
            <Tag color="blue">Элемент #{item.id}</Tag>
            <Tag color="blue">Инвентарь #{item.inventory.id}</Tag>
            <Tag color="blue">Версия: {String(item.version)}</Tag>
            <Tag color={canEdit ? 'blue' : 'default'}>
              {canEdit ? 'Можно редактировать' : 'Только чтение'}
            </Tag>
            <Tag color={canDelete ? 'blue' : 'default'}>
              {canDelete ? 'Можно удалить' : 'Удаление запрещено'}
            </Tag>
            <Tag color={canLike ? 'blue' : 'default'}>
              {canLike ? 'Можно ставить лайк' : 'Лайки запрещены'}
            </Tag>
          </Space>

          <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 0 }}>
            {item.customId}
          </Typography.Title>

          <Space wrap size={8}>
            <Button
              type={item.like.likedByCurrentUser ? 'primary' : 'default'}
              icon={item.like.likedByCurrentUser ? <HeartFilled /> : <HeartOutlined />}
              loading={isLikeUpdating}
              disabled={!canLikeItem || isUpdating || isDeleting}
              onClick={() => {
                void onSubmitLike(!item.like.likedByCurrentUser)
              }}
            >
              {item.like.likedByCurrentUser ? 'Убрать лайк' : 'Лайк'}
            </Button>
            <Tag color="red">Лайков: {String(item.like.count)}</Tag>
          </Space>
        </Space>
      </Card>

      <ConcurrencyAlert
        problem={concurrencyProblem}
        onReload={onReloadLatest}
        onClose={onClearConcurrencyProblem}
      />

      {!isAuthenticated ? (
        <Alert
          showIcon
          type="info"
          message="Гостевой режим только для чтения"
          description="Войдите в аккаунт, чтобы редактировать или удалять этот элемент, если уровень доступа это позволяет."
        />
      ) : null}

      {isBlocked ? (
        <Alert
          showIcon
          type="warning"
          message="Аккаунт заблокирован"
          description="Заблокированные пользователи не могут выполнять изменяющие операции."
        />
      ) : null}

      {updateErrorMessage !== null ? (
        <Alert
          showIcon
          type="error"
          message="Не удалось обновить элемент"
          description={updateErrorMessage}
        />
      ) : null}

      {deleteErrorMessage !== null ? (
        <Alert
          showIcon
          type="error"
          message="Не удалось удалить элемент"
          description={deleteErrorMessage}
        />
      ) : null}

      {likeErrorMessage !== null ? (
        <Alert
          showIcon
          type="error"
          message="Не удалось обновить лайк"
          description={likeErrorMessage}
        />
      ) : null}

      <Card
        title="Снимок элемента"
        extra={(
          <Button icon={<ReloadOutlined />} onClick={onReloadLatest} disabled={isUpdating || isDeleting}>
            Обновить
          </Button>
        )}
      >
        <Table<ItemSnapshotRow>
          rowKey="key"
          columns={snapshotColumns}
          dataSource={snapshotRows}
          pagination={false}
          size="middle"
        />
      </Card>

      <Card
        title="Редактирование элемента"
        extra={(
          <Space wrap>
            {canDelete ? (
              <Popconfirm
                title="Удалить элемент безвозвратно?"
                description={`Элемент ${item.customId} будет удален.`}
                okText="Удалить элемент"
                cancelText="Отмена"
                okButtonProps={{ danger: true, loading: isDeleting }}
                onConfirm={onDelete}
                disabled={isUpdating || isDeleting}
              >
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  loading={isDeleting}
                  disabled={isUpdating || isDeleting}
                >
                  Удалить элемент
                </Button>
              </Popconfirm>
            ) : null}
            <Button onClick={handleReset} disabled={isUpdating || isDeleting}>
              Сбросить
            </Button>
            <Button
              type="primary"
              onClick={() => {
                void form.submit()
              }}
              loading={isUpdating}
              disabled={!canEdit || isUpdating || isDeleting}
            >
              Сохранить изменения
            </Button>
          </Space>
        )}
      >
        <Form<ItemFormValues>
          form={form}
          layout="vertical"
          initialValues={formValues}
          disabled={!canEdit || isUpdating || isDeleting}
          onValuesChange={() => {
            clearServerFieldErrors(form, item)
            onClearMutationErrors()
          }}
          onFinish={handleSubmit}
        >
          <Form.Item<ItemFormValues>
            label="Пользовательский ID"
            name="customId"
            validateFirst
            rules={[
              {
                required: true,
                whitespace: true,
                message: 'Поле customId обязательно.',
              },
              {
                max: itemLifecycleContract.maxCustomIdLength,
                message: `customId не должен превышать ${String(itemLifecycleContract.maxCustomIdLength)} символов.`,
              },
            ]}
          >
            <Input
              maxLength={itemLifecycleContract.maxCustomIdLength}
              autoComplete="off"
            />
          </Form.Item>

          {item.fields.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Для этого элемента нет активных пользовательских полей."
            />
          ) : null}

          {item.fields.map((field) => {
            if (field.fieldType === 'single_line' || field.fieldType === 'link') {
              const maxLength = field.fieldType === 'single_line'
                ? itemLifecycleContract.maxSingleLineLength
                : itemLifecycleContract.maxLinkLength

              return (
                <Form.Item<ItemFormValues>
                  key={field.fieldId}
                  label={toFieldLabel(field)}
                  name={['fields', field.fieldId]}
                  extra={field.description.trim().length > 0 ? field.description : undefined}
                  rules={[
                    {
                      max: maxLength,
                      message: `Значение не должно превышать ${String(maxLength)} символов.`,
                    },
                  ]}
                >
                  <Input maxLength={maxLength} autoComplete="off" />
                </Form.Item>
              )
            }

            if (field.fieldType === 'multi_line') {
              return (
                <Form.Item<ItemFormValues>
                  key={field.fieldId}
                  label={toFieldLabel(field)}
                  name={['fields', field.fieldId]}
                  extra={field.description.trim().length > 0 ? field.description : undefined}
                  rules={[
                    {
                      max: itemLifecycleContract.maxMultiLineLength,
                      message: `Значение не должно превышать ${String(itemLifecycleContract.maxMultiLineLength)} символов.`,
                    },
                  ]}
                >
                  <Input.TextArea
                    rows={4}
                    maxLength={itemLifecycleContract.maxMultiLineLength}
                    showCount
                  />
                </Form.Item>
              )
            }

            if (field.fieldType === 'number') {
              return (
                <Form.Item<ItemFormValues>
                  key={field.fieldId}
                  label={toFieldLabel(field)}
                  name={['fields', field.fieldId]}
                  extra={field.description.trim().length > 0 ? field.description : undefined}
                  rules={[
                    {
                      validator: async (_, value: number | null | undefined) => {
                        if (value === null || value === undefined) {
                          return
                        }

                        if (typeof value !== 'number' || !Number.isFinite(value)) {
                          throw new Error('Значение должно быть числом.')
                        }
                      },
                    },
                  ]}
                >
                  <InputNumber<number>
                    min={itemLifecycleContract.minNumberValue}
                    max={itemLifecycleContract.maxNumberValue}
                    precision={itemLifecycleContract.maxNumberDecimals}
                    step={0.0001}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              )
            }

            return (
              <Form.Item<ItemFormValues>
                key={field.fieldId}
                label={toFieldLabel(field)}
                name={['fields', field.fieldId]}
                valuePropName="checked"
                extra={field.description.trim().length > 0 ? field.description : undefined}
              >
                <Switch checkedChildren="Да" unCheckedChildren="Нет" />
              </Form.Item>
            )
          })}
        </Form>
      </Card>
    </Space>
  )
}
