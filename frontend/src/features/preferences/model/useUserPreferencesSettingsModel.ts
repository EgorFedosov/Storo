import { useCallback, useMemo } from 'react'
import type { UiTheme } from '../../../entities/user/model/types.ts'
import { useCurrentUser } from '../../auth/model/useCurrentUser.ts'

const maxLanguageLength = 10

export function normalizeLanguage(value: string): string {
  return value.trim().toLowerCase()
}

export function validateLanguage(language: string): string | null {
  if (language.length === 0) {
    return 'Language is required.'
  }

  if (language.length > maxLanguageLength) {
    return `Language must be ${maxLanguageLength} characters or less.`
  }

  return null
}

export function useUserPreferencesSettingsModel() {
  const {
    currentUser,
    isAuthenticated,
    preferencesSyncStatus,
    preferencesSyncErrorMessage,
    resetPreferencesSyncState,
    updatePreferences,
  } = useCurrentUser()

  const currentLanguage = useMemo(
    () => normalizeLanguage(currentUser.language),
    [currentUser.language],
  )
  const currentTheme = currentUser.theme
  const canEditPreferences = isAuthenticated && !currentUser.isBlocked
  const isSaving = preferencesSyncStatus === 'saving'

  const savePreferences = useCallback(
    async (languageDraft: string, themeDraft: UiTheme): Promise<boolean> => {
      const normalizedLanguage = normalizeLanguage(languageDraft)
      const validationError = validateLanguage(normalizedLanguage)

      if (!canEditPreferences || validationError !== null) {
        return false
      }

      return updatePreferences({
        language: normalizedLanguage,
        theme: themeDraft,
      })
    },
    [canEditPreferences, updatePreferences],
  )

  const resetPreferencesState = useCallback(() => {
    resetPreferencesSyncState()
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
