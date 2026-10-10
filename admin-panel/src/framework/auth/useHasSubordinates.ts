import { useEffect, useState } from 'react'
import { useAuth } from '@/framework/auth/AuthContext'
import { teamService } from '@/services/team.service'

export const useHasSubordinates = (): boolean => {
  const { state, isSuperAdmin } = useAuth()
  const [hasSubordinates, setHasSubordinates] = useState(false)
  const authenticated = state.status === 'authenticated'

  useEffect(() => {
    if (!authenticated || isSuperAdmin) {
      setHasSubordinates(false)
      return
    }
    let active = true
    const load = async () => {
      try {
        const members = await teamService.getSubordinates()
        if (active) setHasSubordinates(members.length > 0)
      } catch {
        if (active) setHasSubordinates(false)
      }
    }
    void load()
    return () => { active = false }
  }, [authenticated, isSuperAdmin])

  return isSuperAdmin || hasSubordinates
}
