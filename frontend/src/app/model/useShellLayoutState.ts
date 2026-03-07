import { useMemo } from 'react'
import { resolveRoute } from './routeResolver.tsx'

export function useShellLayoutState(pathname: string) {
  return useMemo(() => {
    const route = resolveRoute(pathname)

    return {
      route,
      selectedNavigationKeys: route.navKey === null ? [] : [route.navKey],
    }
  }, [pathname])
}
