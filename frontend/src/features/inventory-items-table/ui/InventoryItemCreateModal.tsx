import { Alert, Form, Input, InputNumber, Modal, Space, Switch, Typography, message } from 'antd'
import type { FormInstance } from 'antd'
import { useCallback, useEffect, useMemo } from 'react'
import type { InventoryItemDetails } from '../../../entities/inventory/model/inventoryItemCreateApi.ts'
import type { InventoryCustomFieldType } from '../../../entities/inventory/model/inventoryEditorTypes.ts'
import {
  inventoryItemCreateContract,
  useInventoryItemCreateModel,
  type InventoryItemCreateFieldDefinition,
  type InventoryItemCreateInput,
} from '../model/useInventoryItemCreateModel.ts'

type InventoryItemCreateModalProps = {
  open: boolean
  inventoryId: string
  canWriteItems: boolean
  fieldDefinitions: ReadonlyArray<InventoryItemCreateFieldDefinition>
  customIdValidationRegex: string | null
  customIdPreviewSample: string | null
  onClose: () => void
  onCreated: (created: { item: InventoryItemDetails; etag: string | null }) => void
}

type InventoryItemCreateFormValues = {
  customId: string
  fields: Record<string, string | number | boolean | null | undefined>
}

type InventoryItemCreateFormFieldName = ['customId'] | ['fields', string]

const serverIndexedFieldPattern = /^fields\[(\d+)]\.(fieldId|value)$/i
const modelMappedFieldPattern = /^fields\.(\d+)$/i
const numberValidationTolerance = 1e-7

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

function toFieldLabel(field: InventoryItemCreateFieldDefinition): string {
  return `${field.title} (${toFieldTypeLabel(field.fieldType)})`
}

function createInitialFieldValues(
  fieldDefinitions: ReadonlyArray<InventoryItemCreateFieldDefinition>,
): InventoryItemCreateFormValues['fields'] {
  return fieldDefinitions.reduce<InventoryItemCreateFormValues['fields']>((accumulator, field) => {
    accumulator[field.fieldId] = field.fieldType === 'bool' ? false : undefined
    return accumulator
  }, {})
}

function clearServerFieldErrors(
  form: FormInstance<InventoryItemCreateFormValues>,
  fieldDefinitions: ReadonlyArray<InventoryItemCreateFieldDefinition>,
): void {
  form.setFields([
    { name: ['customId'], errors: [] },
    ...fieldDefinitions.map((field) => ({ name: ['fields', field.fieldId] as ['fields', string], errors: [] })),
  ])
}

function resolveFieldName(
  serverFieldName: string,
  fieldDefinitions: ReadonlyArray<InventoryItemCreateFieldDefinition>,
): InventoryItemCreateFormFieldName | null {
  if (serverFieldName === 'customId') {
    return ['customId']
  }

  const indexedFieldMatch = serverIndexedFieldPattern.exec(serverFieldName)
  if (indexedFieldMatch !== null) {
    const index = Number(indexedFieldMatch[1])
    const fieldDefinition = Number.isSafeInteger(index) ? fieldDefinitions[index] : undefined
    if (fieldDefinition !== undefined) {
      return ['fields', fieldDefinition.fieldId]
    }
  }

  const mappedFieldMatch = modelMappedFieldPattern.exec(serverFieldName)
  if (mappedFieldMatch !== null) {
    const fieldId = mappedFieldMatch[1]
    if (fieldDefinitions.some((fieldDefinition) => fieldDefinition.fieldId === fieldId)) {
      return ['fields', fieldId]
    }
  }

  return null
}

