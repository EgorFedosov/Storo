import { lazy } from 'react'
import type { ComponentType, LazyExoticComponent } from 'react'
import { normalizePathname, type AppRouteKey, type AppShellNavKey, routes } from '../../shared/config/routes.ts'

type PageComponent = LazyExoticComponent<ComponentType>

const HomePage = lazy(async () => ({ default: (await import('../../pages/home/ui/HomePage.tsx')).HomePage }))
const SearchPage = lazy(async () => ({ default: (await import('../../pages/search/ui/SearchPage.tsx')).SearchPage }))
const InventoryPage = lazy(async () => ({ default: (await import('../../pages/inventory/ui/InventoryPage.tsx')).InventoryPage }))
const ItemPage = lazy(async () => ({ default: (await import('../../pages/item/ui/ItemPage.tsx')).ItemPage }))
const MyInventoriesPage = lazy(async () => ({
  default: (await import('../../pages/my-inventories/ui/MyInventoriesPage.tsx')).MyInventoriesPage,
}))
const CreateInventoryPage = lazy(async () => ({
  default: (await import('../../pages/create-inventory/ui/CreateInventoryPage.tsx')).CreateInventoryPage,
}))
const AdminUsersPage = lazy(async () => ({
  default: (await import('../../pages/admin-users/ui/AdminUsersPage.tsx')).AdminUsersPage,
}))
const AuthErrorPage = lazy(async () => ({
  default: (await import('../../pages/auth-error/ui/AuthErrorPage.tsx')).AuthErrorPage,
}))
const NotFoundPage = lazy(async () => ({
  default: (await import('../../pages/not-found/ui/NotFoundPage.tsx')).NotFoundPage,
}))

const positiveIdPattern = /^[1-9]\d*$/

const routePageMap: Record<AppRouteKey, PageComponent> = {
  home: HomePage,
  searchInventories: SearchPage,
  searchItems: SearchPage,
  inventory: InventoryPage,
  item: ItemPage,
  myInventories: MyInventoriesPage,
  createInventory: CreateInventoryPage,
  adminUsers: AdminUsersPage,
  authError: AuthErrorPage,
  notFound: NotFoundPage,
}

type RouteMatch = {
  key: AppRouteKey
  navKey: AppShellNavKey | null
  isKnownRoute: boolean
}

function matchEntityRoute(pathname: string, singularSegment: string, pluralSegment: string): boolean {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length !== 2) {
    return false
  }

  const [segment, rawId] = segments
  const validPrefix = segment === singularSegment || segment === pluralSegment
  return validPrefix && positiveIdPattern.test(rawId)
}

export function resolveRoute(pathname: string): RouteMatch & { Page: PageComponent } {
  const normalizedPathname = normalizePathname(pathname)
  const routeKey = resolveRouteKey(normalizedPathname)
  const navKey = getNavKeyForRoute(routeKey)

  return {
    key: routeKey,
    navKey,
    isKnownRoute: routeKey !== 'notFound',
    Page: routePageMap[routeKey],
  }
}

export function resolveRouteKey(pathname: string): AppRouteKey {
  const normalizedPathname = normalizePathname(pathname)

  if (normalizedPathname === routes.home.path || normalizedPathname === '/') {
    return 'home'
  }

  if (normalizedPathname === '/search' || normalizedPathname.startsWith('/search/inventories')) {
    return 'searchInventories'
  }

  if (normalizedPathname.startsWith('/search/items')) {
    return 'searchItems'
  }

  if (matchEntityRoute(normalizedPathname, 'inventory', 'inventories')) {
    return 'inventory'
  }

  if (matchEntityRoute(normalizedPathname, 'item', 'items')) {
    return 'item'
  }

  if (normalizedPathname === routes.myInventories.path) {
    return 'myInventories'
  }

  if (normalizedPathname === routes.createInventory.path) {
    return 'createInventory'
  }

  if (normalizedPathname === routes.adminUsers.path) {
    return 'adminUsers'
  }

  if (normalizedPathname === routes.authError.path) {
    return 'authError'
  }

  return 'notFound'
}

export function resolvePage(pathname: string): PageComponent {
  return resolveRoute(pathname).Page
}

function getNavKeyForRoute(routeKey: AppRouteKey): AppShellNavKey | null {
  if (routeKey === 'home') {
    return routeKey
  }

  if (routeKey === 'searchInventories') {
    return routeKey
  }

  if (routeKey === 'searchItems') {
    return routeKey
  }

  if (routeKey === 'myInventories') {
    return routeKey
  }

  if (routeKey === 'createInventory') {
    return 'myInventories'
  }

  if (routeKey === 'adminUsers') {
    return routeKey
  }

  return null
}
