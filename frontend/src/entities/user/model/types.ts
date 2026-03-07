export type UserRole = 'user' | 'admin'
export type UiTheme = 'light' | 'dark'

export interface CurrentUserPermissions {
  isAdmin: boolean
  canManageUsers: boolean
  canCreateInventory: boolean
  canComment: boolean
  canLike: boolean
}

export interface GlobalAccessModel {
  canAccessMyInventories: boolean
  canAccessAdminUsers: boolean
}

export interface CurrentUser {
  id: string
  email: string
  userName: string
  displayName: string
  isBlocked: boolean
  roles: ReadonlyArray<UserRole>
  language: string
  theme: UiTheme
}

export const guestPermissions: CurrentUserPermissions = {
  isAdmin: false,
  canManageUsers: false,
  canCreateInventory: false,
  canComment: false,
  canLike: false,
}

export const guestAccessModel: GlobalAccessModel = {
  canAccessMyInventories: false,
  canAccessAdminUsers: false,
}

export const guestCurrentUser: CurrentUser = {
  id: 'guest',
  email: '',
  userName: 'guest',
  displayName: 'Guest',
  isBlocked: false,
  roles: [],
  language: 'en',
  theme: 'light',
}
