import { useEffect, useState } from 'react'

import { hasPendingJobs, getFailedCount, subscribeJobs } from '@/lib/attachment-queue'
import { getSyncStatus, subscribeSyncStatus, syncAll } from '@/lib/sync-engine'
import type { SyncEngineStatus } from '@/lib/sync-engine'

export function useSyncStatus() {
  const [engineStatus, setEngineStatus] = useState<SyncEngineStatus>(getSyncStatus)
  const [pendingJobs, setPendingJobs] = useState(false)
  const [failedJobs, setFailedJobs] = useState(0)

  useEffect(() => {
    return subscribeSyncStatus(setEngineStatus)
  }, [])

  useEffect(() => {
    return subscribeJobs(() => {
      setPendingJobs(hasPendingJobs())
      setFailedJobs(getFailedCount())
    })
  }, [])

  const status: SyncEngineStatus = pendingJobs ? 'syncing' : engineStatus

  function syncNow(userId: string) {
    void syncAll(userId)
  }

  return { status, syncNow, failedJobs }
}
