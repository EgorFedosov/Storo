import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, SaveOutlined, UndoOutlined } from '@ant-design/icons'
import { Alert, Button, Empty, Input, Select, Space, Switch, Table, Tag, Typography } from 'antd'
import type { TableProps } from 'antd'
import { useMemo, useState } from 'react'
import type { InventoryCustomIdPartType } from '../../../entities/inventory/model/inventoryEditorTypes.ts'
import { ConcurrencyAlert } from '../../../shared/ui/kit/ConcurrencyAlert.tsx'
import type { InventoryCustomIdTemplateBuilderModel } from '../model/useInventoryEditorModel.ts'

type CustomIdTemplateBuilderTabProps = {
  model: InventoryCustomIdTemplateBuilderModel
  onReloadEditor: () => void
  onCloseConcurrencyAlert: () => void
}

type PartTypeOption = {
  value: InventoryCustomIdPartType
  label: string
}

const partTypeOptions: ReadonlyArray<PartTypeOption> = [
  { value: 'fixed_text', label: 'Фиксированный текст' },
  { value: 'random_20_bit', label: 'Случайное 20-бит' },
  { value: 'random_32_bit', label: 'Случайное 32-бит' },
  { value: 'random_6_digit', label: 'Случайное 6-значное' },
  { value: 'random_9_digit', label: 'Случайное 9-значное' },
  { value: 'guid', label: 'GUID' },
  { value: 'datetime', label: 'Дата/время' },
  { value: 'sequence', label: 'Последовательность' },
]

function toPartTypeLabel(partType: InventoryCustomIdPartType): string {
  return partTypeOptions.find((option) => option.value === partType)?.label ?? partType
}

function supportsFormatPattern(partType: InventoryCustomIdPartType): boolean {
  return partType === 'datetime' || partType === 'sequence'
}

function getFieldError(
  validationErrors: Record<string, string[]>,
  index: number,
  fieldName: 'fixedText' | 'formatPattern',
): string | null {
  const errors = validationErrors[`parts[${String(index)}].${fieldName}`]
  if (errors === undefined || errors.length === 0) {
    return null
  }

  return errors[0]
}

function getGeneralPartsError(validationErrors: Record<string, string[]>): string | null {
  const errors = validationErrors.parts
  if (errors === undefined || errors.length === 0) {
    return null
  }

  return errors[0]
}

