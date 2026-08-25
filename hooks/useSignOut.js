import { useRouter } from 'next/router'
import { signOut } from '../lib/services/auth'

export function useSignOut() {
  const router = useRouter()
  return async () => {
    await signOut()
    localStorage.removeItem('activeLocalId')
    router.replace('/')
  }
}
