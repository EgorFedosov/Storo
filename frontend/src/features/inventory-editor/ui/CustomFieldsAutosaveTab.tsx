import { Alert, Button, Empty, Input, Select, Space, Switch, Table, Tag, Typography } from 'antd'
import type { TableProps } from 'antd'
import { useMemo } from 'react'
import {
  describeConcurrencyProblem,
  type ConcurrencyProblem,
} from '../../../shared/api/concurrency.ts'
import {
  inventoryCustomFieldsAutosaveContract,
  type CustomFieldsAutosaveStatus,
  type InventoryEditorCustomFieldDraft,
  type InventoryEditorCustomFieldDraftErrors,
} from '../model/useInventoryEditorModel.ts'

type CustomFieldsAutosaveTabProps = {
  fields: ReadonlyArray<InventoryEditorCustomFieldDraft>
  selectedFieldKey: string | null
  validationByKey: Readonly<Record<string, InventoryEditorCustomFieldDraftErrors>>
  globalValidationErrors: ReadonlyArray<string>
  saveStatus: CustomFieldsAutosaveStatus
  saveErrorMessage: string | null
  lastSavedAt: number | null
  isMutating: boolean
  concurrencyProblem: ConcurrencyProblem | null
  onSelectField: (fieldKey: string | null) => void
  onAddField: () => void
  onUpdateField: (
    fieldKey: string,
    patch: Partial<Pick<InventoryEditorCustomFieldDraft, 'fieldType' | 'title' | 'description' | 'showInTable'>>,
  ) => void
  onRemoveSelected: () => void
  onMoveSelectedUp: () => void
  onMoveSelectedDown: () => void
  onResetDrafts: () => void
  onReloadEditor: () => void
}

type SaveStatusMeta = {
  color: string
  label: string
}

const customFieldTypeOptions = [
  { label: 'Однострочное', value: 'single_line' },
  { label: 'Многострочное', value: 'multi_line' },
  { label: 'Число', value: 'number' },
  { label: 'Ссылка', value: 'link' },
  { label: 'Логическое', value: 'bool' },
] as const

function getSaveStatusMeta(status: CustomFieldsAutosaveStatus): SaveStatusMeta {
  if (status === 'pending') {
    return { color: 'gold', label: 'Ожидает автосохранения' }
  }

  if (status === 'saving') {
    return { color: 'processing', label: 'Сохранение' }
  }

  if (status === 'saved') {
    return { color: 'green', label: 'Сохранено' }
  }

  if (status === 'error') {
    return { color: 'red', label: 'Ошибка сохранения' }
  }

  if (status === 'conflict') {
    return { color: 'red', label: 'Конфликт версий' }
  }

  return { color: 'default', label: 'Нет несохраненных изменений' }
}

function formatLastSavedAt(timestamp: number | null): string | null {
  if (timestamp === null) {
    return null
  }

  return new Date(timestamp).toLocaleTimeString()
}

