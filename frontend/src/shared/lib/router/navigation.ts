import { useEffect, useState } from 'react'

export type LocationSnapshot = {
  pathname: string
  search: string
  hash: string
}

function normalizeNavigationPath(targetPath: string): string {
  const trimmedPath = targetPath.trim()
  if (trimmedPath.length === 0) {
    throw new Error('Navigation target path must be non-empty.')
  }

  const withLeadingSlash = trimmedPath.startsWith('/') ? trimmedPath : `/${trimmedPath}`
  const parsedUrl = new URL(withLeadingSlash, window.location.origin)

  return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`
}

export function navigate(pathname: string) {
  const targetPath = normalizeNavigationPath(pathname)
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`

  if (currentPath === targetPath) {
    return
  }

  window.history.pushState(null, '', targetPath)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function createLocationSnapshot(): LocationSnapshot {
  return {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
  }
}

export function useLocationSnapshot(): LocationSnapshot {
  const [locationSnapshot, setLocationSnapshot] = useState<LocationSnapshot>(() =>
    createLocationSnapshot())

  useEffect(() => {
    const handlePopState = () => {
      setLocationSnapshot(createLocationSnapshot())
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  return locationSnapshot
}

export function usePathname() {
  return useLocationSnapshot().pathname
}
