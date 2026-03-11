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
    return <Tag color="processing">РЎРѕС…СЂР°РЅРµРЅРёРµ...</Tag>
  }

  if (state.isQueued) {
    return <Tag color="gold">РР·РјРµРЅРµРЅРёСЏ РІ РѕС‡РµСЂРµРґРё</Tag>
  }

  if (state.isDirty) {
    return <Tag color="orange">Р•СЃС‚СЊ РЅРµСЃРѕС…СЂР°РЅРµРЅРЅС‹Рµ РёР·РјРµРЅРµРЅРёСЏ</Tag>
  }

  if (state.lastSavedAt !== null) {
    const timestamp = new Date(state.lastSavedAt)
    const savedLabel = Number.isNaN(timestamp.valueOf())
      ? 'РЎРѕС…СЂР°РЅРµРЅРѕ'
      : `РЎРѕС…СЂР°РЅРµРЅРѕ ${timestamp.toLocaleTimeString()}`
    return <Tag color="green">{savedLabel}</Tag>
  }

  return <Tag color="default">РќРµС‚ Р»РѕРєР°Р»СЊРЅС‹С… РёР·РјРµРЅРµРЅРёР№</Tag>
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
        description="Р§РµСЂРЅРѕРІРёРє РЅР°СЃС‚СЂРѕРµРє РЅРµ РёРЅРёС†РёР°Р»РёР·РёСЂРѕРІР°РЅ."
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
          message="РЎРїСЂР°РІРѕС‡РЅРёРє РєР°С‚РµРіРѕСЂРёР№ РЅРµРґРѕСЃС‚СѓРїРµРЅ"
          description={referencesErrorMessage ?? 'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ /categories.'}
          action={(
            <Button size="small" onClick={retryReferences}>
              РџРѕРІС‚РѕСЂРёС‚СЊ
            </Button>
          )}
        />
      ) : null}

      {settingsAutosave.errorMessage !== null ? (
        <Alert
          showIcon
          type="error"
          message="РЎР±РѕР№ Р°РІС‚РѕСЃРѕС…СЂР°РЅРµРЅРёСЏ РЅР°СЃС‚СЂРѕРµРє"
          description={settingsAutosave.errorMessage}
        />
      ) : null}

      <Space size={8} wrap>
        {renderAutosaveBadge(settingsAutosave)}
        <Tag>РђРІС‚РѕСЃРѕС…СЂР°РЅРµРЅРёРµ: {String(Math.floor(settingsAutosave.autosaveIntervalMs / 1000))}s</Tag>
        <Tag>РР·РјРµРЅРµРЅРЅС‹С… РїРѕР»РµР№: {settingsAutosave.dirtyFields.length}</Tag>
      </Space>

      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <Typography.Text strong>РќР°Р·РІР°РЅРёРµ</Typography.Text>
        <Input
          value={draft.title}
          maxLength={200}
          status={titleError !== null ? 'error' : undefined}
          onChange={(event) => {
            onUpdateSettingsDraft({ title: event.target.value })
          }}
          disabled={!settingsAutosave.canAutosave || settingsAutosave.isSaving}
          placeholder="РќР°Р·РІР°РЅРёРµ РёРЅРІРµРЅС‚Р°СЂСЏ"
          autoComplete="off"
        />
        {titleError !== null ? <Typography.Text type="danger">{titleError}</Typography.Text> : null}
      </Space>

      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <Typography.Text strong>РљР°С‚РµРіРѕСЂРёСЏ</Typography.Text>
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
          placeholder="Р’С‹Р±РµСЂРёС‚Рµ РєР°С‚РµРіРѕСЂРёСЋ"
        />
        {categoryError !== null ? <Typography.Text type="danger">{categoryError}</Typography.Text> : null}
      </Space>

      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <Typography.Text strong>РћРїРёСЃР°РЅРёРµ (Markdown)</Typography.Text>
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
          placeholder="РћРїРёСЃР°РЅРёРµ РёРЅРІРµРЅС‚Р°СЂСЏ"
        />
        {descriptionError !== null ? <Typography.Text type="danger">{descriptionError}</Typography.Text> : null}
      </Space>

      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <Typography.Text strong>URL РёР·РѕР±СЂР°Р¶РµРЅРёСЏ</Typography.Text>
        <Input
          value={draft.imageUrl}
          maxLength={2_048}
          status={imageUrlError !== null ? 'error' : undefined}
          onChange={(event) => {
            onUpdateSettingsDraft({ imageUrl: event.target.value })
          }}
          disabled={!settingsAutosave.canAutosave || settingsAutosave.isSaving}
          placeholder="https://cdn.example.com/inventory.jpg"
          autoComplete="off"
        />
        {imageUrlError !== null ? <Typography.Text type="danger">{imageUrlError}</Typography.Text> : null}
      </Space>

      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <Typography.Text strong>Р—Р°РіСЂСѓР·РєР° РёР·РѕР±СЂР°Р¶РµРЅРёСЏ</Typography.Text>
        <Space wrap>
          <Upload
            accept=".jpg,.jpeg,.png,.webp,.gif,.bmp,.pdf,image/jpeg,image/png,image/webp,image/gif,image/bmp,application/pdf"
            maxCount={1}
            showUploadList={false}
            disabled={uploadDisabled}
            customRequest={async (requestOptions) => {
              const { file, onError, onSuccess } = requestOptions
              if (!(file instanceof File)) {
                onError?.(new Error('Р’С‹Р±СЂР°РЅРЅС‹Р№ С„Р°Р№Р» Р·Р°РіСЂСѓР·РєРё РёРјРµРµС‚ РЅРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ С„РѕСЂРјР°С‚.'))
                return
              }

              const uploadCompleted = await onUploadSettingsImage(file)
              if (uploadCompleted) {
                onSuccess?.({})
                return
              }

              onError?.(new Error('Р—Р°РіСЂСѓР·РєР° РёР·РѕР±СЂР°Р¶РµРЅРёСЏ РЅРµ Р±С‹Р»Р° Р·Р°РІРµСЂС€РµРЅР°.'))
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
              РћС‚РјРµРЅРёС‚СЊ Р·Р°РіСЂСѓР·РєСѓ
            </Button>
          ) : null}
        </Space>

        <Space size={8} wrap>
          {imageUpload.fileName !== null ? <Tag>{imageUpload.fileName}</Tag> : null}
          {imageUpload.status === 'uploading' ? <Tag color="processing">Р—Р°РіСЂСѓР·РєР° РІ С…СЂР°РЅРёР»РёС‰Рµ</Tag> : null}
          {imageUpload.status === 'deleting' ? <Tag color="processing">Удаление из хранилища</Tag> : null}
          {imageUpload.status === 'success' ? <Tag color="green">Р—Р°РіСЂСѓР·РєР° Р·Р°РІРµСЂС€РµРЅР°</Tag> : null}
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
          <Typography.Text type="secondary">Предпросмотр текущего изображения</Typography.Text>
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
          РЎРѕС…СЂР°РЅРёС‚СЊ СЃРµР№С‡Р°СЃ
        </Button>
        <Button onClick={onResetSettingsDraft} disabled={resetDisabled}>
          РЎР±СЂРѕСЃРёС‚СЊ РёР·РјРµРЅРµРЅРёСЏ
        </Button>
      </Space>

      <Card size="small" title="РћРїР°СЃРЅР°СЏ Р·РѕРЅР°">
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <Typography.Text type="danger">
            РЈРґР°Р»РµРЅРёРµ СЌС‚РѕРіРѕ РёРЅРІРµРЅС‚Р°СЂСЏ РЅРµРѕР±СЂР°С‚РёРјРѕ Рё СѓРґР°Р»СЏРµС‚ СЃРІСЏР·Р°РЅРЅС‹Рµ СЌР»РµРјРµРЅС‚С‹, РїСЂР°РІРёР»Р° РґРѕСЃС‚СѓРїР°, С‚РµРіРё Рё РѕР±СЃСѓР¶РґРµРЅРёСЏ.
          </Typography.Text>

          {deleteFlow.errorMessage !== null ? (
            <Alert
              showIcon
              type="error"
              message="РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ РёРЅРІРµРЅС‚Р°СЂСЊ"
              description={deleteFlow.errorMessage}
            />
          ) : null}

          <Popconfirm
            title="РЈРґР°Р»РёС‚СЊ РёРЅРІРµРЅС‚Р°СЂСЊ Р±РµР·РІРѕР·РІСЂР°С‚РЅРѕ?"
            description={`Inventory #${editor.id} Р±СѓРґРµС‚ СѓРґР°Р»РµРЅ Р±РµР· РІРѕР·РјРѕР¶РЅРѕСЃС‚Рё РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ.`}
            okText="РЈРґР°Р»РёС‚СЊ РёРЅРІРµРЅС‚Р°СЂСЊ"
            cancelText="РћС‚РјРµРЅР°"
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
              РЈРґР°Р»РёС‚СЊ РёРЅРІРµРЅС‚Р°СЂСЊ
            </Button>
          </Popconfirm>

          <Typography.Text type="secondary">
            РЈРґР°Р»РµРЅРёРµ РІС‹РїРѕР»РЅСЏРµС‚СЃСЏ С‡РµСЂРµР· `DELETE /api/v1/inventories/{editor.id}` СЃ `If-Match`.
          </Typography.Text>
        </Space>
      </Card>

      <Typography.Text type="secondary">
        РќР°СЃС‚СЂРѕР№РєРё СЃРѕС…СЂР°РЅСЏСЋС‚СЃСЏ С‡РµСЂРµР· `PUT /api/v1/inventories/{editor.id}/settings` СЃ `If-Match`.
      </Typography.Text>
    </Space>
  )
}

