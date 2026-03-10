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
    return <Tag color="processing">Saving...</Tag>
  }

  if (state.isQueued) {
    return <Tag color="gold">Changes queued</Tag>
  }

  if (state.isDirty) {
    return <Tag color="orange">Unsaved changes</Tag>
  }

  if (state.lastSavedAt !== null) {
    const timestamp = new Date(state.lastSavedAt)
    const savedLabel = Number.isNaN(timestamp.valueOf())
      ? 'Saved'
      : `Saved ${timestamp.toLocaleTimeString()}`
    return <Tag color="green">{savedLabel}</Tag>
  }

  return <Tag color="default">No local changes</Tag>
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
        description="Settings draft is not initialized."
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
  const isImageUploading = imageUpload.status === 'requesting_presign' || imageUpload.status === 'uploading'
  const uploadDisabled = !settingsAutosave.canAutosave || settingsAutosave.isSaving || isImageUploading
  const deleteDisabled = !settingsAutosave.canAutosave || settingsAutosave.isSaving || deleteFlow.isDeleting
  const normalizedImageUrl = draft.imageUrl.trim()
  const canShowImagePreview = normalizedImageUrl.length > 0 && imageUrlError === null

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
          message="Categories reference is unavailable"
          description={referencesErrorMessage ?? 'Failed to load /categories.'}
          action={(
            <Button size="small" onClick={retryReferences}>
              Retry
            </Button>
          )}
        />
      ) : null}

      {settingsAutosave.errorMessage !== null ? (
        <Alert
          showIcon
          type="error"
          message="Settings autosave failed"
          description={settingsAutosave.errorMessage}
        />
      ) : null}

      <Space size={8} wrap>
        {renderAutosaveBadge(settingsAutosave)}
        <Tag>Autosave: {String(Math.floor(settingsAutosave.autosaveIntervalMs / 1000))}s</Tag>
        <Tag>Dirty fields: {settingsAutosave.dirtyFields.length}</Tag>
      </Space>

      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <Typography.Text strong>Title</Typography.Text>
        <Input
          value={draft.title}
          maxLength={200}
          status={titleError !== null ? 'error' : undefined}
          onChange={(event) => {
            onUpdateSettingsDraft({ title: event.target.value })
          }}
          disabled={!settingsAutosave.canAutosave || settingsAutosave.isSaving}
          placeholder="Inventory title"
          autoComplete="off"
        />
        {titleError !== null ? <Typography.Text type="danger">{titleError}</Typography.Text> : null}
      </Space>

      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <Typography.Text strong>Category</Typography.Text>
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
          placeholder="Select category"
        />
        {categoryError !== null ? <Typography.Text type="danger">{categoryError}</Typography.Text> : null}
      </Space>

      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <Typography.Text strong>Description (Markdown)</Typography.Text>
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
          placeholder="Inventory description"
        />
        {descriptionError !== null ? <Typography.Text type="danger">{descriptionError}</Typography.Text> : null}
      </Space>

      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <Typography.Text strong>Image URL</Typography.Text>
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
        <Typography.Text strong>Upload Image</Typography.Text>
        <Space wrap>
          <Upload
            accept="image/*"
            maxCount={1}
            showUploadList={false}
            disabled={uploadDisabled}
            customRequest={async (requestOptions) => {
              const { file, onError, onSuccess } = requestOptions
              if (!(file instanceof File)) {
                onError?.(new Error('Selected upload payload is not a file.'))
                return
              }

              const uploadCompleted = await onUploadSettingsImage(file)
              if (uploadCompleted) {
                onSuccess?.({})
                return
              }

              onError?.(new Error('Image upload was not completed.'))
            }}
          >
            <Button icon={<UploadOutlined />} loading={isImageUploading} disabled={uploadDisabled}>
              {isImageUploading ? 'Uploading image...' : 'Upload image from device'}
            </Button>
          </Upload>
          {isImageUploading ? (
            <Button onClick={onCancelSettingsImageUpload}>
              Cancel upload
            </Button>
          ) : null}
        </Space>

        <Space size={8} wrap>
          {imageUpload.fileName !== null ? <Tag>{imageUpload.fileName}</Tag> : null}
          {imageUpload.status === 'requesting_presign' ? <Tag color="processing">Preparing upload contract</Tag> : null}
          {imageUpload.status === 'uploading' ? <Tag color="processing">Uploading to storage</Tag> : null}
          {imageUpload.status === 'success' ? <Tag color="green">Upload completed</Tag> : null}
        </Space>

        {isImageUploading || imageUpload.status === 'success' ? (
          <Progress percent={imageUpload.progressPercent ?? 0} size="small" />
        ) : null}

        {imageUpload.errorMessage !== null ? (
          <Alert
            showIcon
            type="error"
            message="Image upload failed"
            description={imageUpload.errorMessage}
          />
        ) : null}

        {imageUpload.status === 'success' && imageUpload.uploadedPublicUrl !== null ? (
          <Typography.Text type="secondary">
            Uploaded image URL was applied to settings and queued for autosave.
          </Typography.Text>
        ) : null}
      </Space>

      {canShowImagePreview ? (
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Typography.Text type="secondary">
            Current image preview
          </Typography.Text>
          <img
            src={normalizedImageUrl}
            alt="Inventory illustration preview"
            style={{ maxWidth: 320, width: '100%', borderRadius: 8, objectFit: 'cover' }}
          />
        </Space>
      ) : null}

      <Space wrap>
        <Button type="primary" onClick={onSaveSettingsNow} loading={settingsAutosave.isSaving} disabled={saveDisabled}>
          Save now
        </Button>
        <Button onClick={onResetSettingsDraft} disabled={resetDisabled}>
          Reset changes
        </Button>
      </Space>

      <Card size="small" title="Danger Zone">
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <Typography.Text type="danger">
            Deleting this inventory is permanent and removes related items, access rules, tags, and discussions.
          </Typography.Text>

          {deleteFlow.errorMessage !== null ? (
            <Alert
              showIcon
              type="error"
              message="Inventory deletion failed"
              description={deleteFlow.errorMessage}
            />
          ) : null}

          <Popconfirm
            title="Delete inventory permanently?"
            description={`Inventory #${editor.id} will be removed and cannot be restored.`}
            okText="Delete inventory"
            cancelText="Cancel"
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
              Delete inventory
            </Button>
          </Popconfirm>

          <Typography.Text type="secondary">
            Deletion uses `DELETE /api/v1/inventories/{editor.id}` with `If-Match`.
          </Typography.Text>
        </Space>
      </Card>

      <Typography.Text type="secondary">
        Settings are saved via `PUT /api/v1/inventories/{editor.id}/settings` with `If-Match`.
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
          message="Tags autosave failed"
          description={tagsAutosave.errorMessage}
        />
      ) : null}

      {autocompleteErrorMessage !== null ? (
        <Alert
          showIcon
          type="warning"
          message="Tag autocomplete request failed"
          description={autocompleteErrorMessage}
        />
      ) : null}

      <Space size={8} wrap>
        {renderAutosaveBadge(tagsAutosave)}
        <Tag>Autosave: {String(Math.floor(tagsAutosave.autosaveIntervalMs / 1000))}s</Tag>
        <Tag>Tags: {tagsAutosave.draft.length}</Tag>
      </Space>

      <Select<string[]>
        mode="tags"
        value={[...tagsAutosave.draft]}
        options={options}
        tokenSeparators={[',']}
        maxTagCount="responsive"
        maxTagTextLength={inventoryEditorTagsContract.maxTagLength}
        placeholder="Add tags"
        disabled={!tagsAutosave.canAutosave || tagsAutosave.isSaving}
        status={tagsError !== null ? 'error' : undefined}
        notFoundContent={autocompleteStatus === 'loading' ? 'Loading...' : undefined}
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
          Type at least {String(tagAutocompleteContract.minPrefixLength)} characters to get suggestions.
        </Typography.Text>
      ) : null}

      {tagsError !== null ? (
        <Typography.Text type="danger">
          {tagsError}
        </Typography.Text>
      ) : null}

      <Space wrap>
        <Button type="primary" onClick={onSaveTagsNow} loading={tagsAutosave.isSaving} disabled={saveDisabled}>
          Save now
        </Button>
        <Button onClick={onResetTagsDraft} disabled={resetDisabled}>
          Reset changes
        </Button>
      </Space>

      <Typography.Text type="secondary">
        Tags are saved via `PUT /api/v1/inventories/{editor.id}/tags` with `If-Match`.
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
      title: 'Display Name',
      dataIndex: 'displayName',
      key: 'displayName',
    },
    {
      title: 'User Name',
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
      title: 'Status',
      dataIndex: 'isBlocked',
      key: 'isBlocked',
      width: 120,
      render: (isBlocked: boolean) => (
        <Tag color={isBlocked ? 'red' : 'green'}>
          {isBlocked ? 'Blocked' : 'Active'}
        </Tag>
      ),
    },
  ]

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Typography.Text>
        Access mode:{' '}
        <Tag color={editor.access.mode === 'public' ? 'green' : 'gold'}>
          {editor.access.mode === 'public' ? 'Public' : 'Restricted'}
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
              description="No explicit writers configured."
            />
          ),
        }}
      />
    </Space>
  )
}

function renderOverviewTable(editor: InventoryEditor, etag: string | null) {
  const rows: PropertyValueRow[] = [
    { key: 'id', property: 'Inventory ID', value: editor.id },
    { key: 'version', property: 'Version', value: String(editor.version) },
    { key: 'etag', property: 'ETag', value: etag ?? '(missing)' },
    { key: 'title', property: 'Current title', value: editor.settings.title },
  ]

  const columns: NonNullable<TableProps<PropertyValueRow>['columns']> = [
    {
      title: 'Property',
      dataIndex: 'property',
      key: 'property',
      width: 220,
    },
    {
      title: 'Value',
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
            {editor.settings.title} Editor
          </Typography.Title>
          {renderOverviewTable(editor, etag)}
          <Typography.Text type="secondary">
            Settings, tags, and custom fields tabs use autosave with `If-Match` optimistic locking.
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
