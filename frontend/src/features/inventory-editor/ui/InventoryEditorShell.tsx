import { DeleteOutlined, UploadOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Empty, Input, Modal, Popconfirm, Progress, Select, Space, Table, Tabs, Tag, Typography, Upload, message } from 'antd'
import type { TableProps } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { fetchAdminUsersPage } from '../../../entities/admin-user/model/adminUsersApi.ts'
import { generateInventoryOdooToken, inventoryEditorTagsContract } from '../../../entities/inventory/model/inventoryEditorApi.ts'
import type { ConcurrencyProblem } from '../../../shared/api/concurrency.ts'
import type { ApiFailure } from '../../../shared/api/httpClient.ts'
import { ConcurrencyAlert } from '../../../shared/ui/kit/ConcurrencyAlert.tsx'
import type { InventoryCategoryOption } from '../../../entities/reference/model/types.ts'
import type { InventoryEditor } from '../../../entities/inventory/model/inventoryEditorTypes.ts'
import { CustomFieldsAutosaveTab } from './CustomFieldsAutosaveTab.tsx'
import { CustomIdTemplateBuilderTab } from './CustomIdTemplateBuilderTab.tsx'
import {
  tagAutocompleteContract,
  useTagAutocompleteModel,
} from '../../../features/tags/model/useTagAutocompleteModel.ts'
import type {
  InventoryAccessDraft,
  InventoryAccessEditorState,
  CustomFieldsAutosaveStatus,
  InventoryDeleteState,
  InventoryCustomIdTemplateBuilderModel,
  InventoryEditorCustomFieldDraft,
  InventoryEditorCustomFieldDraftErrors,
  InventoryEditorSettingsDraft,
  InventoryEditorTabKey,
  InventoryEditorTabState,
  InventorySettingsAutosaveState,
  InventoryTagsAutosaveState,
} from '../model/useInventoryEditorModel.ts'

type InventoryEditorShellProps = {
  editor: InventoryEditor
  etag: string | null
  activeTabKey: InventoryEditorTabKey
  tabStates: ReadonlyArray<InventoryEditorTabState>
  categoryOptions: ReadonlyArray<InventoryCategoryOption>
  referencesStatus: 'loading' | 'ready' | 'error'
  referencesErrorMessage: string | null
  retryReferences: () => void
  concurrencyProblem: ConcurrencyProblem | null
  settingsAutosave: InventorySettingsAutosaveState
  tagsAutosave: InventoryTagsAutosaveState
  accessEditor: InventoryAccessEditorState
  customIdTemplate: InventoryCustomIdTemplateBuilderModel
  customFieldDrafts: ReadonlyArray<InventoryEditorCustomFieldDraft>
  selectedCustomFieldKey: string | null
  customFieldValidationByKey: Readonly<Record<string, InventoryEditorCustomFieldDraftErrors>>
  customFieldGlobalValidationErrors: ReadonlyArray<string>
  customFieldsSaveStatus: CustomFieldsAutosaveStatus
  customFieldsSaveErrorMessage: string | null
  customFieldsLastSavedAt: number | null
  isCustomFieldsMutating: boolean
  deleteFlow: InventoryDeleteState
  onReloadEditor: () => void
  onClearConcurrencyProblem: () => void
  onUpdateSettingsDraft: (patch: Partial<InventoryEditorSettingsDraft>) => void
  onUploadSettingsImage: (file: File) => Promise<boolean>
  onDeleteSettingsImageFromStorage: () => Promise<boolean>
  onCancelSettingsImageUpload: () => void
  onDeleteInventory: () => Promise<void>
  onSaveSettingsNow: () => void
  onResetSettingsDraft: () => void
  onUpdateTagsDraft: (nextTags: ReadonlyArray<string>) => void
  onSaveTagsNow: () => void
  onResetTagsDraft: () => void
  onUpdateAccessDraft: (patch: Partial<InventoryAccessDraft>) => void
  onSaveAccessNow: () => void
  onResetAccessDraft: () => void
  onSelectCustomField: (fieldKey: string | null) => void
  onAddCustomField: () => void
  onUpdateCustomField: (
    fieldKey: string,
    patch: Partial<Pick<InventoryEditorCustomFieldDraft, 'fieldType' | 'title' | 'description' | 'showInTable'>>,
  ) => void
  onRemoveSelectedCustomField: () => void
  onMoveSelectedCustomFieldUp: () => void
  onMoveSelectedCustomFieldDown: () => void
  onSaveCustomFieldsNow: () => void
  onResetCustomFieldsDrafts: () => void
  onTabChange: (nextTabKey: InventoryEditorTabKey) => void
}

type PropertyValueRow = {
  key: string
  property: string
  value: string
}

type WriterRow = {
  key: string
  id: string
  displayName: string
  userName: string
  email: string
  isBlocked: boolean
}

function isInventoryEditorTabKey(value: string): value is InventoryEditorTabKey {
  return (
    value === 'settings'
    || value === 'tags'
    || value === 'access'
    || value === 'customFields'
    || value === 'customIdTemplate'
  )
}

function toFieldErrorMessage(state: InventorySettingsAutosaveState, field: keyof InventoryEditorSettingsDraft): string | null {
  const fieldErrors = state.fieldErrors[field]
  return fieldErrors !== undefined && fieldErrors.length > 0 ? fieldErrors[0] : null
}

function hasFieldErrors(state: InventorySettingsAutosaveState): boolean {
  return Object.values(state.fieldErrors).some((messages) => (messages?.length ?? 0) > 0)
}

function firstTagFieldError(state: InventoryTagsAutosaveState): string | null {
  for (const messages of Object.values(state.fieldErrors)) {
    if (messages.length > 0) {
      return messages[0]
    }
  }

  return null
}

