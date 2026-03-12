import { DeleteOutlined, UploadOutlined } from '@ant-design/icons'
import { Alert, Button, Form, Input, Select, Space, Switch, Tag, Typography, Upload, message } from 'antd'
import type { FormInstance } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  deleteInventoryFile,
  uploadInventoryFile,
} from '../../../entities/inventory/model/inventoryImageUploadApi.ts'
import type { InventoryCategoryOption } from '../../../entities/reference/model/types.ts'
import type { ApiFailure } from '../../../shared/api/httpClient.ts'
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

type CreateImageUploadStatus = 'idle' | 'uploading' | 'deleting' | 'success' | 'error'

type CreateImageUploadState = {
  status: CreateImageUploadStatus
  fileName: string | null
  errorMessage: string | null
  uploadedPublicUrl: string | null
}

const maxImageUploadFileNameLength = 255
const maxImageUploadContentTypeLength = 255
const allowedUploadFileExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.pdf'])
const allowedUploadMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'application/pdf',
])

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

function createInitialImageUploadState(): CreateImageUploadState {
  return {
    status: 'idle',
    fileName: null,
    errorMessage: null,
    uploadedPublicUrl: null,
  }
}

function validateImageUploadFile(file: File): string | null {
  const normalizedFileName = file.name.trim()
  const normalizedContentType = file.type.trim().toLowerCase()
  const extensionMatch = /\.[^./\\]+$/.exec(normalizedFileName)
  const normalizedExtension = extensionMatch === null
    ? ''
    : extensionMatch[0].toLowerCase()

  if (normalizedFileName.length === 0) {
    return 'Имя файла обязательно.'
  }

  if (normalizedFileName.length > maxImageUploadFileNameLength) {
    return `Имя файла должно быть не длиннее ${String(maxImageUploadFileNameLength)} символов.`
  }

  if (!allowedUploadFileExtensions.has(normalizedExtension)) {
    return 'Допустимы только файлы .jpg, .jpeg, .png, .webp, .gif, .bmp, .pdf.'
  }

  if (normalizedContentType.length === 0) {
    return 'Content-Type файла обязателен.'
  }

  if (normalizedContentType.length > maxImageUploadContentTypeLength) {
    return `Content-Type файла должен быть не длиннее ${String(maxImageUploadContentTypeLength)} символов.`
  }

  if (!allowedUploadMimeTypes.has(normalizedContentType)) {
    return 'Допустимы только изображения (jpg/jpeg/png/webp/gif/bmp) и PDF.'
  }

  if (normalizedExtension === '.pdf' && normalizedContentType !== 'application/pdf') {
    return 'Для PDF требуется content-type application/pdf.'
  }

  if (normalizedExtension !== '.pdf' && !normalizedContentType.startsWith('image/')) {
    return 'Для изображений требуется content-type image/*.'
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    return 'Размер файла должен быть положительным.'
  }

  return null
}

function imageUploadFailureMessage(failure: ApiFailure): string {
  if (failure.status === 401) {
    return 'Войдите в систему, чтобы загрузить файл.'
  }

  if (failure.status === 403) {
    return 'Недостаточно прав для загрузки файла.'
  }

  const validationErrors = failure.problem?.errors ?? {}
  for (const messages of Object.values(validationErrors)) {
    if (messages.length > 0) {
      return messages[0]
    }
  }

  return failure.error.message
}

