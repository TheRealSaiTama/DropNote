import { useEffect, useState } from 'react'

import { getSyncStatus, subscribeSyncStatus, syncAll } from '@/lib/sync-engine'
import type { SyncEngineStatus } from '@/lib/sync-engine'

export function useSyncStatus() {
  const [status, setStatus] = useState<SyncEngineStatus>(getSyncStatus)

  useEffect(() => {
    return subscribeSyncStatus(setStatus)
  }, [])

  function syncNow(userId: string) {
    void syncAll(userId)
  }

  return { status, syncNow }
}
