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
      messageApi.success(`Item ${result.item.customId} created.`)
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
      title="Create Item"
      okText="Create Item"
      cancelText="Cancel"
      confirmLoading={isSubmitting}
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
            message="Write access is required"
            description="You can view items, but creating items is not available for your account in this inventory."
          />
        ) : null}

        {submitErrorMessage !== null ? (
          <Alert
            showIcon
            type="error"
            message="Failed to create item"
            description={submitErrorMessage}
          />
        ) : null}

        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          `customId` is optional. If left empty, backend generates it by the current inventory custom ID template.
        </Typography.Paragraph>
        {customIdValidationRegex !== null ? (
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Template regex:
            {' '}
            <Typography.Text code>{customIdValidationRegex}</Typography.Text>
            {customIdPreviewSample === null || customIdPreviewSample.trim().length === 0
              ? null
              : (
                  <>
                    {' '}
                    Sample:
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
            label="Custom ID"
            name="customId"
            validateFirst
            rules={[
              {
                max: inventoryItemCreateContract.maxCustomIdLength,
                message: `customId must be ${String(inventoryItemCreateContract.maxCustomIdLength)} characters or less.`,
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
                    throw new Error('customId does not match current template format.')
                  }
                },
              },
            ]}
          >
            <Input
              placeholder="Leave empty for auto-generation"
              maxLength={inventoryItemCreateContract.maxCustomIdLength}
              autoComplete="off"
            />
          </Form.Item>

          {fieldDefinitions.length === 0 ? (
            <Alert
              showIcon
              type="info"
              message="No active custom fields"
              description="This inventory has no active custom fields. You can still create an item with generated customId."
            />
          ) : null}

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
                      message: `Value must be ${String(maxLength)} characters or less.`,
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
                        `Value must be ${String(inventoryItemCreateContract.maxMultiLineLength)} characters or less.`
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
                          throw new Error('Number value must be numeric.')
                        }

                        if (
                          value < inventoryItemCreateContract.minNumberValue
                          || value > inventoryItemCreateContract.maxNumberValue
                        ) {
                          throw new Error('Number value is out of supported range.')
                        }

                        const decimals = countNumberDecimals(value)
                        if (decimals > inventoryItemCreateContract.maxNumberDecimals + numberValidationTolerance) {
                          throw new Error(
                            `Number value must have at most ${String(inventoryItemCreateContract.maxNumberDecimals)} decimal places.`,
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
                <Switch checkedChildren="True" unCheckedChildren="False" />
              </Form.Item>
            )
          })}
        </Form>
      </Space>
    </Modal>
  )
}