export function CustomFieldsAutosaveTab({
  fields,
  selectedFieldKey,
  validationByKey,
  globalValidationErrors,
  saveStatus,
  saveErrorMessage,
  lastSavedAt,
  isMutating,
  concurrencyProblem,
  onSelectField,
  onAddField,
  onUpdateField,
  onRemoveSelected,
  onMoveSelectedUp,
  onMoveSelectedDown,
  onResetDrafts,
  onReloadEditor,
}: CustomFieldsAutosaveTabProps) {
  const selectedFieldIndex = selectedFieldKey === null
    ? -1
    : fields.findIndex((field) => field.key === selectedFieldKey)

  const canMoveSelectedUp = selectedFieldIndex > 0
  const canMoveSelectedDown = selectedFieldIndex >= 0 && selectedFieldIndex < fields.length - 1
  const saveStatusMeta = getSaveStatusMeta(saveStatus)
  const lastSavedLabel = formatLastSavedAt(lastSavedAt)
  const concurrencyProblemUi = concurrencyProblem === null
    ? null
    : describeConcurrencyProblem(concurrencyProblem)

  const columns: NonNullable<TableProps<InventoryEditorCustomFieldDraft>['columns']> = useMemo(
    () => [
      {
        title: '#',
        key: 'order',
        width: 70,
        render: (_value: unknown, _record: InventoryEditorCustomFieldDraft, index: number) => String(index + 1),
      },
      {
        title: 'Тип поля',
        dataIndex: 'fieldType',
        key: 'fieldType',
        width: 180,
        render: (value: InventoryEditorCustomFieldDraft['fieldType'], record: InventoryEditorCustomFieldDraft) => (
            <Select
              size="small"
              value={value}
              options={[...customFieldTypeOptions]}
              disabled={record.id !== null || isMutating}
              onChange={(nextFieldType) => {
                onUpdateField(record.key, { fieldType: nextFieldType })
              }}
          />
        ),
      },
      {
        title: 'Название',
        dataIndex: 'title',
        key: 'title',
        render: (value: string, record: InventoryEditorCustomFieldDraft) => (
          <Input
            value={value}
            status={validationByKey[record.key]?.title === null ? undefined : 'error'}
            maxLength={inventoryCustomFieldsAutosaveContract.maxTitleLength}
            placeholder="Название поля"
            disabled={isMutating}
            onChange={(event) => {
              onUpdateField(record.key, { title: event.target.value })
            }}
          />
        ),
      },
      {
        title: 'Описание',
        dataIndex: 'description',
        key: 'description',
        render: (value: string, record: InventoryEditorCustomFieldDraft) => (
          <Input
            value={value}
            status={validationByKey[record.key]?.description === null ? undefined : 'error'}
            maxLength={inventoryCustomFieldsAutosaveContract.maxDescriptionLength}
            placeholder="Необязательное описание поля"
            disabled={isMutating}
            onChange={(event) => {
              onUpdateField(record.key, { description: event.target.value })
            }}
          />
        ),
      },
      {
        title: 'Показывать в таблице',
        dataIndex: 'showInTable',
        key: 'showInTable',
        width: 140,
        render: (value: boolean, record: InventoryEditorCustomFieldDraft) => (
          <Switch
            checked={value}
            disabled={isMutating}
            onChange={(nextValue) => {
              onUpdateField(record.key, { showInTable: nextValue })
            }}
          />
        ),
      },
      {
        title: 'ID поля',
        dataIndex: 'id',
        key: 'id',
        width: 140,
        render: (value: string | null) => value ?? '(новое)',
      },
    ],
    [isMutating, onUpdateField, validationByKey],
  )

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Space size={8} wrap>
        <Tag color={saveStatusMeta.color}>{saveStatusMeta.label}</Tag>
        {lastSavedLabel === null ? null : <Tag>Последнее сохранение: {lastSavedLabel}</Tag>}
        <Tag>Автосохранение каждые {String(inventoryCustomFieldsAutosaveContract.autosaveDelayMs / 1000)}с</Tag>
      </Space>

      {concurrencyProblemUi === null ? null : (
        <Alert
          showIcon
          type="warning"
          message={concurrencyProblemUi.title}
          description={concurrencyProblemUi.description}
          action={(
            <Button size="small" type="primary" onClick={onReloadEditor}>
              Перезагрузить
            </Button>
          )}
        />
      )}

      {globalValidationErrors.map((errorMessage) => (
        <Alert
          key={errorMessage}
          showIcon
          type="error"
          message="Ошибка валидации"
          description={errorMessage}
        />
      ))}

      {saveErrorMessage === null || saveStatus === 'conflict' ? null : (
        <Alert
          showIcon
          type="error"
          message="Сбой автосохранения"
          description={saveErrorMessage}
        />
      )}

      <Space size={8} wrap>
        <Button type="primary" onClick={onAddField} disabled={isMutating}>
          Добавить поле
        </Button>
        <Button onClick={onRemoveSelected} disabled={isMutating || selectedFieldIndex < 0}>
          Удалить выбранное
        </Button>
        <Button onClick={onMoveSelectedUp} disabled={isMutating || !canMoveSelectedUp}>
          Вверх
        </Button>
        <Button onClick={onMoveSelectedDown} disabled={isMutating || !canMoveSelectedDown}>
          Вниз
        </Button>
        <Button onClick={onResetDrafts} disabled={isMutating}>
          Сбросить несохраненное
        </Button>
      </Space>

      <Table<InventoryEditorCustomFieldDraft>
        rowKey="key"
        columns={columns}
        dataSource={[...fields]}
        pagination={false}
        size="middle"
        rowSelection={{
          type: 'radio',
          selectedRowKeys: selectedFieldKey === null ? [] : [selectedFieldKey],
          onChange: (selectedRowKeys) => {
            const key = selectedRowKeys[0]
            onSelectField(typeof key === 'string' ? key : null)
          },
        }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={(
                <Typography.Text>
                  Пользовательские поля не настроены. Добавьте поле, чтобы запустить автосохранение схемы.
                </Typography.Text>
              )}
            />
          ),
        }}
      />
    </Space>
  )
}