function isPdfUrl(value: string): boolean {
  return /\.pdf(?:$|[?#])/i.test(value)
}

export function CreateInventoryForm({ categoryOptions, disabled = false }: CreateInventoryFormProps) {
  const [form] = Form.useForm<CreateInventoryFormValues>()
  const [messageApi, messageContextHolder] = message.useMessage()
  const [imageUpload, setImageUpload] = useState<CreateImageUploadState>(createInitialImageUploadState)
  const uploadAbortControllerRef = useRef<AbortController | null>(null)
  const uploadRequestSequenceRef = useRef(0)
  const watchedImageUrl = Form.useWatch('imageUrl', form) ?? ''
  const normalizedImageUrl = normalizeOptionalText(watchedImageUrl)
  const showImagePreview = normalizedImageUrl !== null && !isPdfUrl(normalizedImageUrl)
  const showPdfLink = normalizedImageUrl !== null && isPdfUrl(normalizedImageUrl)
  const isFileMutating = imageUpload.status === 'uploading' || imageUpload.status === 'deleting'
  const {
    isSubmitting,
    submitErrorMessage,
    resetSubmitError,
    submit,
  } = useCreateInventoryModel()

  useEffect(() => {
    return () => {
      uploadAbortControllerRef.current?.abort()
    }
  }, [])

  const handleSubmit = useCallback(
    async (values: CreateInventoryFormValues) => {
      if (isFileMutating) {
        return
      }

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
    [form, isFileMutating, messageApi, resetSubmitError, submit],
  )

  const uploadImageFile = useCallback(async (file: File): Promise<boolean> => {
    resetSubmitError()

    const validationError = validateImageUploadFile(file)
    if (validationError !== null) {
      setImageUpload({
        status: 'error',
        fileName: file.name,
        errorMessage: validationError,
        uploadedPublicUrl: null,
      })
      return false
    }

    uploadAbortControllerRef.current?.abort()
    const abortController = new AbortController()
    uploadAbortControllerRef.current = abortController
    uploadRequestSequenceRef.current += 1
    const requestId = uploadRequestSequenceRef.current

    setImageUpload({
      status: 'uploading',
      fileName: file.name,
      errorMessage: null,
      uploadedPublicUrl: null,
    })

    const uploadResult = await uploadInventoryFile(file, { signal: abortController.signal })
    if (abortController.signal.aborted || requestId !== uploadRequestSequenceRef.current) {
      return false
    }

    if (!uploadResult.ok) {
      setImageUpload({
        status: 'error',
        fileName: file.name,
        errorMessage: imageUploadFailureMessage(uploadResult),
        uploadedPublicUrl: null,
      })
      return false
    }

    uploadAbortControllerRef.current = null
    form.setFieldValue('imageUrl', uploadResult.data.publicUrl)
    form.setFields([{ name: 'imageUrl', errors: [] }])
    setImageUpload({
      status: 'success',
      fileName: uploadResult.data.fileName,
      errorMessage: null,
      uploadedPublicUrl: uploadResult.data.publicUrl,
    })
    return true
  }, [form, resetSubmitError])

  const deleteUploadedImage = useCallback(async (): Promise<boolean> => {
    resetSubmitError()
    const currentImageUrl = normalizeOptionalText(form.getFieldValue('imageUrl') ?? '')
    if (currentImageUrl === null) {
      setImageUpload({
        status: 'error',
        fileName: imageUpload.fileName,
        errorMessage: 'Файл еще не загружен.',
        uploadedPublicUrl: null,
      })
      return false
    }

    uploadAbortControllerRef.current?.abort()
    uploadRequestSequenceRef.current += 1

    setImageUpload((current) => ({
      ...current,
      status: 'deleting',
      errorMessage: null,
      uploadedPublicUrl: currentImageUrl,
    }))

    const deleteResult = await deleteInventoryFile(currentImageUrl)
    if (!deleteResult.ok) {
      setImageUpload((current) => ({
        ...current,
        status: 'error',
        errorMessage: imageUploadFailureMessage(deleteResult),
      }))
      return false
    }

    form.setFieldValue('imageUrl', '')
    form.setFields([{ name: 'imageUrl', errors: [] }])
    setImageUpload(createInitialImageUploadState())
    return true
  }, [form, imageUpload.fileName, resetSubmitError])

  const handleReset = useCallback(() => {
    uploadAbortControllerRef.current?.abort()
    uploadAbortControllerRef.current = null
    uploadRequestSequenceRef.current += 1
    form.resetFields()
    clearServerFieldErrors(form)
    resetSubmitError()
    setImageUpload(createInitialImageUploadState())
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
        disabled={disabled || isSubmitting || isFileMutating}
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
          label="Описание"
          name="descriptionMarkdown"
          rules={[
            {
              max: createInventoryContract.maxDescriptionLength,
              message: `Описание должно быть не длиннее ${String(createInventoryContract.maxDescriptionLength)} символов.`,
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

        <Form.Item<CreateInventoryFormValues> label="Файл изображения">
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            <Space wrap>
              <Upload
                accept=".jpg,.jpeg,.png,.webp,.gif,.bmp,.pdf,image/jpeg,image/png,image/webp,image/gif,image/bmp,application/pdf"
                maxCount={1}
                showUploadList={false}
                disabled={disabled || isSubmitting || isFileMutating}
                customRequest={async (requestOptions) => {
                  const { file, onError, onSuccess } = requestOptions
                  if (!(file instanceof File)) {
                    onError?.(new Error('Выбранный файл имеет некорректный формат.'))
                    return
                  }

                  const uploaded = await uploadImageFile(file)
                  if (uploaded) {
                    onSuccess?.({})
                    return
                  }

                  onError?.(new Error('Загрузка файла не завершена.'))
                }}
              >
                <Button
                  icon={<UploadOutlined />}
                  loading={imageUpload.status === 'uploading'}
                  disabled={disabled || isSubmitting || isFileMutating}
                >
                  {imageUpload.status === 'uploading' ? 'Загрузка файла...' : 'Загрузить файл'}
                </Button>
              </Upload>
              <Button
                danger
                icon={<DeleteOutlined />}
                loading={imageUpload.status === 'deleting'}
                onClick={() => {
                  void deleteUploadedImage()
                }}
                disabled={disabled || isSubmitting || isFileMutating || normalizedImageUrl === null}
              >
                Удалить файл
              </Button>
            </Space>

            <Typography.Text type="secondary">
              Допустимые форматы: JPG, JPEG, PNG, WEBP, GIF, BMP, PDF.
            </Typography.Text>

            <Space size={8} wrap>
              {imageUpload.fileName !== null ? <Tag>{imageUpload.fileName}</Tag> : null}
              {imageUpload.status === 'uploading' ? <Tag color="processing">Загрузка в хранилище</Tag> : null}
              {imageUpload.status === 'deleting' ? <Tag color="processing">Удаление из хранилища</Tag> : null}
              {imageUpload.status === 'success' ? <Tag color="green">Файл загружен</Tag> : null}
            </Space>

            {imageUpload.errorMessage !== null ? (
              <Alert showIcon type="error" message="Ошибка загрузки файла" description={imageUpload.errorMessage} />
            ) : null}

            {showImagePreview ? (
              <img
                src={normalizedImageUrl}
                alt="Предпросмотр изображения"
                style={{ maxWidth: 320, width: '100%', borderRadius: 8, objectFit: 'cover', border: '1px solid #dbe3ec' }}
              />
            ) : null}

            {showPdfLink ? (
              <Typography.Link href={normalizedImageUrl} target="_blank" rel="noreferrer">
                Открыть PDF в новой вкладке
              </Typography.Link>
            ) : null}
          </Space>
        </Form.Item>

        <Form.Item<CreateInventoryFormValues>
          name="imageUrl"
          hidden
          validateFirst
          rules={[
            {
              validator: async (_, value: string | undefined) => {
                const normalizedValue = normalizeOptionalText(value ?? '')
                if (normalizedValue === null) {
                  return
                }

                if (normalizedValue.length > createInventoryContract.maxImageUrlLength) {
                  throw new Error(
                    `Ссылка на изображение должна быть не длиннее ${String(createInventoryContract.maxImageUrlLength)} символов.`,
                  )
                }

                if (!isAbsoluteUrl(normalizedValue)) {
                  throw new Error('Ссылка на изображение должна быть абсолютным URL.')
                }
              },
            },
          ]}
        >
          <Input />
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
          В публичных инвентарях любой авторизованный пользователь может создавать и редактировать элементы.
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
