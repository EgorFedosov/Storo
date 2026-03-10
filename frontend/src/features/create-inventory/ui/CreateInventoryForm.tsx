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
        messageApi.success('Инвентарь создан.')
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
          message="Не удалось создать инвентарь"
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
          label="Название"
          name="title"
          validateFirst
          rules={[
            { required: true, whitespace: true, message: 'Укажите название.' },
            {
              max: createInventoryContract.maxTitleLength,
              message: `Название должно быть не длиннее ${String(createInventoryContract.maxTitleLength)} символов.`,
            },
          ]}
        >
          <Input
            maxLength={createInventoryContract.maxTitleLength}
            placeholder="Ноутбуки офиса"
            autoComplete="off"
          />
        </Form.Item>

        <Form.Item<CreateInventoryFormValues>
          label="Категория"
          name="categoryId"
          rules={[{ required: true, message: 'Выберите категорию.' }]}
        >
          <Select<number>
            placeholder="Выберите категорию"
            options={[...categoryOptions]}
            showSearch
            optionFilterProp="label"
            loading={disabled && categoryOptions.length === 0}
          />
        </Form.Item>

        <Form.Item<CreateInventoryFormValues>
          label="Описание (Markdown)"
          name="descriptionMarkdown"
          rules={[
            {
              max: createInventoryContract.maxDescriptionLength,
              message: (
                `Описание должно быть не длиннее ${String(createInventoryContract.maxDescriptionLength)} символов.`
              ),
            },
          ]}
        >
          <Input.TextArea
            rows={5}
            maxLength={createInventoryContract.maxDescriptionLength}
            showCount
            placeholder="Инвентарь офисной техники"
          />
        </Form.Item>

        <Form.Item<CreateInventoryFormValues>
          label="Ссылка на изображение"
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
                    `Ссылка на изображение должна быть не длиннее ${String(createInventoryContract.maxImageUrlLength)} символов.`,
                  )
                }

                if (!isAbsoluteUrl(normalizedImageUrl)) {
                  throw new Error('Укажите корректный абсолютный URL изображения.')
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
          label="Теги"
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
                    throw new Error('Теги не могут быть пустыми.')
                  }

                  if (normalizedTag.length > createInventoryContract.maxTagLength) {
                    throw new Error(
                      `Каждый тег должен быть не длиннее ${String(createInventoryContract.maxTagLength)} символов.`,
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
            placeholder="Добавьте теги"
            maxTagCount="responsive"
          />
        </Form.Item>

        <Form.Item<CreateInventoryFormValues>
          label="Публичный доступ на запись"
          name="isPublic"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          В публичных инвентарях любой авторизованный пользователь может создавать и редактировать предметы.
        </Typography.Paragraph>

        <Space wrap>
          <Button type="primary" htmlType="submit" loading={isSubmitting} disabled={disabled}>
            Создать инвентарь
          </Button>
          <Button onClick={handleReset} disabled={isSubmitting || disabled}>
            Сбросить
          </Button>
          <Button
            onClick={() => navigate(routes.myInventories.path)}
            disabled={isSubmitting}
          >
            Назад к моим инвентарям
          </Button>
        </Space>
      </Form>
    </Space>
  )
}