export function CustomIdTemplateBuilderTab({
  model,
  onReloadEditor,
  onCloseConcurrencyAlert,
}: CustomIdTemplateBuilderTabProps) {
  const [nextPartType, setNextPartType] = useState<InventoryCustomIdPartType>('fixed_text')

  const selectedPartIndex = useMemo(
    () => model.parts.findIndex((part) => part.clientId === model.selectedPartId),
    [model.parts, model.selectedPartId],
  )

  const isBusy = model.isPreviewing || model.isSaving
  const generalPartsError = getGeneralPartsError(model.validationErrors)

  const columns: NonNullable<TableProps<(typeof model.parts)[number]>['columns']> = [
    {
      title: '#',
      key: 'order',
      width: 64,
      render: (_value, _record, index) => index + 1,
    },
    {
      title: 'Тип части',
      dataIndex: 'partType',
      key: 'partType',
      width: 200,
      render: (_partType: InventoryCustomIdPartType, part) => (
        <Select<InventoryCustomIdPartType>
          style={{ width: '100%' }}
          options={partTypeOptions.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
          value={part.partType}
          disabled={isBusy}
          onChange={(nextType) => model.updatePartType(part.clientId, nextType)}
        />
      ),
    },
    {
      title: 'Фиксированный текст',
      dataIndex: 'fixedText',
      key: 'fixedText',
      width: 320,
      render: (_value: string, part, index) => {
        const errorMessage = getFieldError(model.validationErrors, index, 'fixedText')
        const disabled = part.partType !== 'fixed_text' || isBusy

        return (
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Input
              value={part.fixedText}
              disabled={disabled}
              maxLength={500}
              status={errorMessage !== null ? 'error' : undefined}
              placeholder={disabled ? '(не используется)' : 'например, EQ-'}
              onChange={(event) => model.updatePartFixedText(part.clientId, event.target.value)}
            />
            {errorMessage !== null ? (
              <Typography.Text type="danger">
                {errorMessage}
              </Typography.Text>
            ) : null}
          </Space>
        )
      },
    },
    {
      title: 'Шаблон формата',
      dataIndex: 'formatPattern',
      key: 'formatPattern',
      width: 320,
      render: (_value: string, part, index) => {
        const errorMessage = getFieldError(model.validationErrors, index, 'formatPattern')
        const disabled = !supportsFormatPattern(part.partType) || isBusy

        return (
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Input
              value={part.formatPattern}
              disabled={disabled}
              maxLength={200}
              status={errorMessage !== null ? 'error' : undefined}
              placeholder={disabled ? '(не используется)' : (part.partType === 'sequence' ? 'например, D4' : 'например, yyyy')}
              onChange={(event) => model.updatePartFormatPattern(part.clientId, event.target.value)}
            />
            {errorMessage !== null ? (
              <Typography.Text type="danger">
                {errorMessage}
              </Typography.Text>
            ) : null}
          </Space>
        )
      },
    },
  ]

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Space wrap>
        <Typography.Text strong>
          Шаблон включен
        </Typography.Text>
        <Switch
          checked={model.isEnabled}
          disabled={isBusy}
          onChange={(nextValue) => model.setIsEnabled(nextValue)}
        />
        <Tag color={model.isEnabled ? 'green' : 'default'}>
          {model.isEnabled ? 'Включен' : 'Выключен'}
        </Tag>
      </Space>

      <Space wrap>
        <Select<InventoryCustomIdPartType>
          value={nextPartType}
          style={{ width: 180 }}
          options={partTypeOptions.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
          disabled={isBusy}
          onChange={(nextValue) => setNextPartType(nextValue)}
        />
        <Button
          icon={<PlusOutlined />}
          disabled={isBusy}
          onClick={() => model.addPart(nextPartType)}
        >
          Добавить часть
        </Button>
        <Button
          icon={<ArrowUpOutlined />}
          disabled={isBusy || selectedPartIndex <= 0}
          onClick={model.moveSelectedPartUp}
        >
          Вверх
        </Button>
        <Button
          icon={<ArrowDownOutlined />}
          disabled={isBusy || selectedPartIndex < 0 || selectedPartIndex >= model.parts.length - 1}
          onClick={model.moveSelectedPartDown}
        >
          Вниз
        </Button>
        <Button
          danger
          icon={<DeleteOutlined />}
          disabled={isBusy || model.selectedPartId === null}
          onClick={model.removeSelectedPart}
        >
          Удалить
        </Button>
      </Space>

      <Space wrap>
        <Button
          icon={<UndoOutlined />}
          disabled={isBusy || !model.isDirty}
          onClick={model.resetDraft}
        >
          Сбросить
        </Button>
        <Button
          icon={<EyeOutlined />}
          loading={model.isPreviewing}
          disabled={isBusy}
          onClick={() => { void model.previewTemplate() }}
        >
          Предпросмотр
        </Button>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={model.isSaving}
          disabled={isBusy || !model.isDirty}
          onClick={() => { void model.saveTemplate() }}
        >
          Сохранить шаблон
        </Button>
      </Space>

      <ConcurrencyAlert
        problem={model.concurrencyProblem}
        onReload={onReloadEditor}
        onClose={onCloseConcurrencyAlert}
      />

      {model.previewErrorMessage !== null ? (
        <Alert
          showIcon
          type="error"
          message="Ошибка предпросмотра"
          description={model.previewErrorMessage}
        />
      ) : null}

      {model.saveErrorMessage !== null ? (
        <Alert
          showIcon
          type="error"
          message="Ошибка сохранения"
          description={model.saveErrorMessage}
        />
      ) : null}

      {generalPartsError !== null ? (
        <Alert
          showIcon
          type="warning"
          message={generalPartsError}
        />
      ) : null}

      <Table<(typeof model.parts)[number]>
        rowKey="clientId"
        columns={columns}
        dataSource={[...model.parts]}
        pagination={false}
        size="middle"
        rowSelection={{
          type: 'radio',
          selectedRowKeys: model.selectedPartId === null ? [] : [model.selectedPartId],
          onChange: (selectedRowKeys) => {
            const [selectedRowKey] = selectedRowKeys
            model.selectPart(typeof selectedRowKey === 'string' ? selectedRowKey : null)
          },
        }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Части шаблона не настроены."
            />
          ),
        }}
      />

      <Space direction="vertical" size={6} style={{ width: '100%' }}>
        <Space wrap>
          <Tag color="blue">Предпросмотр: {model.previewSampleCustomId || '(пусто)'}</Tag>
          <Tag>Regex: {model.derivedValidationRegex ?? '(нет)'}</Tag>
        </Space>

        {model.previewWarnings.length > 0 ? (
          <Space wrap>
            {model.previewWarnings.map((warning, index) => (
              <Tag key={`${warning}-${String(index)}`} color="orange">
                {warning}
              </Tag>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">
            Предупреждений предпросмотра нет.
          </Typography.Text>
        )}
      </Space>

      <Typography.Text type="secondary">
        Текущие части: {model.parts.map((part) => toPartTypeLabel(part.partType)).join(' + ') || '(нет)'}
      </Typography.Text>
    </Space>
  )
}
