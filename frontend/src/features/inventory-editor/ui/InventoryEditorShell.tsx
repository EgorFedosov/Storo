import { DeleteOutlined, UploadOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Empty, Input, Popconfirm, Progress, Select, Space, Table, Tabs, Tag, Typography, Upload } from 'antd'
import type { TableProps } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { inventoryEditorTagsContract } from '../../../entities/inventory/model/inventoryEditorApi.ts'
import type { ConcurrencyProblem } from '../../../shared/api/concurrency.ts'
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
  onSelectCustomField: (fieldKey: string | null) => void
  onAddCustomField: () => void
  onUpdateCustomField: (
    fieldKey: string,
    patch: Partial<Pick<InventoryEditorCustomFieldDraft, 'fieldType' | 'title' | 'description' | 'showInTable'>>,
  ) => void
  onRemoveSelectedCustomField: () => void
  onMoveSelectedCustomFieldUp: () => void
  onMoveSelectedCustomFieldDown: () => void
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

  return <Tag color="default">Нет локальных изменений</Tag>
}

function renderSettingsTab({
  editor,
  categoryOptions,
  referencesStatus,
  referencesErrorMessage,
  retryReferences,
  concurrencyProblem,
  settingsAutosave,
  onReloadEditor,
  onClearConcurrencyProblem,
  onUpdateSettingsDraft,
  onUploadSettingsImage,
  onDeleteSettingsImageFromStorage,
  onCancelSettingsImageUpload,
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
  onReloadEditor: () => void
  onClearConcurrencyProblem: () => void
  onUpdateSettingsDraft: (patch: Partial<InventoryEditorSettingsDraft>) => void
  onUploadSettingsImage: (file: File) => Promise<boolean>
  onDeleteSettingsImageFromStorage: () => Promise<boolean>
  onCancelSettingsImageUpload: () => void
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
        <Typography.Text strong>Описание (Markdown)</Typography.Text>
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

function renderAccessTab(editor: InventoryEditor) {
  const rows: WriterRow[] = editor.access.writers.map((writer) => ({
    key: writer.id,
    id: writer.id,
    displayName: writer.displayName,
    userName: writer.userName,
    email: writer.email,
    isBlocked: writer.isBlocked,
  }))

  const columns: NonNullable<TableProps<WriterRow>['columns']> = [
    {
      title: 'Отображаемое имя',
      dataIndex: 'displayName',
      key: 'displayName',
    },
    {
      title: 'Имя пользователя',
      dataIndex: 'userName',
      key: 'userName',
      width: 220,
      render: (value: string) => `@${value}`,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 280,
    },
    {
      title: 'Статус',
      dataIndex: 'isBlocked',
      key: 'isBlocked',
      width: 120,
      render: (isBlocked: boolean) => (
        <Tag color={isBlocked ? 'red' : 'green'}>
          {isBlocked ? 'Заблокирован' : 'Активен'}
        </Tag>
      ),
    },
  ]

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Typography.Text>
        Режим доступа:{' '}
        <Tag color={editor.access.mode === 'public' ? 'green' : 'gold'}>
          {editor.access.mode === 'public' ? 'Публичный' : 'Ограниченный'}
        </Tag>
      </Typography.Text>

      <Table<WriterRow>
        rowKey="key"
        columns={columns}
        dataSource={rows}
        pagination={false}
        size="middle"
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Явные пользователи с правом записи не настроены."
            />
          ),
        }}
      />
    </Space>
  )
}

function renderOverviewTable(editor: InventoryEditor, etag: string | null) {
  const rows: PropertyValueRow[] = [
    { key: 'id', property: 'ID инвентаря', value: editor.id },
    { key: 'version', property: 'Версия', value: String(editor.version) },
    { key: 'etag', property: 'ETag', value: etag ?? '(missing)' },
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
  etag,
  activeTabKey,
  tabStates,
  categoryOptions,
  referencesStatus,
  referencesErrorMessage,
  retryReferences,
  concurrencyProblem,
  settingsAutosave,
  tagsAutosave,
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
  onSelectCustomField,
  onAddCustomField,
  onUpdateCustomField,
  onRemoveSelectedCustomField,
  onMoveSelectedCustomFieldUp,
  onMoveSelectedCustomFieldDown,
  onResetCustomFieldsDrafts,
  onTabChange,
}: InventoryEditorShellProps) {
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
              onReloadEditor,
              onClearConcurrencyProblem,
              onUpdateSettingsDraft,
              onUploadSettingsImage,
              onDeleteSettingsImageFromStorage,
              onCancelSettingsImageUpload,
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
                ? renderAccessTab(editor)
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
      onAddCustomField,
      onClearConcurrencyProblem,
      onDeleteInventory,
      onMoveSelectedCustomFieldDown,
      onMoveSelectedCustomFieldUp,
      onRemoveSelectedCustomField,
      onReloadEditor,
      onResetCustomFieldsDrafts,
      onCancelSettingsImageUpload,
      onDeleteSettingsImageFromStorage,
      onResetSettingsDraft,
      onSaveSettingsNow,
      onResetTagsDraft,
      onSaveTagsNow,
      onSelectCustomField,
      onUpdateCustomField,
      onUploadSettingsImage,
      onUpdateSettingsDraft,
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
          {renderOverviewTable(editor, etag)}
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
