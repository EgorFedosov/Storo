import { useCurrentUser } from '../../features/auth/model/useCurrentUser.ts'
import { routes } from '../../shared/config/routes.ts'
import { navigate, usePathname } from '../../shared/lib/router/navigation.ts'
import { resolvePage, resolveRouteKey } from '../model/routeResolver.tsx'

const navigationOrder = [
  routes.home,
  routes.search,
  routes.inventory,
  routes.item,
  routes.myInventories,
  routes.adminUsers,
] as const

export function AppShell() {
  const pathname = usePathname()
  const activeRouteKey = resolveRouteKey(pathname)
  const Page = resolvePage(pathname)
  const { currentUser, isAuthenticated } = useCurrentUser()

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>Inventory Frontend Prototype</h1>
          <p>FSD-lite structure: app/pages/features/entities/shared</p>
        </div>

        <div className="user-chip">
          <span>{isAuthenticated ? 'Authenticated' : 'Guest'}</span>
          <strong>{currentUser.displayName}</strong>
          <span>{currentUser.roles.join(', ')}</span>
        </div>
      </header>

      <nav className="app-nav" aria-label="prototype-navigation">
        {navigationOrder.map((route) => {
          const isActive = activeRouteKey === route.key
          return (
            <button
              key={route.key}
              className={isActive ? 'nav-button nav-button-active' : 'nav-button'}
              type="button"
              onClick={() => navigate(route.path)}
            >
              {route.label}
            </button>
          )
        })}
      </nav>

      <main className="app-content">
        <Page />
      </main>
    </div>
  )
}
