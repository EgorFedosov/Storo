export const routes = {
  home: {
    key: 'home',
    path: '/',
    label: 'Home',
  },
  search: {
    key: 'search',
    path: '/search',
    label: 'Search',
  },
  inventory: {
    key: 'inventory',
    path: '/inventory/1',
    label: 'Inventory',
  },
  item: {
    key: 'item',
    path: '/item/1',
    label: 'Item',
  },
  myInventories: {
    key: 'myInventories',
    path: '/my/inventories',
    label: 'My Inventories',
  },
  adminUsers: {
    key: 'adminUsers',
    path: '/admin/users',
    label: 'Admin Users',
  },
} as const

export type AppRouteKey = keyof typeof routes
