import { Alert, Button, Form, Input, Select, Space, Switch, Typography, message } from 'antd'
import type { FormInstance } from 'antd'
import { useCallback } from 'react'
import type { InventoryCategoryOption } from '../../../entities/reference/model/types.ts'
import { navigate } from '../../../shared/lib/router/navigation.ts'
import { routes } from '../../../shared/config/routes.ts'
import {
  createInventoryContract,
  useCreateInventoryModel,
} from '../model/useCreateInventoryModel.ts'

type CreateInventoryFormValues = {
  title: string
  categoryId: number
  descriptionMarkdown: string
  imageUrl: string
  isPublic: boolean
  tags: string[]
}

type CreateInventoryFormProps = {
  categoryOptions: ReadonlyArray<InventoryCategoryOption>
  disabled?: boolean
}

const clearableFieldNames: ReadonlyArray<keyof CreateInventoryFormValues> = [
  'title',
  'categoryId',
  'descriptionMarkdown',
  'imageUrl',
  'tags',
]

function clearServerFieldErrors(form: FormInstance<CreateInventoryFormValues>): void {
  form.setFields(clearableFieldNames.map((fieldName) => ({ name: fieldName, errors: [] })))
}

function normalizeServerFieldName(serverFieldName: string): keyof CreateInventoryFormValues | null {
  if (/^tags\[\d+\]$/i.test(serverFieldName)) {
    return 'tags'
  }

  if (
    serverFieldName === 'title'
    || serverFieldName === 'categoryId'
    || serverFieldName === 'descriptionMarkdown'
    || serverFieldName === 'imageUrl'
    || serverFieldName === 'tags'
  ) {
    return serverFieldName
  }

  return null
}

function applyServerFieldErrors(
  form: FormInstance<CreateInventoryFormValues>,
  fieldErrors: Record<string, string[]>,
): void {
  const mergedErrors = new Map<keyof CreateInventoryFormValues, string[]>()

  for (const [serverFieldName, errors] of Object.entries(fieldErrors)) {
    if (errors.length === 0) {
      continue
    }

    const normalizedFieldName = normalizeServerFieldName(serverFieldName)
    if (normalizedFieldName === null) {
      continue
    }

    const previousErrors = mergedErrors.get(normalizedFieldName) ?? []
    mergedErrors.set(normalizedFieldName, [...previousErrors, ...errors])
  }

  if (mergedErrors.size === 0) {
    return
  }

  form.setFields(
    Array.from(mergedErrors.entries()).map(([fieldName, errors]) => ({
      name: fieldName,
      errors,
    })),
  )
}

function normalizeOptionalText(value: string): string | null {
  const normalizedValue = value.trim()
  return normalizedValue.length > 0 ? normalizedValue : null
}

function isAbsoluteUrl(value: string): boolean {
  try {
    // Backend accepts any absolute URI; URL parser validates structure.
    new URL(value)
    return true
  } catch {
    return false
  }
}