function hasTagFieldErrors(state: InventoryTagsAutosaveState): boolean {
  return Object.values(state.fieldErrors).some((messages) => messages.length > 0)
}

type OdooIntegrationState = {
  enabled: boolean
  canViewToken: boolean
  canGenerateToken: boolean
  hasActiveToken: boolean
  maskedToken: string | null
  generatedAt: string | null
  plainToken: string | null
  isGenerating: boolean
  errorMessage: string | null
}

function firstValidationErrorMessage(failure: ApiFailure): string | null {
  const validationErrors = failure.problem?.errors ?? {}

  for (const errors of Object.values(validationErrors)) {
    if (errors.length > 0) {
      return errors[0]
    }
  }

  return null
}

function resolveOdooTokenGenerationFailureMessage(failure: ApiFailure): string {
  if (failure.status === 401) {
    return 'Сессия истекла. Выполните вход снова.'
  }

  if (failure.status === 403) {
    return 'Недостаточно прав для выполнения действия.'
  }

  if (failure.status === 404) {
    return 'Запрашиваемые данные не найдены.'
  }

  if (failure.status === 409) {
    return 'Конфликт версии. Обновите страницу.'
  }

  if (failure.status === 502 || failure.status >= 500) {
    return 'Временная ошибка внешнего сервиса. Повторите позже.'
  }

  return firstValidationErrorMessage(failure) ?? failure.error.message
}

function formatDateTimeLabel(value: string | null): string | null {
  if (value === null) {
    return null
  }

  const timestamp = new Date(value)
  return Number.isNaN(timestamp.valueOf()) ? null : timestamp.toLocaleString()
}

type AutosaveBadgeState = {
  isSaving: boolean
  isQueued: boolean
  isDirty: boolean
  lastSavedAt: string | null
}

function renderAutosaveBadge(state: AutosaveBadgeState) {
  if (state.isSaving) {
    return <Tag color="processing">Сохранение...</Tag>
  }

  if (state.isQueued) {
    return <Tag color="gold">Изменения в очереди</Tag>
  }

  if (state.isDirty) {
    return <Tag color="orange">Есть несохраненные изменения</Tag>
  }

  if (state.lastSavedAt !== null) {
    const timestamp = new Date(state.lastSavedAt)
    const savedLabel = Number.isNaN(timestamp.valueOf())
      ? 'Сохранено'
      : `Сохранено ${timestamp.toLocaleTimeString()}`
    return <Tag color="green">{savedLabel}</Tag>
  }

  return <Tag color="default">Нет изменений</Tag>
}

