import { useEffect, useState } from 'react'

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

export function usePathname() {
  const [pathname, setPathname] = useState(() => window.location.pathname)

  useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname)
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  return pathname
}
