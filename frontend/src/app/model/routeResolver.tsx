import { AdminUsersPage } from '../../pages/admin-users/ui/AdminUsersPage.tsx'
import { HomePage } from '../../pages/home/ui/HomePage.tsx'
import { InventoryPage } from '../../pages/inventory/ui/InventoryPage.tsx'
import { ItemPage } from '../../pages/item/ui/ItemPage.tsx'
import { MyInventoriesPage } from '../../pages/my-inventories/ui/MyInventoriesPage.tsx'
import { SearchPage } from '../../pages/search/ui/SearchPage.tsx'
import { routes, type AppRouteKey } from '../../shared/config/routes.ts'

export function resolveRouteKey(pathname: string): AppRouteKey {
  if (pathname === routes.home.path) {
    return 'home'
  }

  if (pathname.startsWith(routes.search.path)) {
    return 'search'
  }

  if (pathname.startsWith('/inventory/')) {
    return 'inventory'
  }

  if (pathname.startsWith('/item/')) {
    return 'item'
  }

  if (pathname.startsWith(routes.myInventories.path)) {
    return 'myInventories'
  }

  if (pathname.startsWith(routes.adminUsers.path)) {
    return 'adminUsers'
  }

  return 'home'
}

export function resolvePage(pathname: string) {
  switch (resolveRouteKey(pathname)) {
    case 'home':
      return HomePage
    case 'search':
      return SearchPage
    case 'inventory':
      return InventoryPage
    case 'item':
      return ItemPage
    case 'myInventories':
      return MyInventoriesPage
    case 'adminUsers':
      return AdminUsersPage
    default:
      return HomePage
  }
}