function renderSettingsTab({
  editor,
  categoryOptions,
  referencesStatus,
  referencesErrorMessage,
  retryReferences,
  concurrencyProblem,
  settingsAutosave,
  odooIntegration,
  onReloadEditor,
  onClearConcurrencyProblem,
  onUpdateSettingsDraft,
  onUploadSettingsImage,
  onDeleteSettingsImageFromStorage,
  onCancelSettingsImageUpload,
  onGenerateOdooToken,
  onCloseOdooPlainTokenModal,
  onCopyOdooPlainToken,
  deleteFlow,
  onDeleteInventory,
  onSaveSettingsNow,
  onResetSettingsDraft,
}: {
  editor: InventoryEditor
  categoryOptions: ReadonlyArray<InventoryCategoryOption>
  referencesStatus: 'loading' | 'ready' | 'error'
  referencesErrorMessage: string | null
  retryReferences: () => void
  concurrencyProblem: ConcurrencyProblem | null
  settingsAutosave: InventorySettingsAutosaveState
  odooIntegration: OdooIntegrationState
  onReloadEditor: () => void
  onClearConcurrencyProblem: () => void
  onUpdateSettingsDraft: (patch: Partial<InventoryEditorSettingsDraft>) => void
  onUploadSettingsImage: (file: File) => Promise<boolean>
  onDeleteSettingsImageFromStorage: () => Promise<boolean>
  onCancelSettingsImageUpload: () => void
  onGenerateOdooToken: () => Promise<void>
  onCloseOdooPlainTokenModal: () => void
  onCopyOdooPlainToken: () => Promise<void>
  deleteFlow: InventoryDeleteState
  onDeleteInventory: () => Promise<void>
  onSaveSettingsNow: () => void
  onResetSettingsDraft: () => void
}) {
  const draft = settingsAutosave.draft
  if (draft === null) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="Черновик настроек не инициализирован."
      />
    )
  }

  const titleError = toFieldErrorMessage(settingsAutosave, 'title')
  const descriptionError = toFieldErrorMessage(settingsAutosave, 'descriptionMarkdown')
  const categoryError = toFieldErrorMessage(settingsAutosave, 'categoryId')
  const imageUrlError = toFieldErrorMessage(settingsAutosave, 'imageUrl')
  const saveDisabled = (
    !settingsAutosave.canAutosave
    || settingsAutosave.isSaving
    || !settingsAutosave.isDirty
    || hasFieldErrors(settingsAutosave)
  )
  const resetDisabled = !settingsAutosave.isDirty || settingsAutosave.isSaving
  const selectDisabled = !settingsAutosave.canAutosave || settingsAutosave.isSaving || referencesStatus === 'loading'
  const imageUpload = settingsAutosave.imageUpload
  const isImageUploading = imageUpload.status === 'uploading' || imageUpload.status === 'deleting'
  const uploadDisabled = !settingsAutosave.canAutosave || settingsAutosave.isSaving || isImageUploading
  const deleteDisabled = !settingsAutosave.canAutosave || settingsAutosave.isSaving || deleteFlow.isDeleting
  const normalizedImageUrl = draft.imageUrl.trim()
  const isUploadedPdf = /\.pdf(?:$|[?#])/i.test(normalizedImageUrl)
  const deleteUploadedFileDisabled = uploadDisabled || normalizedImageUrl.length === 0
  const canShowImagePreview = normalizedImageUrl.length > 0 && imageUrlError === null && !isUploadedPdf
  const canShowFileLink = normalizedImageUrl.length > 0 && imageUrlError === null && isUploadedPdf

  const odooTokenStatusColor = odooIntegration.hasActiveToken ? 'green' : 'default'
  const odooTokenStatusLabel = odooIntegration.hasActiveToken ? '\u0435\u0441\u0442\u044c' : '\u043d\u0435\u0442'
  const odooGeneratedAtLabel = formatDateTimeLabel(odooIntegration.generatedAt)
  const odooShowNoAccessMessage = !odooIntegration.canGenerateToken || !odooIntegration.canViewToken
  const odooActionLabel = odooIntegration.hasActiveToken ? 'Regenerate' : 'Generate'

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <ConcurrencyAlert
        problem={concurrencyProblem}
        onReload={onReloadEditor}
        onClose={onClearConcurrencyProblem}
      />

      {referencesStatus === 'error' ? (
        <Alert
          showIcon
          type="warning"
          message="Справочник категорий недоступен"
          description={referencesErrorMessage ?? 'Не удалось загрузить /categories.'}
          action={(
            <Button size="small" onClick={retryReferences}>
              Повторить
            </Button>
          )}
        />
      ) : null}

      {settingsAutosave.errorMessage !== null ? (
        <Alert
          showIcon
          type="error"
          message="Сбой автосохранения настроек"
          description={settingsAutosave.errorMessage}
        />
      ) : null}

      <Space size={8} wrap>
        {renderAutosaveBadge(settingsAutosave)}
        <Tag>Измененных полей: {settingsAutosave.dirtyFields.length}</Tag>
      </Space>

      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <Typography.Text strong>Название</Typography.Text>
        <Input
          value={draft.title}
          maxLength={200}
          status={titleError !== null ? 'error' : undefined}
          onChange={(event) => {
            onUpdateSettingsDraft({ title: event.target.value })
          }}
          disabled={!settingsAutosave.canAutosave || settingsAutosave.isSaving}
          placeholder="Название инвентаря"
          autoComplete="off"
        />
        {titleError !== null ? <Typography.Text type="danger">{titleError}</Typography.Text> : null}
      </Space>

      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <Typography.Text strong>Категория</Typography.Text>
        <Select<number>
          value={draft.categoryId ?? undefined}
          options={[...categoryOptions]}
          showSearch
          optionFilterProp="label"
          loading={referencesStatus === 'loading'}
          status={categoryError !== null ? 'error' : undefined}
          onChange={(nextCategoryId) => {
            onUpdateSettingsDraft({ categoryId: nextCategoryId })
          }}
          disabled={selectDisabled}
          placeholder="Выберите категорию"
        />
        {categoryError !== null ? <Typography.Text type="danger">{categoryError}</Typography.Text> : null}
      </Space>

      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <Typography.Text strong>Описание</Typography.Text>
        <Input.TextArea
          value={draft.descriptionMarkdown}
          rows={5}
          maxLength={10_000}
          showCount
          status={descriptionError !== null ? 'error' : undefined}
          onChange={(event) => {
            onUpdateSettingsDraft({ descriptionMarkdown: event.target.value })
          }}
          disabled={!settingsAutosave.canAutosave || settingsAutosave.isSaving}
          placeholder="Описание инвентаря"
        />
        {descriptionError !== null ? <Typography.Text type="danger">{descriptionError}</Typography.Text> : null}
      </Space>

      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <Typography.Text strong>Загрузка изображения</Typography.Text>
        <Space wrap>
          <Upload
            accept=".jpg,.jpeg,.png,.webp,.gif,.bmp,.pdf,image/jpeg,image/png,image/webp,image/gif,image/bmp,application/pdf"
            maxCount={1}
            showUploadList={false}
            disabled={uploadDisabled}
            customRequest={async (requestOptions) => {
              const { file, onError, onSuccess } = requestOptions
              if (!(file instanceof File)) {
                onError?.(new Error('Выбранный файл загрузки имеет некорректный формат.'))
                return
              }

              const uploadCompleted = await onUploadSettingsImage(file)
              if (uploadCompleted) {
                onSuccess?.({})
                return
              }

              onError?.(new Error('Загрузка изображения не была завершена.'))
            }}
          >
            <Button icon={<UploadOutlined />} loading={isImageUploading} disabled={uploadDisabled}>
              {isImageUploading ? 'Загрузка файла...' : 'Загрузить файл с устройства'}
            </Button>
          </Upload>
          <Button
            danger
            disabled={deleteUploadedFileDisabled}
            loading={imageUpload.status === 'deleting'}
            onClick={() => {
              void onDeleteSettingsImageFromStorage()
            }}
          >
            Удалить файл из хранилища
          </Button>
          {isImageUploading ? (
            <Button onClick={onCancelSettingsImageUpload}>
              Отменить загрузку
            </Button>
          ) : null}
        </Space>

        <Space size={8} wrap>
          {imageUpload.fileName !== null ? <Tag>{imageUpload.fileName}</Tag> : null}
          {imageUpload.status === 'uploading' ? <Tag color="processing">Загрузка в хранилище</Tag> : null}
          {imageUpload.status === 'deleting' ? <Tag color="processing">Удаление из хранилища</Tag> : null}
          {imageUpload.status === 'success' ? <Tag color="green">Загрузка завершена</Tag> : null}
        </Space>

        {isImageUploading || imageUpload.status === 'success' ? (
          <Progress percent={imageUpload.progressPercent ?? 0} size="small" />
        ) : null}

        {imageUpload.errorMessage !== null ? (
          <Alert
            showIcon
            type="error"
            message="Не удалось загрузить файл"
            description={imageUpload.errorMessage}
          />
        ) : null}

        {imageUpload.status === 'success' && imageUpload.uploadedPublicUrl !== null ? (
          <Typography.Text type="secondary">
            URL загруженного файла применен к настройкам и поставлен в очередь автосохранения.
          </Typography.Text>
        ) : null}
      </Space>

      {canShowImagePreview ? (
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Typography.Text type="secondary">
            Предпросмотр текущего изображения
          </Typography.Text>
          <img
            src={normalizedImageUrl}
            alt="Предпросмотр изображения инвентаря"
            style={{ maxWidth: 320, width: '100%', borderRadius: 8, objectFit: 'cover' }}
          />
        </Space>
      ) : null}

      {canShowFileLink ? (
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Typography.Text type="secondary">Загружен PDF-файл</Typography.Text>
          <Typography.Link href={normalizedImageUrl} target="_blank" rel="noreferrer">
            Открыть PDF в новой вкладке
          </Typography.Link>
        </Space>
      ) : null}

      <Card size="small" title="Интеграция Odoo">
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <Space size={8} wrap>
            <Tag color={odooTokenStatusColor}>Токен: {odooTokenStatusLabel}</Tag>
            {odooGeneratedAtLabel !== null ? <Tag>Сгенерирован: {odooGeneratedAtLabel}</Tag> : null}
          </Space>

          {!odooIntegration.enabled ? (
            <Alert
              showIcon
              type="warning"
              message="Интеграция Odoo отключена"
              description="Действия с Odoo-токеном сейчас недоступны."
            />
          ) : null}

          {odooIntegration.canViewToken ? (
            <Space direction="vertical" size={6}>
              <Typography.Text type="secondary">Маскированный токен</Typography.Text>
              <Typography.Text code>{odooIntegration.maskedToken ?? '\u2014'}</Typography.Text>
            </Space>
          ) : (
            <Typography.Text type="secondary">Маскированный токен недоступен.</Typography.Text>
          )}

          {odooShowNoAccessMessage ? (
            <Alert
              showIcon
              type="info"
              message="Нет доступа"
              description="Нет доступа к Odoo-токену. Обратитесь к создателю инвентаря или администратору."
            />
          ) : null}

          {odooIntegration.errorMessage !== null ? (
            <Alert
              showIcon
              type="error"
              message="Не удалось сгенерировать Odoo-токен"
              description={odooIntegration.errorMessage}
            />
          ) : null}

          {odooIntegration.canGenerateToken ? (
            <Button
              type="primary"
              onClick={() => {
                void onGenerateOdooToken()
              }}
              loading={odooIntegration.isGenerating}
              disabled={!odooIntegration.enabled || odooIntegration.isGenerating}
            >
              {odooActionLabel}
            </Button>
          ) : null}
        </Space>
      </Card>

      <Modal
        open={odooIntegration.plainToken !== null}
        title="Новый Odoo API token"
        onCancel={onCloseOdooPlainTokenModal}
        footer={[
          <Button
            key="copy"
            onClick={() => {
              void onCopyOdooPlainToken()
            }}
            disabled={odooIntegration.plainToken === null}
          >
            Copy
          </Button>,
          <Button key="close" type="primary" onClick={onCloseOdooPlainTokenModal}>
            Закрыть
          </Button>,
        ]}
      >
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <Typography.Text>
            Сохраните токен сейчас: после закрытия окна его нельзя будет снова увидеть.
          </Typography.Text>
          <Input.TextArea
            readOnly
            value={odooIntegration.plainToken ?? ''}
            autoSize={{ minRows: 2, maxRows: 4 }}
          />
        </Space>
      </Modal>

      <Space wrap>
        <Button type="primary" onClick={onSaveSettingsNow} loading={settingsAutosave.isSaving} disabled={saveDisabled}>
          Сохранить сейчас
        </Button>
        <Button onClick={onResetSettingsDraft} disabled={resetDisabled}>
          Сбросить изменения
        </Button>
      </Space>

      <Card size="small" title="Опасная зона">
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <Typography.Text type="danger">
            Удаление этого инвентаря необратимо и удаляет связанные элементы, правила доступа, теги и обсуждения.
          </Typography.Text>

          {deleteFlow.errorMessage !== null ? (
            <Alert
              showIcon
              type="error"
              message="Не удалось удалить инвентарь"
              description={deleteFlow.errorMessage}
            />
          ) : null}

          <Popconfirm
            title="Удалить инвентарь безвозвратно?"
            description={`Inventory #${editor.id} будет удален без возможности восстановления.`}
            okText="Удалить инвентарь"
            cancelText="Отмена"
            okButtonProps={{ danger: true, loading: deleteFlow.isDeleting }}
            onConfirm={onDeleteInventory}
            disabled={deleteDisabled}
          >
            <Button
              danger
              icon={<DeleteOutlined />}
              loading={deleteFlow.isDeleting}
              disabled={deleteDisabled}
            >
              Удалить инвентарь
            </Button>
          </Popconfirm>
        </Space>
      </Card>
    </Space>
  )
}

