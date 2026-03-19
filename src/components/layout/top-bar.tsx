import type { User } from '@supabase/supabase-js'
import { Plus, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { SyncEngineStatus } from '@/lib/sync-engine'

import { AuthPanel } from './auth-panel'
import { SyncIndicator } from './sync-indicator'

interface TopBarProps {
  searchValue: string
  onSearchChange: (value: string) => void
  onCreateNote: () => void
  user: User | null
  syncStatus: SyncEngineStatus
  failedJobs: number
  onSignIn: (email: string) => Promise<void>
  onSignOut: () => Promise<void>
  onSyncNow: () => void
}

export function TopBar({ searchValue, onSearchChange, onCreateNote, user, syncStatus, failedJobs, onSignIn, onSignOut, onSyncNow }: TopBarProps) {
  return (
    <header className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:gap-3 sm:px-5 lg:px-6">
      <span className="font-serif text-xl leading-none">dropnote</span>
      <label className="relative order-last min-w-0 flex-[1_1_100%] sm:order-none sm:flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search notes..."
          className="h-9 pl-9 text-sm"
        />
      </label>
      <div className="ml-auto flex items-center gap-2 sm:ml-0">
        <SyncIndicator status={syncStatus} failedJobs={failedJobs} onSyncNow={onSyncNow} />
        <AuthPanel user={user} onSignIn={onSignIn} onSignOut={onSignOut} />
        <Button size="icon" onClick={onCreateNote} className="size-9 rounded-full" aria-label="New note">
          <Plus />
        </Button>
      </div>
    </header>
  )
}
