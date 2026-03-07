export type UserRole = 'user' | 'admin'
export type UiTheme = 'light' | 'dark'

export interface CurrentUser {
  id: string
  userName: string
  displayName: string
  roles: ReadonlyArray<UserRole>
  language: string
  theme: UiTheme
}