export function CreateInventoryForm({ categoryOptions, disabled = false }: CreateInventoryFormProps) {
  const [form] = Form.useForm<CreateInventoryFormValues>()
  const [messageApi, messageContextHolder] = message.useMessage()
  const {
    isSubmitting,
    submitErrorMessage,
    resetSubmitError,
    submit,
  } = useCreateInventoryModel()

  const handleSubmit = useCallback(
    async (values: CreateInventoryFormValues) => {
      clearServerFieldErrors(form)
      resetSubmitError()

      const result = await submit({
        title: values.title,
        categoryId: values.categoryId,
        descriptionMarkdown: values.descriptionMarkdown ?? '',
        imageUrl: normalizeOptionalText(values.imageUrl),
        isPublic: values.isPublic,
        tags: values.tags ?? [],
      })

      if (result.ok) {
        messageApi.success('Inventory created.')
        navigate(`/inventories/${result.inventoryId}`)
        return
      }

      if (result.cancelled) {
        return
      }

      applyServerFieldErrors(form, result.fieldErrors)
    },
    [form, messageApi, resetSubmitError, submit],
  )

  const handleReset = useCallback(() => {
    form.resetFields()
    clearServerFieldErrors(form)
    resetSubmitError()
  }, [form, resetSubmitError])

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {messageContextHolder}

      {submitErrorMessage !== null ? (
        <Alert
          showIcon
          type="error"
          message="Failed to create inventory"
          description={submitErrorMessage}
        />
      ) : null}

      <Form<CreateInventoryFormValues>
        form={form}
        layout="vertical"
        initialValues={{
          title: '',
          categoryId: undefined,
          descriptionMarkdown: '',
          imageUrl: '',
          isPublic: false,
          tags: [],
        }}
        onFinish={handleSubmit}
        onValuesChange={() => resetSubmitError()}
        disabled={disabled || isSubmitting}
      >
        <Form.Item<CreateInventoryFormValues>
          label="Title"
          name="title"
          validateFirst
          rules={[
            { required: true, whitespace: true, message: 'Title is required.' },
            {
              max: createInventoryContract.maxTitleLength,
              message: `Title must be ${String(createInventoryContract.maxTitleLength)} characters or less.`,
            },
          ]}
        >
          <Input
            maxLength={createInventoryContract.maxTitleLength}
            placeholder="Office laptops"
            autoComplete="off"
          />
        </Form.Item>

        <Form.Item<CreateInventoryFormValues>
          label="Category"
          name="categoryId"
          rules={[{ required: true, message: 'Select a category.' }]}
        >
          <Select<number>
            placeholder="Select category"
            options={[...categoryOptions]}
            showSearch
            optionFilterProp="label"
            loading={disabled && categoryOptions.length === 0}
          />
        </Form.Item>

        <Form.Item<CreateInventoryFormValues>
          label="Description (Markdown)"
          name="descriptionMarkdown"
          rules={[
            {
              max: createInventoryContract.maxDescriptionLength,
              message: (
                `Description must be ${String(createInventoryContract.maxDescriptionLength)} characters or less.`
              ),
            },
          ]}
        >
          <Input.TextArea
            rows={5}
            maxLength={createInventoryContract.maxDescriptionLength}
            showCount
            placeholder="Inventory for office devices"
          />
        </Form.Item>

        <Form.Item<CreateInventoryFormValues>
          label="Image URL"
          name="imageUrl"
          validateFirst
          rules={[
            {
              validator: async (_, value: string | undefined) => {
                const normalizedImageUrl = normalizeOptionalText(value ?? '')
                if (normalizedImageUrl === null) {
                  return
                }

                if (normalizedImageUrl.length > createInventoryContract.maxImageUrlLength) {
                  throw new Error(
                    `Image URL must be ${String(createInventoryContract.maxImageUrlLength)} characters or less.`,
                  )
                }

                if (!isAbsoluteUrl(normalizedImageUrl)) {
                  throw new Error('Image URL must be a valid absolute URL.')
                }
              },
            },
          ]}
        >
          <Input
            maxLength={createInventoryContract.maxImageUrlLength}
            placeholder="https://cdn.example.com/inventory.jpg"
            autoComplete="off"
          />
        </Form.Item>

        <Form.Item<CreateInventoryFormValues>
          label="Tags"
          name="tags"
          validateFirst
          rules={[
            {
              validator: async (_, value: string[] | undefined) => {
                if (value === undefined) {
                  return
                }

                for (let index = 0; index < value.length; index += 1) {
                  const normalizedTag = value[index]?.trim() ?? ''

                  if (normalizedTag.length === 0) {
                    throw new Error('Tags must not be empty.')
                  }

                  if (normalizedTag.length > createInventoryContract.maxTagLength) {
                    throw new Error(
                      `Each tag must be ${String(createInventoryContract.maxTagLength)} characters or less.`,
                    )
                  }
                }
              },
            },
          ]}
        >
          <Select
            mode="tags"
            tokenSeparators={[',']}
            placeholder="Add tags"
            maxTagCount="responsive"
          />
        </Form.Item>

        <Form.Item<CreateInventoryFormValues>
          label="Public write access"
          name="isPublic"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          Public inventories allow any authenticated user to create and edit items.
        </Typography.Paragraph>

        <Space wrap>
          <Button type="primary" htmlType="submit" loading={isSubmitting} disabled={disabled}>
            Create Inventory
          </Button>
          <Button onClick={handleReset} disabled={isSubmitting || disabled}>
            Reset
          </Button>
          <Button
            onClick={() => navigate(routes.myInventories.path)}
            disabled={isSubmitting}
          >
            Back to My Inventories
          </Button>
        </Space>
      </Form>
    </Space>
  )
}
