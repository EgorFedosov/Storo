import type { PropsWithChildren } from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { UiTheme } from '../../../entities/user/model/types.ts'
import { useCurrentUser } from '../../auth/model/useCurrentUser.ts'

export type UiLanguage = 'ru'

export type UiPreferences = {
  language: UiLanguage
  theme: UiTheme
}

type UiPreferencesContextValue = UiPreferences & {
  updateUiPreferences: (next: Partial<UiPreferences>) => void
  replaceUiPreferences: (next: UiPreferences) => void
}

const uiPreferencesContext = createContext<UiPreferencesContextValue | null>(null)

const storageKey = 'inventory.ui.preferences.v1'

function normalizeLanguage(_value: unknown): UiLanguage {
  return 'ru'
}

function normalizeTheme(value: unknown): UiTheme {
  return value === 'dark' ? 'dark' : 'light'
}

function readStoredPreferences(): UiPreferences | null {
  try {
    const rawValue = localStorage.getItem(storageKey)
    if (rawValue === null) {
      return null
    }

    const parsedValue = JSON.parse(rawValue) as Record<string, unknown>
    return {
      language: normalizeLanguage(parsedValue.language),
      theme: normalizeTheme(parsedValue.theme),
    }
  } catch {
    return null
  }
}

function writeStoredPreferences(preferences: UiPreferences): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(preferences))
  } catch {
    // Ignore storage write errors in restricted environments.
  }
}

export function UiPreferencesProvider({ children }: PropsWithChildren) {
  const { currentUser, isAuthenticated, status } = useCurrentUser()

  const initialStoredPreferences = useMemo(readStoredPreferences, [])
  const canSeedFromServerRef = useRef(initialStoredPreferences === null)

  const [preferences, setPreferences] = useState<UiPreferences>(() => (
    initialStoredPreferences ?? {
      language: 'ru',
      theme: 'light',
    }
  ))

  useEffect(() => {
    if (!canSeedFromServerRef.current || status !== 'ready' || !isAuthenticated) {
      return
    }

    setPreferences({
      language: 'ru',
      theme: normalizeTheme(currentUser.theme),
    })

    canSeedFromServerRef.current = false
  }, [currentUser.theme, isAuthenticated, status])

  useEffect(() => {
    writeStoredPreferences(preferences)
  }, [preferences])

  const replaceUiPreferences = useCallback((next: UiPreferences) => {
    setPreferences({
      language: 'ru',
      theme: normalizeTheme(next.theme),
    })

    canSeedFromServerRef.current = false
  }, [])

  const updateUiPreferences = useCallback((next: Partial<UiPreferences>) => {
    setPreferences((currentValue) => ({
      language: 'ru',
      theme: next.theme === undefined
        ? currentValue.theme
        : normalizeTheme(next.theme),
    }))

    canSeedFromServerRef.current = false
  }, [])

  const contextValue = useMemo<UiPreferencesContextValue>(
    () => ({
      ...preferences,
      updateUiPreferences,
      replaceUiPreferences,
    }),
    [preferences, replaceUiPreferences, updateUiPreferences],
  )

  return <uiPreferencesContext.Provider value={contextValue}>{children}</uiPreferencesContext.Provider>
}

export function useUiPreferences(): UiPreferencesContextValue {
  const contextValue = useContext(uiPreferencesContext)

  if (contextValue === null) {
    throw new Error('useUiPreferences должен вызываться внутри UiPreferencesProvider.')
  }

  return contextValue
}

export function normalizeUiLanguage(_value: string): UiLanguage {
  return 'ru'
}