function applyServerFieldErrors(
  form: FormInstance<InventoryItemCreateFormValues>,
  fieldErrors: Record<string, string[]>,
  fieldDefinitions: ReadonlyArray<InventoryItemCreateFieldDefinition>,
): void {
  const mergedErrors = new Map<string, { name: InventoryItemCreateFormFieldName; errors: string[] }>()

  for (const [serverFieldName, errors] of Object.entries(fieldErrors)) {
    if (errors.length === 0) {
      continue
    }

    const normalizedName = resolveFieldName(serverFieldName, fieldDefinitions)
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

function countNumberDecimals(value: number): number {
  const normalizedValue = value.toString()
  const decimalSeparatorIndex = normalizedValue.indexOf('.')
  if (decimalSeparatorIndex < 0) {
    return 0
  }

  return normalizedValue.length - decimalSeparatorIndex - 1
}

function normalizeFormInput(values: InventoryItemCreateFormValues): InventoryItemCreateInput {
  return {
    customId: values.customId ?? '',
    fields: values.fields ?? {},
  }
}

function compileCustomIdValidationRegex(rawRegex: string | null): RegExp | null {
  if (rawRegex === null) {
    return null
  }

  const normalizedValue = rawRegex.trim()
  if (normalizedValue.length === 0) {
    return null
  }

  try {
    return new RegExp(normalizedValue)
  } catch {
    return null
  }
}

function matchesCustomIdRegex(value: string, regex: RegExp): boolean {
  if (regex.global || regex.sticky) {
    regex.lastIndex = 0
  }

  return regex.test(value)
}

export function InventoryItemCreateModal({
  open,
  inventoryId,
  canWriteItems,
  fieldDefinitions,
  customIdValidationRegex,
  customIdPreviewSample,
  onClose,
  onCreated,
}: InventoryItemCreateModalProps) {
  const [form] = Form.useForm<InventoryItemCreateFormValues>()
  const [messageApi, messageContextHolder] = message.useMessage()
  const compiledCustomIdValidationRegex = useMemo(
    () => compileCustomIdValidationRegex(customIdValidationRegex),
    [customIdValidationRegex],
  )

  const {
    isSubmitting,
    submitErrorMessage,
    resetSubmitState,
    cancelInFlight,
    submit,
  } = useInventoryItemCreateModel(inventoryId)

  const initialValues = useMemo<InventoryItemCreateFormValues>(
    () => ({
      customId: '',
      fields: createInitialFieldValues(fieldDefinitions),
    }),
    [fieldDefinitions],
  )

  useEffect(() => {
    if (!open) {
      return
    }

    form.setFieldsValue(initialValues)
    clearServerFieldErrors(form, fieldDefinitions)
    resetSubmitState()
  }, [fieldDefinitions, form, initialValues, open, resetSubmitState])

  const handleClose = useCallback(() => {
    cancelInFlight()
    form.setFieldsValue(initialValues)
    form.resetFields()
    clearServerFieldErrors(form, fieldDefinitions)
    resetSubmitState()
    onClose()
  }, [cancelInFlight, fieldDefinitions, form, initialValues, onClose, resetSubmitState])

  const handleSubmit = useCallback(async (values: InventoryItemCreateFormValues) => {
    clearServerFieldErrors(form, fieldDefinitions)
    resetSubmitState()

    const result = await submit(normalizeFormInput(values), fieldDefinitions)
    if (result.ok) {
      messageApi.success(`Элемент ${result.item.customId} создан.`)
      onCreated({ item: result.item, etag: result.etag })
      handleClose()
      return
    }

    if (result.cancelled) {
      return
    }

    applyServerFieldErrors(form, result.fieldErrors, fieldDefinitions)
  }, [fieldDefinitions, form, handleClose, messageApi, onCreated, resetSubmitState, submit])

  return (
    <Modal
      open={open}
      title="Создание элемента"
      okText="Создать элемент"
      cancelText="Отмена"
      confirmLoading={isSubmitting}
      centered
      okButtonProps={{ disabled: !canWriteItems }}
      cancelButtonProps={{ disabled: isSubmitting }}
      onOk={() => {
        void form.submit()
      }}
      onCancel={handleClose}
      width={760}
      destroyOnHidden
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {messageContextHolder}

        {!canWriteItems ? (
          <Alert
            showIcon
            type="warning"
            message="Требуется доступ на запись"
            description="Вы можете просматривать элементы, но создание элементов для вашей учетной записи в этом инвентаре недоступно."
          />
        ) : null}

        {submitErrorMessage !== null ? (
          <Alert
            showIcon
            type="error"
            message="Не удалось создать элемент"
            description={submitErrorMessage}
          />
        ) : null}

        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          Пользовательский ID
 не обязателен. Если оставить поле пустым, сервер сгенерирует значение по текущему шаблону ID инвентаря.
        </Typography.Paragraph>
        {customIdValidationRegex !== null ? (
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Регулярное выражение шаблона:
            {' '}
            <Typography.Text code>{customIdValidationRegex}</Typography.Text>
            {customIdPreviewSample === null || customIdPreviewSample.trim().length === 0
              ? null
              : (
                  <>
                    {' '}
                    Пример:
                    {' '}
                    <Typography.Text code>{customIdPreviewSample}</Typography.Text>
                  </>
                )}
          </Typography.Paragraph>
        ) : null}

        <Form<InventoryItemCreateFormValues>
          form={form}
          layout="vertical"
          initialValues={initialValues}
          disabled={isSubmitting || !canWriteItems}
          onValuesChange={() => {
            clearServerFieldErrors(form, fieldDefinitions)
            resetSubmitState()
          }}
          onFinish={handleSubmit}
        >
          <Form.Item<InventoryItemCreateFormValues>
            label="Пользовательский ID"
            name="customId"
            validateFirst
            rules={[
              {
                max: inventoryItemCreateContract.maxCustomIdLength,
                message: `customId не должен превышать ${String(inventoryItemCreateContract.maxCustomIdLength)} символов.`,
              },
              {
                validator: async (_, value: string | undefined) => {
                  if (compiledCustomIdValidationRegex === null) {
                    return
                  }

                  const normalizedValue = typeof value === 'string' ? value.trim() : ''
                  if (normalizedValue.length === 0) {
                    return
                  }

                  if (!matchesCustomIdRegex(normalizedValue, compiledCustomIdValidationRegex)) {
                    throw new Error('Значение customId не соответствует текущему формату шаблона.')
                  }
                },
              },
            ]}
          >
            <Input
              placeholder="Оставьте пустым для автогенерации"
              maxLength={inventoryItemCreateContract.maxCustomIdLength}
              autoComplete="off"
            />
          </Form.Item>

          {fieldDefinitions.map((field) => {
            if (field.fieldType === 'single_line' || field.fieldType === 'link') {
              const maxLength = field.fieldType === 'single_line'
                ? inventoryItemCreateContract.maxSingleLineLength
                : inventoryItemCreateContract.maxLinkLength

              return (
                <Form.Item<InventoryItemCreateFormValues>
                  key={field.fieldId}
                  label={toFieldLabel(field)}
                  name={['fields', field.fieldId]}
                  validateFirst
                  rules={[
                    {
                      max: maxLength,
                      message: `Значение не должно превышать ${String(maxLength)} символов.`,
                    },
                  ]}
                >
                  <Input
                    maxLength={maxLength}
                    autoComplete="off"
                  />
                </Form.Item>
              )
            }

            if (field.fieldType === 'multi_line') {
              return (
                <Form.Item<InventoryItemCreateFormValues>
                  key={field.fieldId}
                  label={toFieldLabel(field)}
                  name={['fields', field.fieldId]}
                  validateFirst
                  rules={[
                    {
                      max: inventoryItemCreateContract.maxMultiLineLength,
                      message: (
                        `Значение не должно превышать ${String(inventoryItemCreateContract.maxMultiLineLength)} символов.`
                      ),
                    },
                  ]}
                >
                  <Input.TextArea
                    rows={4}
                    maxLength={inventoryItemCreateContract.maxMultiLineLength}
                    showCount
                  />
                </Form.Item>
              )
            }

            if (field.fieldType === 'number') {
              return (
                <Form.Item<InventoryItemCreateFormValues>
                  key={field.fieldId}
                  label={toFieldLabel(field)}
                  name={['fields', field.fieldId]}
                  validateFirst
                  rules={[
                    {
                      validator: async (_, value: number | null | undefined) => {
                        if (value === null || value === undefined) {
                          return
                        }

                        if (typeof value !== 'number' || !Number.isFinite(value)) {
                          throw new Error('Значение должно быть числом.')
                        }

                        if (
                          value < inventoryItemCreateContract.minNumberValue
                          || value > inventoryItemCreateContract.maxNumberValue
                        ) {
                          throw new Error('Число вне допустимого диапазона.')
                        }

                        const decimals = countNumberDecimals(value)
                        if (decimals > inventoryItemCreateContract.maxNumberDecimals + numberValidationTolerance) {
                          throw new Error(
                            `Допускается не более ${String(inventoryItemCreateContract.maxNumberDecimals)} знаков после запятой.`,
                          )
                        }
                      },
                    },
                  ]}
                >
                  <InputNumber<number>
                    min={inventoryItemCreateContract.minNumberValue}
                    max={inventoryItemCreateContract.maxNumberValue}
                    precision={inventoryItemCreateContract.maxNumberDecimals}
                    step={0.0001}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              )
            }

            return (
              <Form.Item<InventoryItemCreateFormValues>
                key={field.fieldId}
                label={toFieldLabel(field)}
                name={['fields', field.fieldId]}
                valuePropName="checked"
              >
                <Switch checkedChildren="Да" unCheckedChildren="Нет" />
              </Form.Item>
            )
          })}
        </Form>
      </Space>
    </Modal>
  )
}
