import { useEffect, useState } from 'react'

export function navigate(pathname: string) {
  if (window.location.pathname === pathname) {
    return
  }

  window.history.pushState(null, '', pathname)
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
