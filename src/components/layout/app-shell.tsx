import { useCallback, useEffect, useRef, useState } from 'react'

import { seedDatabase } from '@/data/seed-data'
import { useAuth } from '@/hooks/use-auth'
import { useNote } from '@/hooks/use-note'
import { useNoteActions } from '@/hooks/use-note-actions'
import { useFoldersLive } from '@/hooks/use-folders'
import { useNotesLive } from '@/hooks/use-notes'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { useSyncStatus } from '@/hooks/use-sync-status'
import { enqueueUpload } from '@/lib/attachment-queue'
import { startRealtime, stopRealtime } from '@/lib/realtime'
import { scheduleSyncDebounced, syncAll } from '@/lib/sync-engine'
import type { FolderScope, Note, NoteFilter } from '@/types/note'

import { NoteEditorPane } from './note-editor-pane'
import { NotesListPane } from './notes-list-pane'
import { TopBar } from './top-bar'

const DEV = import.meta.env.DEV

export function AppShell() {
  const [activeFilter, setActiveFilter] = useLocalStorage<NoteFilter>('dropnote.active-filter', 'all')
  const [searchValue, setSearchValue] = useLocalStorage('dropnote.search-value', '')
  const [selectedNoteId, setSelectedNoteId] = useLocalStorage<string | null>('dropnote.selected-note-id', null)
  const [folderScope, setFolderScope] = useLocalStorage<FolderScope>('dropnote.folder-scope', 'all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const folders = useFoldersLive()
  const notes = useNotesLive(activeFilter, searchValue, folderScope)
  const selectedNote = useNote(selectedNoteId)

  const {
    create,
    edit,
    remove,
    pin,
    archive,
    bulkRemove,
    bulkArchive,
    flushPendingEdit,
    setNoteFolder,
    addFolder,
    removeFolder,
    renameFolder,
  } = useNoteActions()
  const { user, signIn, signOut } = useAuth()
  const { status: syncStatus, failedJobs } = useSyncStatus()

  const runImmediateSync = useCallback(
    async (reason: string, { restartRealtime = false }: { restartRealtime?: boolean } = {}) => {
      if (!user) return
      await flushPendingEdit()
      if (restartRealtime) {
        startRealtime(user.id)
      }
      if (DEV) console.log('[sync] immediate sync requested', reason, user.id)
      await syncAll(user.id)
    },
    [flushPendingEdit, user],
  )

  useEffect(() => {
    if (user) {
      void runImmediateSync('session-start', { restartRealtime: true })
    } else {
      stopRealtime()
    }
    return () => stopRealtime()
  }, [runImmediateSync, user])

  useEffect(() => {
    function handleOnline() {
      void runImmediateSync('online')
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [runImmediateSync])

  const selectedNoteIdRef = useRef<string | null>(selectedNoteId)

  useEffect(() => {
    selectedNoteIdRef.current = selectedNoteId
  }, [selectedNoteId])

  useEffect(() => {
    function handleForeground() {
      if (!user) return
      if (DEV && selectedNoteIdRef.current) {
        console.log('[diagnostic] foreground reconcile', {
          selectedNoteId: selectedNoteIdRef.current,
          userId: user.id,
        })
      }
      void runImmediateSync('foreground', { restartRealtime: true })
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        handleForeground()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleForeground)
    window.addEventListener('pageshow', handleForeground)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleForeground)
      window.removeEventListener('pageshow', handleForeground)
    }
  }, [runImmediateSync, user])

  const initRef = useRef(false)
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    void seedDatabase()
  }, [])

  useEffect(() => {
    if (folderScope === 'all' || folderScope === 'unfiled') return
    const exists = folders.some((f) => f.id === folderScope)
    if (!exists) setFolderScope('all')
  }, [folderScope, folders, setFolderScope])

  const handleCreateNote = async () => {
    const fid = folderScope === 'all' || folderScope === 'unfiled' ? null : folderScope
    const note = await create({ folderId: fid })
    setSelectedNoteId(note.id)
  }

  const handleEditNote = (
    noteId: string,
    changes: Pick<Note, 'title' | 'content'>,
    onSaved?: (changes: Pick<Note, 'title' | 'content'>) => void,
  ) => {
    edit(noteId, changes, (savedChanges) => {
      onSaved?.(savedChanges)
      if (user) {
        if (DEV) {
          console.log('[sync] immediate note save sync started', noteId, {
            title: savedChanges.title.slice(0, 40),
            contentLen: savedChanges.content.length,
          })
        }
        void runImmediateSync(`note-save:${noteId}`)
      }
    })
    if (user) scheduleSyncDebounced(user.id)
  }

  const handlePin = async (noteId: string) => {
    await pin(noteId)
    if (user) scheduleSyncDebounced(user.id)
  }

  const handleArchive = async (noteId: string) => {
    await archive(noteId)
    if (user) scheduleSyncDebounced(user.id)
  }

  const handleDeleteNote = async (noteId: string) => {
    await remove(noteId)
    setSelectedNoteId(null)
    if (user) {
      if (import.meta.env.DEV) console.log('[delete] immediate sync started for', noteId)
      void runImmediateSync(`note-delete:${noteId}`)
    }
  }

  const handleEnsureNote = useCallback(async (): Promise<string> => {
    if (selectedNoteId) return selectedNoteId
    const fid = folderScope === 'all' || folderScope === 'unfiled' ? null : folderScope
    const note = await create({ folderId: fid })
    setSelectedNoteId(note.id)
    return note.id
  }, [selectedNoteId, create, setSelectedNoteId, folderScope])

  const handleMoveNoteToFolder = async (noteId: string, folderId: string | null) => {
    await setNoteFolder(noteId, folderId)
    if (user) scheduleSyncDebounced(user.id)
  }

  const handleCreateFolder = async (name: string) => {
    const f = await addFolder(name)
    if (user) scheduleSyncDebounced(user.id)
    return f
  }

  const handleRemoveFolder = async (folderId: string) => {
    const ok = window.confirm('Delete this folder? Notes inside stay in your library without a folder.')
    if (!ok) return
    await removeFolder(folderId)
    if (folderScope === folderId) setFolderScope('all')
    if (user) void runImmediateSync('folder-delete')
  }

  const handleRenameFolder = async (folderId: string, name: string) => {
    await renameFolder(folderId, name)
    if (user) scheduleSyncDebounced(user.id)
  }

  const handleBack = () => setSelectedNoteId(null)

  const handleAttachmentAdded = useCallback((attachmentId: string) => {
    if (user) {
      enqueueUpload(attachmentId, user.id)
      scheduleSyncDebounced(user.id)
    }
  }, [user])

  const handleAttachmentRemoved = useCallback((attachmentId: string) => {
    if (user) {
      if (import.meta.env.DEV) console.log('[delete] immediate attachment sync started for', attachmentId)
      void runImmediateSync(`attachment-delete:${attachmentId}`)
    }
  }, [runImmediateSync, user])

  const handleToggleSelect = (noteId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(noteId)) next.delete(noteId)
      else next.add(noteId)
      return next
    })
  }

  const handleSelectAllVisible = () => {
    setSelectedIds(new Set(notes.map((n) => n.id)))
  }

  const handleClearSelection = () => setSelectedIds(new Set())

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    await bulkRemove(ids)
    if (selectedNoteId && selectedIds.has(selectedNoteId)) setSelectedNoteId(null)
    setSelectedIds(new Set())
    if (user) {
      if (import.meta.env.DEV) console.log('[delete] immediate bulk sync started for', ids.length, 'notes')
      void runImmediateSync(`bulk-delete:${ids.length}`)
    }
  }

  const handleBulkArchive = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    await bulkArchive(ids, activeFilter !== 'archived')
    setSelectedIds(new Set())
    if (user) scheduleSyncDebounced(user.id)
  }

  return (
    <div className="flex h-dvh flex-col">
      <TopBar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        onCreateNote={handleCreateNote}
        user={user}
        syncStatus={syncStatus}
        failedJobs={failedJobs}
        onSignIn={signIn}
        onSignOut={signOut}
        onSyncNow={() => { if (user) void runImmediateSync('manual-sync') }}
      />

      <div className="flex flex-1 overflow-hidden">
        <aside className={`${selectedNoteId ? 'hidden' : ''} flex-1 overflow-y-auto p-4 lg:block lg:w-[24rem] lg:flex-none lg:border-r`}>
          <NotesListPane
            notes={notes}
            folders={folders}
            folderScope={folderScope}
            onFolderScopeChange={setFolderScope}
            onCreateFolder={handleCreateFolder}
            onDeleteFolder={handleRemoveFolder}
            onRenameFolder={handleRenameFolder}
            onMoveToFolder={handleMoveNoteToFolder}
            selectedNoteId={selectedNoteId}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            onSelectNote={setSelectedNoteId}
            onCreateNote={handleCreateNote}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAllVisible={handleSelectAllVisible}
            onClearSelection={handleClearSelection}
            onBulkDelete={handleBulkDelete}
            onBulkArchive={handleBulkArchive}
          />
        </aside>
        <main className={`${!selectedNoteId ? 'hidden' : ''} flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4 lg:block lg:px-10 lg:py-6`}>
          <NoteEditorPane
            key={selectedNote?.id ?? 'none'}
            note={selectedNote}
            folders={folders}
            onMoveToFolder={handleMoveNoteToFolder}
            onUpdateNote={handleEditNote}
            onTogglePinned={handlePin}
            onToggleArchived={handleArchive}
            onDeleteNote={handleDeleteNote}
            onEnsureNote={handleEnsureNote}
            onBack={handleBack}
            onAttachmentAdded={handleAttachmentAdded}
            onAttachmentRemoved={handleAttachmentRemoved}
          />
        </main>
      </div>
    </div>
  )
}