function TagsAutosaveTab({
  editor,
  tagsAutosave,
  concurrencyProblem,
  onReloadEditor,
  onClearConcurrencyProblem,
  onUpdateTagsDraft,
  onSaveTagsNow,
  onResetTagsDraft,
}: {
  editor: InventoryEditor
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
          message="РЎР±РѕР№ Р°РІС‚РѕСЃРѕС…СЂР°РЅРµРЅРёСЏ С‚РµРіРѕРІ"
          description={tagsAutosave.errorMessage}
        />
      ) : null}

      {autocompleteErrorMessage !== null ? (
        <Alert
          showIcon
          type="warning"
          message="РћС€РёР±РєР° Р·Р°РїСЂРѕСЃР° Р°РІС‚РѕРґРѕРїРѕР»РЅРµРЅРёСЏ С‚РµРіРѕРІ"
          description={autocompleteErrorMessage}
        />
      ) : null}

      <Space size={8} wrap>
        {renderAutosaveBadge(tagsAutosave)}
        <Tag>РђРІС‚РѕСЃРѕС…СЂР°РЅРµРЅРёРµ: {String(Math.floor(tagsAutosave.autosaveIntervalMs / 1000))}s</Tag>
        <Tag>РўРµРіРё: {tagsAutosave.draft.length}</Tag>
      </Space>

      <Select<string[]>
        mode="tags"
        value={[...tagsAutosave.draft]}
        options={options}
        tokenSeparators={[',']}
        maxTagCount="responsive"
        maxTagTextLength={inventoryEditorTagsContract.maxTagLength}
        placeholder="Р”РѕР±Р°РІСЊС‚Рµ С‚РµРіРё"
        disabled={!tagsAutosave.canAutosave || tagsAutosave.isSaving}
        status={tagsError !== null ? 'error' : undefined}
        notFoundContent={autocompleteStatus === 'loading' ? 'Р—Р°РіСЂСѓР·РєР°...' : undefined}
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
          Р’РІРµРґРёС‚Рµ РјРёРЅРёРјСѓРј {String(tagAutocompleteContract.minPrefixLength)} СЃРёРјРІРѕР»Р°(РѕРІ), С‡С‚РѕР±С‹ РїРѕР»СѓС‡РёС‚СЊ РїРѕРґСЃРєР°Р·РєРё.
        </Typography.Text>
      ) : null}

      {tagsError !== null ? (
        <Typography.Text type="danger">
          {tagsError}
        </Typography.Text>
      ) : null}

      <Space wrap>
        <Button type="primary" onClick={onSaveTagsNow} loading={tagsAutosave.isSaving} disabled={saveDisabled}>
          РЎРѕС…СЂР°РЅРёС‚СЊ СЃРµР№С‡Р°СЃ
        </Button>
        <Button onClick={onResetTagsDraft} disabled={resetDisabled}>
          РЎР±СЂРѕСЃРёС‚СЊ РёР·РјРµРЅРµРЅРёСЏ
        </Button>
      </Space>

      <Typography.Text type="secondary">
        РўРµРіРё СЃРѕС…СЂР°РЅСЏСЋС‚СЃСЏ С‡РµСЂРµР· `PUT /api/v1/inventories/{editor.id}/tags` СЃ `If-Match`.
      </Typography.Text>
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
      title: 'РћС‚РѕР±СЂР°Р¶Р°РµРјРѕРµ РёРјСЏ',
      dataIndex: 'displayName',
      key: 'displayName',
    },
    {
      title: 'РРјСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ',
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
      title: 'РЎС‚Р°С‚СѓСЃ',
      dataIndex: 'isBlocked',
      key: 'isBlocked',
      width: 120,
      render: (isBlocked: boolean) => (
        <Tag color={isBlocked ? 'red' : 'green'}>
          {isBlocked ? 'Р—Р°Р±Р»РѕРєРёСЂРѕРІР°РЅ' : 'РђРєС‚РёРІРµРЅ'}
        </Tag>
      ),
    },
  ]

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Typography.Text>
        Р РµР¶РёРј РґРѕСЃС‚СѓРїР°:{' '}
        <Tag color={editor.access.mode === 'public' ? 'green' : 'gold'}>
          {editor.access.mode === 'public' ? 'РџСѓР±Р»РёС‡РЅС‹Р№' : 'РћРіСЂР°РЅРёС‡РµРЅРЅС‹Р№'}
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
              description="РЇРІРЅС‹Рµ РїРѕР»СЊР·РѕРІР°С‚РµР»Рё СЃ РїСЂР°РІРѕРј Р·Р°РїРёСЃРё РЅРµ РЅР°СЃС‚СЂРѕРµРЅС‹."
            />
          ),
        }}
      />
    </Space>
  )
}

