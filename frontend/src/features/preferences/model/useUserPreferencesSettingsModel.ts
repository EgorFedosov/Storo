import { useCallback, useState } from 'react'
import type { UiTheme } from '../../../entities/user/model/types.ts'
import { useCurrentUser } from '../../auth/model/useCurrentUser.ts'
import {
  useUiPreferences,
  type UiLanguage,
} from './uiPreferencesStore.tsx'

export function normalizeLanguage(_value: string): UiLanguage {
  return 'ru'
}

export function validateLanguage(_language: string): string | null {
  return null
}

export function useUserPreferencesSettingsModel() {
  const {
    currentUser,
    isAuthenticated,
    resetPreferencesSyncState,
    updatePreferences,
  } = useCurrentUser()
  const {
    theme,
    replaceUiPreferences,
  } = useUiPreferences()

  const [preferencesSyncStatus, setPreferencesSyncStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [preferencesSyncErrorMessage, setPreferencesSyncErrorMessage] = useState<string | null>(null)

  const currentLanguage: UiLanguage = 'ru'
  const currentTheme = theme
  const canEditPreferences = true
  const isSaving = preferencesSyncStatus === 'saving'

  const savePreferences = useCallback(
    async (_languageDraft: string, themeDraft: UiTheme): Promise<boolean> => {
      setPreferencesSyncStatus('saving')
      setPreferencesSyncErrorMessage(null)

      replaceUiPreferences({
        language: 'ru',
        theme: themeDraft,
      })

      if (isAuthenticated && !currentUser.isBlocked) {
        const synced = await updatePreferences({
          language: 'ru',
          theme: themeDraft,
        })

        if (!synced) {
          setPreferencesSyncStatus('error')
          setPreferencesSyncErrorMessage('Сохранено локально, но синхронизация с сервером не удалась.')
          return false
        }
      }

      setPreferencesSyncStatus('success')
      return true
    },
    [currentUser.isBlocked, isAuthenticated, replaceUiPreferences, updatePreferences],
  )

  const resetPreferencesState = useCallback(() => {
    resetPreferencesSyncState()
    setPreferencesSyncStatus('idle')
    setPreferencesSyncErrorMessage(null)
  }, [resetPreferencesSyncState])

  const normalizeThemeValue = useCallback((value: string): UiTheme => {
    return value === 'dark' ? 'dark' : 'light'
  }, [])

  return {
    canEditPreferences,
    currentLanguage,
    currentTheme,
    isSaving,
    isUserBlocked: currentUser.isBlocked,
    isAuthenticated,
    preferencesSyncErrorMessage,
    preferencesSyncStatus,
    resetPreferencesState,
    savePreferences,
    normalizeThemeValue,
  }
}

