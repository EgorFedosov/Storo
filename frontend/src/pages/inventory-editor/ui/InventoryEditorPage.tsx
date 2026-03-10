import { ReloadOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Result, Space, Spin, Typography } from 'antd'
import { useMemo } from 'react'
import { useInventoryEditorModel } from '../../../features/inventory-editor/model/useInventoryEditorModel.ts'
import { InventoryEditorShell } from '../../../features/inventory-editor/ui/InventoryEditorShell.tsx'
import { navigate, useLocationSnapshot } from '../../../shared/lib/router/navigation.ts'

function parseInventoryIdFromEditorPath(pathname: string): string | null {
  const normalizedPath = pathname.trim().replace(/\/+$/, '')
  const match = /^\/inventor(?:y|ies)\/([1-9]\d*)\/edit$/i.exec(normalizedPath)
  if (match === null) {
    return null
  }

  return match[1]
}

export function InventoryEditorPage() {
  const locationSnapshot = useLocationSnapshot()
  const inventoryId = useMemo(
    () => parseInventoryIdFromEditorPath(locationSnapshot.pathname),
    [locationSnapshot.pathname],
  )
  const {
    status,
    editor,
    etag,
    errorMessage,
    errorStatus,
    tabStates,
    activeTabKey,
    setActiveTabKey,
    categoryOptions,
    referencesStatus,
    referencesErrorMessage,
    retryReferences,
    concurrencyProblem,
    clearConcurrencyProblem,
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
    updateSettingsDraft,
    uploadSettingsImage,
    cancelSettingsImageUpload,
    deleteInventory,
    saveSettingsNow,
    resetSettingsDraft,
    updateTagsDraft,
    saveTagsNow,
    resetTagsDraft,
    setSelectedCustomFieldKey,
    addCustomFieldDraft,
    updateCustomFieldDraft,
    removeSelectedCustomFieldDraft,
    moveSelectedCustomFieldDraftUp,
    moveSelectedCustomFieldDraftDown,
    resetCustomFieldDrafts,
    retryLoad,
  } = useInventoryEditorModel(inventoryId)

  if (status === 'loading' || status === 'idle') {
    return (
      <Card>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 0 }}>
            Редактор инвентаря
          </Typography.Title>
          <Typography.Text type="secondary">
            Загружается агрегат редактора и модель вкладок...
          </Typography.Text>
          <div className="inventory-details-loader" role="status" aria-live="polite">
            <Spin size="large" />
          </div>
        </Space>
      </Card>
    )
  }

  if (status === 'error') {
    if (errorStatus === 401) {
      return (
        <Result
          status="403"
          title="Требуется вход"
          subTitle="Редактор инвентаря доступен только авторизованным пользователям."
          extra={(
            <Space wrap>
              <Button type="primary" icon={<ReloadOutlined />} onClick={retryLoad}>
                Повторить
              </Button>
              <Button onClick={() => navigate('/home')}>
                На главную
              </Button>
            </Space>
          )}
        />
      )
    }

    if (errorStatus === 403) {
      return (
        <Result
          status="403"
          title="Доступ к редактору запрещен"
          subTitle="Открывать редактор может только создатель инвентаря или администратор."
          extra={(
            <Space wrap>
              <Button type="primary" icon={<ReloadOutlined />} onClick={retryLoad}>
                Повторить
              </Button>
              <Button onClick={() => navigate(`/inventories/${inventoryId ?? ''}`)}>
                Открыть страницу инвентаря
              </Button>
            </Space>
          )}
        />
      )
    }

    if (errorStatus === 404) {
      return (
        <Result
          status="404"
          title="Редактор инвентаря не найден"
          subTitle="Запрошенный инвентарь не существует или был удален."
          extra={(
            <Space wrap>
              <Button type="primary" icon={<ReloadOutlined />} onClick={retryLoad}>
                Повторить
              </Button>
              <Button onClick={() => navigate('/home')}>
                На главную
              </Button>
            </Space>
          )}
        />
      )
    }

    return (
      <Alert
        showIcon
        type="error"
        message="Не удалось загрузить редактор инвентаря"
        description={errorMessage ?? 'Ошибка запроса редактора инвентаря.'}
        action={(
          <Button type="primary" size="small" icon={<ReloadOutlined />} onClick={retryLoad}>
            Повторить
          </Button>
        )}
      />
    )
  }

  if (editor === null) {
    return (
      <Result
        status="error"
        title="Редактор инвентаря недоступен"
        subTitle="API вернул неожиданный ответ."
        extra={(
          <Button type="primary" icon={<ReloadOutlined />} onClick={retryLoad}>
            Повторить
          </Button>
        )}
      />
    )
  }

  return (
    <InventoryEditorShell
      editor={editor}
      etag={etag}
      activeTabKey={activeTabKey}
      tabStates={tabStates}
      categoryOptions={categoryOptions}
      referencesStatus={referencesStatus}
      referencesErrorMessage={referencesErrorMessage}
      retryReferences={retryReferences}
      concurrencyProblem={concurrencyProblem}
      settingsAutosave={settingsAutosave}
      tagsAutosave={tagsAutosave}
      customIdTemplate={customIdTemplate}
      customFieldDrafts={customFieldDrafts}
      selectedCustomFieldKey={selectedCustomFieldKey}
      customFieldValidationByKey={customFieldValidationByKey}
      customFieldGlobalValidationErrors={customFieldGlobalValidationErrors}
      customFieldsSaveStatus={customFieldsSaveStatus}
      customFieldsSaveErrorMessage={customFieldsSaveErrorMessage}
      customFieldsLastSavedAt={customFieldsLastSavedAt}
      isCustomFieldsMutating={isCustomFieldsMutating}
      deleteFlow={deleteFlow}
      onReloadEditor={retryLoad}
      onClearConcurrencyProblem={clearConcurrencyProblem}
      onUpdateSettingsDraft={updateSettingsDraft}
      onUploadSettingsImage={uploadSettingsImage}
      onCancelSettingsImageUpload={cancelSettingsImageUpload}
      onDeleteInventory={async () => {
        const deleted = await deleteInventory()
        if (deleted) {
          navigate('/my/inventories')
        }
      }}
      onSaveSettingsNow={saveSettingsNow}
      onResetSettingsDraft={resetSettingsDraft}
      onUpdateTagsDraft={updateTagsDraft}
      onSaveTagsNow={saveTagsNow}
      onResetTagsDraft={resetTagsDraft}
      onSelectCustomField={setSelectedCustomFieldKey}
      onAddCustomField={addCustomFieldDraft}
      onUpdateCustomField={updateCustomFieldDraft}
      onRemoveSelectedCustomField={removeSelectedCustomFieldDraft}
      onMoveSelectedCustomFieldUp={moveSelectedCustomFieldDraftUp}
      onMoveSelectedCustomFieldDown={moveSelectedCustomFieldDraftDown}
      onResetCustomFieldsDrafts={resetCustomFieldDrafts}
      onTabChange={setActiveTabKey}
    />
  )
}