function TagsAutosaveTab({
  tagsAutosave,
  concurrencyProblem,
  onReloadEditor,
  onClearConcurrencyProblem,
  onUpdateTagsDraft,
  onSaveTagsNow,
  onResetTagsDraft,
}: {
  tagsAutosave: InventoryTagsAutosaveState
  concurrencyProblem: ConcurrencyProblem | null
  onReloadEditor: () => void
  onClearConcurrencyProblem: () => void
  onUpdateTagsDraft: (nextTags: ReadonlyArray<string>) => void
  onSaveTagsNow: () => void
  onResetTagsDraft: () => void
}) {
  const [searchPrefix, setSearchPrefix] = useState('')
  const {
    status: autocompleteStatus,
    items: autocompleteItems,
    errorMessage: autocompleteErrorMessage,
    requestSuggestions,
    resetSuggestions,
  } = useTagAutocompleteModel()

  useEffect(() => {
    const debounceHandle = window.setTimeout(() => {
      requestSuggestions(searchPrefix)
    }, tagAutocompleteContract.debounceMs)

    return () => {
      window.clearTimeout(debounceHandle)
    }
  }, [requestSuggestions, searchPrefix])

  const options = useMemo(
    () => autocompleteItems.map((item) => ({ value: item.name, label: item.name })),
    [autocompleteItems],
  )

  const tagsError = firstTagFieldError(tagsAutosave)
  const saveDisabled = (
    !tagsAutosave.canAutosave
    || tagsAutosave.isSaving
    || !tagsAutosave.isDirty
    || hasTagFieldErrors(tagsAutosave)
  )
  const resetDisabled = tagsAutosave.isSaving || !tagsAutosave.isDirty

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <ConcurrencyAlert
        problem={concurrencyProblem}
        onReload={onReloadEditor}
        onClose={onClearConcurrencyProblem}
      />

      {tagsAutosave.errorMessage !== null ? (
        <Alert
          showIcon
          type="error"
          message="Сбой автосохранения тегов"
          description={tagsAutosave.errorMessage}
        />
      ) : null}

      {autocompleteErrorMessage !== null ? (
        <Alert
          showIcon
          type="warning"
          message="Ошибка запроса автодополнения тегов"
          description={autocompleteErrorMessage}
        />
      ) : null}

      <Space size={8} wrap>
        {renderAutosaveBadge(tagsAutosave)}
        <Tag>Теги: {tagsAutosave.draft.length}</Tag>
      </Space>

      <Select<string[]>
        mode="tags"
        size="large"
        style={{ width: '100%' }}
        listHeight={320}
        value={[...tagsAutosave.draft]}
        options={options}
        tokenSeparators={[',']}
        maxTagCount="responsive"
        maxTagTextLength={inventoryEditorTagsContract.maxTagLength}
        placeholder="Добавьте теги"
        disabled={!tagsAutosave.canAutosave || tagsAutosave.isSaving}
        status={tagsError !== null ? 'error' : undefined}
        notFoundContent={autocompleteStatus === 'loading' ? 'Загрузка...' : undefined}
        onSearch={(nextPrefix) => {
          setSearchPrefix(nextPrefix)
        }}
        onDropdownVisibleChange={(open) => {
          if (!open) {
            resetSuggestions()
          }
        }}
        onChange={(nextValue) => {
          onUpdateTagsDraft(nextValue)
        }}
      />

      {searchPrefix.trim().length > 0 && searchPrefix.trim().length < tagAutocompleteContract.minPrefixLength ? (
        <Typography.Text type="secondary">
          Введите минимум {String(tagAutocompleteContract.minPrefixLength)} символа(ов), чтобы получить подсказки.
        </Typography.Text>
      ) : null}

      {tagsError !== null ? (
        <Typography.Text type="danger">
          {tagsError}
        </Typography.Text>
      ) : null}

      <Space wrap>
        <Button type="primary" onClick={onSaveTagsNow} loading={tagsAutosave.isSaving} disabled={saveDisabled}>
          Сохранить сейчас
        </Button>
        <Button onClick={onResetTagsDraft} disabled={resetDisabled}>
          Сбросить изменения
        </Button>
      </Space>
    </Space>
  )
}

