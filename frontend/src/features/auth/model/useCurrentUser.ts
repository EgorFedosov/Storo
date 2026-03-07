import { useMemo } from 'react'
import type { CurrentUser } from '../../../entities/user/model/types.ts'

const prototypeUser: CurrentUser = {
  id: '1',
  userName: 'prototype-admin',
  displayName: 'Prototype Admin',
  roles: ['admin'],
  language: 'en',
  theme: 'light',
}

export function useCurrentUser() {
  const currentUser = useMemo<CurrentUser>(() => prototypeUser, [])

  return {
    currentUser,
    isAuthenticated: true,
  }
}
