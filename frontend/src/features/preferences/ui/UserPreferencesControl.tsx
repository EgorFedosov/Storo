import { BulbOutlined, MoonOutlined } from '@ant-design/icons'
import { Switch, Tooltip } from 'antd'
import { useCallback } from 'react'
import { useUserPreferencesSettingsModel } from '../model/useUserPreferencesSettingsModel.ts'

export function UserPreferencesControl() {
  const {
    canEditPreferences,
    currentLanguage,
    currentTheme,
    isSaving,
    preferencesSyncErrorMessage,
    savePreferences,
  } = useUserPreferencesSettingsModel()

  const handleThemeToggle = useCallback((checked: boolean) => {
    void savePreferences(currentLanguage, checked ? 'dark' : 'light')
  }, [currentLanguage, savePreferences])

  return (
    <Tooltip title={preferencesSyncErrorMessage ?? 'Переключить тему'}>
      <Switch
        className="theme-switch-control"
        checked={currentTheme === 'dark'}
        checkedChildren={<MoonOutlined />}
        unCheckedChildren={<BulbOutlined />}
        loading={isSaving}
        disabled={!canEditPreferences}
        onChange={handleThemeToggle}
      />
    </Tooltip>
  )
}