function AccessEditorTab({
  editor,
  accessEditor,
  concurrencyProblem,
  onReloadEditor,
  onClearConcurrencyProblem,
  onUpdateAccessDraft,
  onSaveAccessNow,
  onResetAccessDraft,
}: {
  editor: InventoryEditor
  accessEditor: InventoryAccessEditorState
  concurrencyProblem: ConcurrencyProblem | null
  onReloadEditor: () => void
  onClearConcurrencyProblem: () => void
  onUpdateAccessDraft: (patch: Partial<InventoryAccessDraft>) => void
  onSaveAccessNow: () => void
  onResetAccessDraft: () => void
}) {
  const [knownUsers, setKnownUsers] = useState<
    ReadonlyArray<{ id: string; email: string; userName: string; displayName: string }>
  >([])
  const [isUsersLoading, setIsUsersLoading] = useState(false)
  const [usersErrorMessage, setUsersErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const abortController = new AbortController()
    let cancelled = false

    async function loadUsers() {
      setIsUsersLoading(true)
      setUsersErrorMessage(null)

      const loadedUsers: Array<{ id: string; email: string; userName: string; displayName: string }> = []
      let nextPage = 1
      let totalCount = Number.POSITIVE_INFINITY
      const pageSize = 100
      const maxPages = 50

      while (loadedUsers.length < totalCount && nextPage <= maxPages) {
        const result = await fetchAdminUsersPage(
          {
            blocked: 'all',
            role: 'all',
            query: null,
            page: nextPage,
            pageSize,
            sortField: 'userName',
            sortDirection: 'asc',
          },
          abortController.signal,
        )

        if (!result.ok) {
          if (!cancelled) {
            setUsersErrorMessage(result.problem?.detail ?? result.error.message)
          }
          setIsUsersLoading(false)
          return
        }

        totalCount = result.data.totalCount
        for (const user of result.data.items) {
          loadedUsers.push({
            id: user.id,
            email: user.email,
            userName: user.userName,
            displayName: user.displayName,
          })
        }

        if (result.data.items.length < pageSize) {
          break
        }

        nextPage += 1
      }

      if (cancelled) {
        return
      }

      const uniqueById = new Map<string, { id: string; email: string; userName: string; displayName: string }>()
      for (const user of loadedUsers) {
        if (!uniqueById.has(user.id)) {
          uniqueById.set(user.id, user)
        }
      }

      setKnownUsers(Array.from(uniqueById.values()))
      setIsUsersLoading(false)
    }

    void loadUsers()

    return () => {
      cancelled = true
      abortController.abort()
    }
  }, [])

  const draft = accessEditor.draft
  if (draft === null) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="Черновик прав доступа пока недоступен."
      />
    )
  }

  const rows: WriterRow[] = editor.access.writers.map((writer) => ({
    key: writer.id,
    id: writer.id,
    displayName: writer.displayName,
    userName: writer.userName,
    email: writer.email,
    isBlocked: writer.isBlocked,
  }))

  const availableUsers = knownUsers.length > 0
    ? knownUsers
    : rows.map((row) => ({
      id: row.id,
      email: row.email,
      userName: row.userName,
      displayName: row.displayName,
    }))
  const writerIdByEmail = new Map(availableUsers.map((user) => [user.email, user.id]))
  const writerEmailById = new Map(availableUsers.map((user) => [user.id, user.email]))
  const selectedWriterEmails = draft.writerUserIds
    .map((writerUserId) => writerEmailById.get(writerUserId))
    .filter((value): value is string => value !== undefined)
  const knownWriterEmailOptions = availableUsers.map((user) => ({
    value: user.email,
    label: `${user.displayName} (@${user.userName}) — ${user.email}`,
  }))
  const saveDisabled = !accessEditor.canEdit || accessEditor.isSaving || !accessEditor.isDirty
  const resetDisabled = accessEditor.isSaving || !accessEditor.isDirty
  const modeSelectDisabled = !accessEditor.canEdit || accessEditor.isSaving
  const writerEmailsDisabled = !accessEditor.canEdit || accessEditor.isSaving || draft.mode === 'public'

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {concurrencyProblem !== null ? (
        <ConcurrencyAlert
          problem={concurrencyProblem}
          onReload={onReloadEditor}
          onClose={onClearConcurrencyProblem}
        />
      ) : null}

      <Space size={8} wrap>
        {renderAutosaveBadge({
          isSaving: accessEditor.isSaving,
          isQueued: false,
          isDirty: accessEditor.isDirty,
          lastSavedAt: accessEditor.lastSavedAt,
        })}
        <Tag color={draft.mode === 'public' ? 'green' : 'gold'}>
          {draft.mode === 'public' ? 'Публичный доступ' : 'Ограниченный доступ'}
        </Tag>
        <Tag>Выданные права: {String(draft.writerUserIds.length)}</Tag>
      </Space>

      <Typography.Text strong>Режим доступа</Typography.Text>
      <Select<'public' | 'restricted'>
        size="large"
        style={{ width: '100%' }}
        value={draft.mode}
        disabled={modeSelectDisabled}
        options={[
          { value: 'public', label: 'Публичный (есть доступ у всех авторизованных)' },
          { value: 'restricted', label: 'Ограниченный (есть доступ только у выбранных)' },
        ]}
        onChange={(mode) => {
          onUpdateAccessDraft({ mode })
        }}
      />

      <Typography.Text strong>Email пользователей с правами на изменение</Typography.Text>
      <Select<string[]>
        mode="multiple"
        showSearch
        size="large"
        style={{ width: '100%' }}
        listHeight={320}
        value={selectedWriterEmails}
        options={knownWriterEmailOptions}
        placeholder="Выберите email пользователей"
        disabled={writerEmailsDisabled}
        loading={isUsersLoading}
        notFoundContent={isUsersLoading ? 'Загрузка пользователей...' : undefined}
        onChange={(nextEmails) => {
          const nextWriterUserIds = nextEmails
            .map((email) => writerIdByEmail.get(email))
            .filter((value): value is string => value !== undefined)

          onUpdateAccessDraft({ writerUserIds: nextWriterUserIds })
        }}
      />

      {!accessEditor.canEdit ? (
        <Typography.Text type="secondary">
          У вас нет прав на изменение доступа к этому инвентарю.
        </Typography.Text>
      ) : null}

      {usersErrorMessage !== null ? (
        <Typography.Text type="warning">
          Не удалось загрузить полный список пользователей: {usersErrorMessage}
        </Typography.Text>
      ) : null}

      {accessEditor.errorMessage !== null ? (
        <Typography.Text type="danger">
          {accessEditor.errorMessage}
        </Typography.Text>
      ) : null}

      <Space wrap>
        <Button
          type="primary"
          loading={accessEditor.isSaving}
          disabled={saveDisabled}
          onClick={onSaveAccessNow}
        >
          Сохранить сейчас
        </Button>
        <Button
          disabled={resetDisabled}
          onClick={onResetAccessDraft}
        >
          Сбросить изменения
        </Button>
      </Space>
    </Space>
  )
}
function renderOverviewTable(editor: InventoryEditor) {
  const rows: PropertyValueRow[] = [
    { key: 'id', property: 'ID инвентаря', value: editor.id },
    { key: 'version', property: 'Версия', value: String(editor.version) },
    { key: 'title', property: 'Текущее название', value: editor.settings.title },
  ]

  const columns: NonNullable<TableProps<PropertyValueRow>['columns']> = [
    {
      title: 'Параметр',
      dataIndex: 'property',
      key: 'property',
      width: 220,
    },
    {
      title: 'Значение',
      dataIndex: 'value',
      key: 'value',
    },
  ]

  return (
    <Table<PropertyValueRow>
      rowKey="key"
      columns={columns}
      dataSource={rows}
      pagination={false}
      size="small"
    />
  )
}

