import { SettingOutlined } from '@ant-design/icons'
import { Alert, Button, Popover, Select, Space, Typography } from 'antd'
import { useCallback, useMemo, useState } from 'react'
import type { UiTheme } from '../../../entities/user/model/types.ts'
import { useUserPreferencesSettingsModel } from '../model/useUserPreferencesSettingsModel.ts'

export function UserPreferencesControl() {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  const {
    canEditPreferences,
    currentLanguage,
    currentTheme,
    isAuthenticated,
    isSaving,
    normalizeThemeValue,
    preferencesSyncErrorMessage,
    preferencesSyncStatus,
    resetPreferencesState,
    savePreferences,
  } = useUserPreferencesSettingsModel()

  const [themeDraft, setThemeDraft] = useState<UiTheme>(currentTheme)

  const themeOptions: Array<{ label: string; value: UiTheme }> = useMemo(
    () => [
      { label: 'Светлая', value: 'light' },
      { label: 'Темная', value: 'dark' },
    ],
    [],
  )

  const isDirty = themeDraft !== currentTheme

  const saveDisabled = !canEditPreferences || !isDirty || isSaving
  const isSaveSuccessful = preferencesSyncStatus === 'success' && !isDirty

  const preferenceBadgeLabel = useMemo(
    () => `${currentTheme}`,
    [currentTheme],
  )

  const resetDraftToCurrent = useCallback(() => {
    setThemeDraft(currentTheme)
    resetPreferencesState()
  }, [currentTheme, resetPreferencesState])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setIsPopoverOpen(nextOpen)
      if (nextOpen) {
        setThemeDraft(currentTheme)
      }

      resetPreferencesState()
    },
    [currentTheme, resetPreferencesState],
  )

  const handleThemeChange = useCallback((value: string) => {
    setThemeDraft(normalizeThemeValue(value))
  }, [normalizeThemeValue])

  const handleSaveClick = useCallback(() => {
    void savePreferences(currentLanguage, themeDraft)
  }, [currentLanguage, savePreferences, themeDraft])

  return (
    <Popover
      trigger="click"
      open={isPopoverOpen}
      onOpenChange={handleOpenChange}
      placement="bottomRight"
      content={(
        <Space direction="vertical" size={12} style={{ width: 280 }}>
          <Typography.Text strong>Настройки</Typography.Text>

          <div>
            <Typography.Text type="secondary">Тема</Typography.Text>
            <Select
              value={themeDraft}
              options={themeOptions}
              disabled={!canEditPreferences || isSaving}
              onChange={handleThemeChange}
              style={{ width: '100%' }}
            />
          </div>

          {!isAuthenticated ? (
            <Alert showIcon type="info" message="Войдите в аккаунт, чтобы синхронизировать настройки с сервером." />
          ) : null}

          {preferencesSyncStatus === 'error' && preferencesSyncErrorMessage !== null ? (
            <Alert
              showIcon
              type="warning"
              message={preferencesSyncErrorMessage === 'Сохранено локально, но синхронизация с сервером не удалась.'
                ? 'Локально сохранено, но синхронизация с сервером не удалась.'
                : preferencesSyncErrorMessage}
            />
          ) : null}

          {isSaveSuccessful ? (
            <Alert showIcon type="success" message="Настройки сохранены." />
          ) : null}

          <Space>
            <Button
              type="primary"
              loading={isSaving}
              disabled={saveDisabled}
              onClick={handleSaveClick}
            >
              Сохранить
            </Button>
            <Button
              onClick={resetDraftToCurrent}
              disabled={isSaving || !isDirty}
            >
              Сбросить
            </Button>
          </Space>
        </Space>
      )}
    >
      <Button
        size="small"
        icon={<SettingOutlined />}
        title="Настройки интерфейса"
      >
        {preferenceBadgeLabel}
      </Button>
    </Popover>
  )
}

