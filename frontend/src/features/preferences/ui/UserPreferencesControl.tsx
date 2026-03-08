import { SettingOutlined } from '@ant-design/icons'
import { Alert, Button, Input, Popover, Select, Space, Typography } from 'antd'
import { useCallback, useMemo, useState } from 'react'
import type { UiTheme } from '../../../entities/user/model/types.ts'
import {
  normalizeLanguage,
  useUserPreferencesSettingsModel,
  validateLanguage,
} from '../model/useUserPreferencesSettingsModel.ts'

const themeOptions: Array<{ label: string; value: UiTheme }> = [
  {
    label: 'Light',
    value: 'light',
  },
  {
    label: 'Dark',
    value: 'dark',
  },
]

export function UserPreferencesControl() {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  const {
    canEditPreferences,
    currentLanguage,
    currentTheme,
    isAuthenticated,
    isSaving,
    isUserBlocked,
    normalizeThemeValue,
    preferencesSyncErrorMessage,
    preferencesSyncStatus,
    resetPreferencesState,
    savePreferences,
  } = useUserPreferencesSettingsModel()

  const [languageDraft, setLanguageDraft] = useState(currentLanguage)
  const [themeDraft, setThemeDraft] = useState<UiTheme>(currentTheme)

  const normalizedLanguageDraft = useMemo(
    () => normalizeLanguage(languageDraft),
    [languageDraft],
  )
  const languageErrorMessage = useMemo(
    () => validateLanguage(normalizedLanguageDraft),
    [normalizedLanguageDraft],
  )
  const isDirty =
    normalizedLanguageDraft !== currentLanguage ||
    themeDraft !== currentTheme

  const saveDisabled = !canEditPreferences || !isDirty || languageErrorMessage !== null || isSaving
  const isSaveSuccessful = preferencesSyncStatus === 'success' && !isDirty

  const preferenceBadgeLabel = useMemo(
    () => `${currentLanguage} / ${currentTheme}`,
    [currentLanguage, currentTheme],
  )

  const resetDraftToCurrent = useCallback(() => {
    setLanguageDraft(currentLanguage)
    setThemeDraft(currentTheme)
    resetPreferencesState()
  }, [currentLanguage, currentTheme, resetPreferencesState])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setIsPopoverOpen(nextOpen)
      if (nextOpen) {
        setLanguageDraft(currentLanguage)
        setThemeDraft(currentTheme)
      }

      resetPreferencesState()
    },
    [currentLanguage, currentTheme, resetPreferencesState],
  )

  const handleThemeChange = useCallback((value: string) => {
    setThemeDraft(normalizeThemeValue(value))
  }, [normalizeThemeValue])

  const handleSaveClick = useCallback(() => {
    void savePreferences(languageDraft, themeDraft)
  }, [languageDraft, savePreferences, themeDraft])

  return (
    <Popover
      trigger="click"
      open={isPopoverOpen}
      onOpenChange={handleOpenChange}
      placement="bottomRight"
      content={(
        <Space direction="vertical" size={12} style={{ width: 280 }}>
          <Typography.Text strong>Preferences</Typography.Text>

          <div>
            <Typography.Text type="secondary">Language</Typography.Text>
            <Input
              value={languageDraft}
              placeholder="en"
              disabled={!canEditPreferences || isSaving}
              status={languageErrorMessage === null ? undefined : 'error'}
              onChange={(event) => {
                setLanguageDraft(event.target.value)
              }}
            />
            {languageErrorMessage !== null ? (
              <Typography.Text type="danger">{languageErrorMessage}</Typography.Text>
            ) : null}
          </div>

          <div>
            <Typography.Text type="secondary">Theme</Typography.Text>
            <Select
              value={themeDraft}
              options={themeOptions}
              disabled={!canEditPreferences || isSaving}
              onChange={handleThemeChange}
              style={{ width: '100%' }}
            />
          </div>

          {!isAuthenticated ? (
            <Alert showIcon type="info" message="Sign in to persist preferences on the server." />
          ) : null}

          {isUserBlocked ? (
            <Alert showIcon type="warning" message="Blocked users cannot update preferences." />
          ) : null}

          {preferencesSyncStatus === 'error' && preferencesSyncErrorMessage !== null ? (
            <Alert showIcon type="error" message={preferencesSyncErrorMessage} />
          ) : null}

          {isSaveSuccessful ? (
            <Alert showIcon type="success" message="Preferences saved." />
          ) : null}

          <Space>
            <Button
              type="primary"
              loading={isSaving}
              disabled={saveDisabled}
              onClick={handleSaveClick}
            >
              Save
            </Button>
            <Button
              onClick={resetDraftToCurrent}
              disabled={isSaving || !isDirty}
            >
              Reset
            </Button>
          </Space>
        </Space>
      )}
    >
      <Button
        size="small"
        icon={<SettingOutlined />}
        title="User preferences"
      >
        {preferenceBadgeLabel}
      </Button>
    </Popover>
  )
}