export function InventoryEditorShell({
  editor,
  activeTabKey,
  tabStates,
  categoryOptions,
  referencesStatus,
  referencesErrorMessage,
  retryReferences,
  concurrencyProblem,
  settingsAutosave,
  tagsAutosave,
  accessEditor,
  customIdTemplate,
  customFieldDrafts,
  selectedCustomFieldKey,
  customFieldValidationByKey,
  customFieldGlobalValidationErrors,
  customFieldsSaveStatus,
  customFieldsSaveErrorMessage,
  customFieldsLastSavedAt,
  isCustomFieldsMutating,
  deleteFlow,
  onReloadEditor,
  onClearConcurrencyProblem,
  onUpdateSettingsDraft,
  onUploadSettingsImage,
  onDeleteSettingsImageFromStorage,
  onCancelSettingsImageUpload,
  onDeleteInventory,
  onSaveSettingsNow,
  onResetSettingsDraft,
  onUpdateTagsDraft,
  onSaveTagsNow,
  onResetTagsDraft,
  onUpdateAccessDraft,
  onSaveAccessNow,
  onResetAccessDraft,
  onSelectCustomField,
  onAddCustomField,
  onUpdateCustomField,
  onRemoveSelectedCustomField,
  onMoveSelectedCustomFieldUp,
  onMoveSelectedCustomFieldDown,
  onSaveCustomFieldsNow,
  onResetCustomFieldsDrafts,
  onTabChange,
}: InventoryEditorShellProps) {
  const [odooHasActiveToken, setOdooHasActiveToken] = useState(editor.integrations.odoo.hasActiveToken)
  const [odooMaskedToken, setOdooMaskedToken] = useState<string | null>(editor.integrations.odoo.maskedToken)
  const [odooGeneratedAt, setOdooGeneratedAt] = useState<string | null>(editor.integrations.odoo.generatedAt)
  const [odooPlainToken, setOdooPlainToken] = useState<string | null>(null)
  const [odooGenerateErrorMessage, setOdooGenerateErrorMessage] = useState<string | null>(null)
  const [isOdooTokenGenerating, setIsOdooTokenGenerating] = useState(false)

  useEffect(() => {
    setOdooHasActiveToken(editor.integrations.odoo.hasActiveToken)
    setOdooMaskedToken(editor.integrations.odoo.maskedToken)
    setOdooGeneratedAt(editor.integrations.odoo.generatedAt)
    setOdooPlainToken(null)
    setOdooGenerateErrorMessage(null)
    setIsOdooTokenGenerating(false)
  }, [
    editor.id,
    editor.integrations.odoo.generatedAt,
    editor.integrations.odoo.hasActiveToken,
    editor.integrations.odoo.maskedToken,
  ])

  const onGenerateOdooToken = async () => {
    if (isOdooTokenGenerating) {
      return
    }

    setIsOdooTokenGenerating(true)
    setOdooGenerateErrorMessage(null)
    setOdooPlainToken(null)

    try {
      const tokenActionUrl = editor.integrations.odoo.tokenActionUrl ?? `/integrations/odoo/inventories/${editor.id}/token`
      const result = await generateInventoryOdooToken(tokenActionUrl)

      if (!result.ok) {
        setOdooGenerateErrorMessage(resolveOdooTokenGenerationFailureMessage(result))
        return
      }

      setOdooHasActiveToken(true)
      setOdooMaskedToken(result.data.maskedToken)
      setOdooGeneratedAt(result.data.createdAt)

      const plainToken = result.data.plainToken?.trim() ?? ''
      if (plainToken.length === 0) {
        setOdooGenerateErrorMessage('\u0422\u043e\u043a\u0435\u043d \u0441\u0433\u0435\u043d\u0435\u0440\u0438\u0440\u043e\u0432\u0430\u043d, \u043d\u043e \u0441\u0435\u0440\u0432\u0435\u0440 \u043d\u0435 \u0432\u0435\u0440\u043d\u0443\u043b \u043e\u0434\u043d\u043e\u0440\u0430\u0437\u043e\u0432\u043e\u0435 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435.')
        return
      }

      setOdooPlainToken(plainToken)
    } catch {
      setOdooGenerateErrorMessage('\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0432\u044b\u043f\u043e\u043b\u043d\u0438\u0442\u044c \u0437\u0430\u043f\u0440\u043e\u0441. \u041f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u0435 \u043f\u043e\u0437\u0436\u0435.')
    } finally {
      setIsOdooTokenGenerating(false)
    }
  }

  const onCloseOdooPlainTokenModal = () => {
    setOdooPlainToken(null)
  }

  const onCopyOdooPlainToken = async () => {
    if (odooPlainToken === null || odooPlainToken.length === 0) {
      return
    }

    if (!('clipboard' in navigator)) {
      void message.error('Буфер обмена недоступен в этом браузере.')
      return
    }

    try {
      await navigator.clipboard.writeText(odooPlainToken)
      void message.success('Токен скопирован в буфер обмена.')
    } catch {
      void message.error('Не удалось скопировать токен. Скопируйте его вручную.')
    }
  }

  const tabs = useMemo(
    () =>
      tabStates.map((tab) => ({
        key: tab.key,
        label: tab.label,
        disabled: tab.disabled,
        children:
          tab.key === 'settings'
            ? renderSettingsTab({
              editor,
              categoryOptions,
              referencesStatus,
              referencesErrorMessage,
              retryReferences,
              concurrencyProblem,
              settingsAutosave,
              odooIntegration: {
                enabled: editor.integrations.odoo.enabled,
                canViewToken: editor.integrations.odoo.canViewToken,
                canGenerateToken: editor.integrations.odoo.canGenerateToken,
                hasActiveToken: odooHasActiveToken,
                maskedToken: odooMaskedToken,
                generatedAt: odooGeneratedAt,
                plainToken: odooPlainToken,
                isGenerating: isOdooTokenGenerating,
                errorMessage: odooGenerateErrorMessage,
              },
              onReloadEditor,
              onClearConcurrencyProblem,
              onUpdateSettingsDraft,
              onUploadSettingsImage,
              onDeleteSettingsImageFromStorage,
              onCancelSettingsImageUpload,
              onGenerateOdooToken,
              onCloseOdooPlainTokenModal,
              onCopyOdooPlainToken,
              deleteFlow,
              onDeleteInventory,
              onSaveSettingsNow,
              onResetSettingsDraft,
            })
            : tab.key === 'tags'
              ? (
                <TagsAutosaveTab
                  tagsAutosave={tagsAutosave}
                  concurrencyProblem={concurrencyProblem}
                  onReloadEditor={onReloadEditor}
                  onClearConcurrencyProblem={onClearConcurrencyProblem}
                  onUpdateTagsDraft={onUpdateTagsDraft}
                  onSaveTagsNow={onSaveTagsNow}
                  onResetTagsDraft={onResetTagsDraft}
                />
              )
              : tab.key === 'access'
                ? (
                  <AccessEditorTab
                    editor={editor}
                    accessEditor={accessEditor}
                    concurrencyProblem={concurrencyProblem}
                    onReloadEditor={onReloadEditor}
                    onClearConcurrencyProblem={onClearConcurrencyProblem}
                    onUpdateAccessDraft={onUpdateAccessDraft}
                    onSaveAccessNow={onSaveAccessNow}
                    onResetAccessDraft={onResetAccessDraft}
                  />
                )
                : tab.key === 'customFields'
                  ? (
                    <CustomFieldsAutosaveTab
                      fields={customFieldDrafts}
                      selectedFieldKey={selectedCustomFieldKey}
                      validationByKey={customFieldValidationByKey}
                      globalValidationErrors={customFieldGlobalValidationErrors}
                      saveStatus={customFieldsSaveStatus}
                      saveErrorMessage={customFieldsSaveErrorMessage}
                      lastSavedAt={customFieldsLastSavedAt}
                      isMutating={isCustomFieldsMutating}
                      concurrencyProblem={concurrencyProblem}
                      onSelectField={onSelectCustomField}
                      onAddField={onAddCustomField}
                      onUpdateField={onUpdateCustomField}
                      onRemoveSelected={onRemoveSelectedCustomField}
                      onMoveSelectedUp={onMoveSelectedCustomFieldUp}
                      onMoveSelectedDown={onMoveSelectedCustomFieldDown}
                      onSaveNow={onSaveCustomFieldsNow}
                      onResetDrafts={onResetCustomFieldsDrafts}
                      onReloadEditor={onReloadEditor}
                    />
                  )
                  : (
                    <CustomIdTemplateBuilderTab
                      model={customIdTemplate}
                      onReloadEditor={onReloadEditor}
                      onCloseConcurrencyAlert={onClearConcurrencyProblem}
                    />
                  ),
      })),
    [
      accessEditor,
      categoryOptions,
      concurrencyProblem,
      customIdTemplate,
      customFieldDrafts,
      customFieldGlobalValidationErrors,
      customFieldValidationByKey,
      customFieldsLastSavedAt,
      customFieldsSaveErrorMessage,
      customFieldsSaveStatus,
      deleteFlow,
      editor,
      isCustomFieldsMutating,
      isOdooTokenGenerating,
      odooGenerateErrorMessage,
      odooGeneratedAt,
      odooHasActiveToken,
      odooMaskedToken,
      odooPlainToken,
      onAddCustomField,
      onClearConcurrencyProblem,
      onDeleteInventory,
      onMoveSelectedCustomFieldDown,
      onMoveSelectedCustomFieldUp,
      onRemoveSelectedCustomField,
      onReloadEditor,
      onSaveCustomFieldsNow,
      onResetCustomFieldsDrafts,
      onCancelSettingsImageUpload,
      onCloseOdooPlainTokenModal,
      onCopyOdooPlainToken,
      onDeleteSettingsImageFromStorage,
      onGenerateOdooToken,
      onResetAccessDraft,
      onResetSettingsDraft,
      onSaveSettingsNow,
      onSaveAccessNow,
      onResetTagsDraft,
      onSaveTagsNow,
      onSelectCustomField,
      onUpdateCustomField,
      onUploadSettingsImage,
      onUpdateSettingsDraft,
      onUpdateAccessDraft,
      onUpdateTagsDraft,
      referencesErrorMessage,
      referencesStatus,
      retryReferences,
      selectedCustomFieldKey,
      settingsAutosave,
      tagsAutosave,
      tabStates,
    ],
  )

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 0 }}>
            Редактор: {editor.settings.title}
          </Typography.Title>
          {renderOverviewTable(editor)}
        </Space>
      </Card>

      <Card>
        <Tabs
          activeKey={activeTabKey}
          onChange={(nextTabKey) => {
            if (isInventoryEditorTabKey(nextTabKey)) {
              onTabChange(nextTabKey)
            }
          }}
          items={tabs}
        />
      </Card>
    </Space>
  )
}
