import { useMemo } from 'react'
import { guestCurrentUser } from '../../../entities/user/model/types.ts'
import { useAuthModel } from './authStore.tsx'

export function useCurrentUser() {
  const authModel = useAuthModel()

  return useMemo(
    () => ({
      ...authModel,
      currentUser: authModel.currentUser ?? guestCurrentUser,
    }),
    [authModel],
  )
}
