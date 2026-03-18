import { AlertCircle, CheckCircle2, Loader2, WifiOff } from 'lucide-react'

import type { SyncEngineStatus } from '@/lib/sync-engine'

interface SyncIndicatorProps {
  status: SyncEngineStatus
  onSyncNow: () => void
}

export function SyncIndicator({ status, onSyncNow }: SyncIndicatorProps) {
  if (status === 'idle') return null

  if (status === 'syncing') {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        syncing
      </span>
    )
  }

  if (status === 'synced') {
    return (
      <button
        type="button"
        onClick={onSyncNow}
        className="flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
      >
        <CheckCircle2 className="size-3" />
        synced
      </button>
    )
  }

  if (status === 'offline') {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <WifiOff className="size-3" />
        offline
      </span>
    )
  }

  if (status === 'error') {
    return (
      <button
        type="button"
        onClick={onSyncNow}
        className="flex items-center gap-1 text-xs text-destructive transition hover:opacity-80"
      >
        <AlertCircle className="size-3" />
        sync error — retry
      </button>
    )
  }

  return null
}