function renderOverviewTable(editor: InventoryEditor, etag: string | null) {
  const rows: PropertyValueRow[] = [
    { key: 'id', property: 'ID РёРЅРІРµРЅС‚Р°СЂСЏ', value: editor.id },
    { key: 'version', property: 'Р’РµСЂСЃРёСЏ', value: String(editor.version) },
    { key: 'etag', property: 'ETag', value: etag ?? '(missing)' },
    { key: 'title', property: 'РўРµРєСѓС‰РµРµ РЅР°Р·РІР°РЅРёРµ', value: editor.settings.title },
  ]

  const columns: NonNullable<TableProps<PropertyValueRow>['columns']> = [
    {
      title: 'РџР°СЂР°РјРµС‚СЂ',
      dataIndex: 'property',
      key: 'property',
      width: 220,
    },
    {
      title: 'Р—РЅР°С‡РµРЅРёРµ',
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
                  editor={editor}
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
            Р РµРґР°РєС‚РѕСЂ: {editor.settings.title}
          </Typography.Title>
          {renderOverviewTable(editor, etag)}
          <Typography.Text type="secondary">
            Р’РєР»Р°РґРєРё РЅР°СЃС‚СЂРѕРµРє, С‚РµРіРѕРІ Рё РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРёС… РїРѕР»РµР№ РёСЃРїРѕР»СЊР·СѓСЋС‚ Р°РІС‚РѕСЃРѕС…СЂР°РЅРµРЅРёРµ СЃ РѕРїС‚РёРјРёСЃС‚РёС‡РµСЃРєРѕР№ Р±Р»РѕРєРёСЂРѕРІРєРѕР№ `If-Match`.
          </Typography.Text>
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




