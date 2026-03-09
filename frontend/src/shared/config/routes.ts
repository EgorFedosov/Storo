export type AppRouteKey =
  | 'home'
  | 'searchInventories'
  | 'searchItems'
  | 'inventory'
  | 'inventoryEditor'
  | 'item'
  | 'myInventories'
  | 'createInventory'
  | 'adminUsers'
  | 'authError'
  | 'notFound'

type ConcreteRouteKey = Exclude<AppRouteKey, 'notFound'>

export type AppRouteDefinition = Readonly<{
  key: ConcreteRouteKey
  path: string
  label: string
}>

export const routes = {
  home: {
    key: 'home',
    path: '/home',
    label: 'Home',
  },
  searchInventories: {
    key: 'searchInventories',
    path: '/search/inventories',
    label: 'Search Inventories',
  },
  searchItems: {
    key: 'searchItems',
    path: '/search/items',
    label: 'Search Items',
  },
  inventory: {
    key: 'inventory',
    path: '/inventory/1',
    label: 'Inventory #1',
  },
  inventoryEditor: {
    key: 'inventoryEditor',
    path: '/inventory/1/edit',
    label: 'Inventory Editor #1',
  },
  item: {
    key: 'item',
    path: '/item/1',
    label: 'Item #1',
  },
  myInventories: {
    key: 'myInventories',
    path: '/my/inventories',
    label: 'My Inventories',
  },
  createInventory: {
    key: 'createInventory',
    path: '/inventories/create',
    label: 'Create Inventory',
  },
  adminUsers: {
    key: 'adminUsers',
    path: '/admin/users',
    label: 'Admin Users',
  },
  authError: {
    key: 'authError',
    path: '/auth/error',
    label: 'Auth Error',
  },
} as const satisfies Record<ConcreteRouteKey, AppRouteDefinition>

export const shellNavigationModel = [
  routes.home,
  routes.searchInventories,
  routes.searchItems,
  routes.myInventories,
  routes.adminUsers,
] as const

export type AppShellNavKey = (typeof shellNavigationModel)[number]['key']

export function normalizePathname(pathname: string): string {
  const trimmedPathname = pathname.trim()
  if (trimmedPathname.length === 0) {
    return '/'
  }

  const withLeadingSlash = trimmedPathname.startsWith('/') ? trimmedPathname : `/${trimmedPathname}`
  if (withLeadingSlash.length === 1) {
    return withLeadingSlash
  }

  return withLeadingSlash.replace(/\/+$/, '')
}
