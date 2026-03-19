import { useCallback, useEffect, useRef, useState } from 'react'

import { seedDatabase } from '@/data/seed-data'
import { useAuth } from '@/hooks/use-auth'
import { useNote } from '@/hooks/use-note'
import { useNoteActions } from '@/hooks/use-note-actions'
import { useNotesLive } from '@/hooks/use-notes'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { useSyncStatus } from '@/hooks/use-sync-status'
import { enqueueUpload } from '@/lib/attachment-queue'
import { startRealtime, stopRealtime } from '@/lib/realtime'
import { scheduleSyncDebounced, syncAll } from '@/lib/sync-engine'
import type { Note, NoteFilter } from '@/types/note'

import { NoteEditorPane } from './note-editor-pane'
import { NotesListPane } from './notes-list-pane'
import { TopBar } from './top-bar'

export function AppShell() {
  const [activeFilter, setActiveFilter] = useLocalStorage<NoteFilter>('dropnote.active-filter', 'all')
  const [searchValue, setSearchValue] = useLocalStorage('dropnote.search-value', '')
  const [selectedNoteId, setSelectedNoteId] = useLocalStorage<string | null>('dropnote.selected-note-id', null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const notes = useNotesLive(activeFilter, searchValue)
  const selectedNote = useNote(selectedNoteId)

  const { create, edit, remove, pin, archive, bulkRemove, bulkArchive } = useNoteActions()
  const { user, signIn, signOut } = useAuth()
  const { status: syncStatus, syncNow, failedJobs } = useSyncStatus()

  useEffect(() => {
    if (user) {
      void syncAll(user.id)
      startRealtime(user.id)
    } else {
      stopRealtime()
    }
    return () => stopRealtime()
  }, [user])

  useEffect(() => {
    function handleOnline() {
      if (user) void syncAll(user.id)
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [user])

  const initRef = useRef(false)
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    void seedDatabase()
  }, [])

  const handleCreateNote = async () => {
    const note = await create()
    setSelectedNoteId(note.id)
  }

  const handleEditNote = (noteId: string, changes: Pick<Note, 'title' | 'content'>) => {
    edit(noteId, changes)
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
    if (user) scheduleSyncDebounced(user.id)
  }

  const handleEnsureNote = useCallback(async (): Promise<string> => {
    if (selectedNoteId) return selectedNoteId
    const note = await create()
    setSelectedNoteId(note.id)
    return note.id
  }, [selectedNoteId, create, setSelectedNoteId])

  const handleBack = () => setSelectedNoteId(null)

  const handleAttachmentAdded = useCallback((attachmentId: string) => {
    if (user) {
      enqueueUpload(attachmentId, user.id)
      scheduleSyncDebounced(user.id)
    }
  }, [user])

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
    if (user) scheduleSyncDebounced(user.id)
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
        onSyncNow={() => { if (user) syncNow(user.id) }}
      />

      <div className="flex flex-1 overflow-hidden">
        <aside className={`${selectedNoteId ? 'hidden' : ''} flex-1 overflow-y-auto p-4 lg:block lg:w-[24rem] lg:flex-none lg:border-r`}>
          <NotesListPane
            notes={notes}
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
        <main className={`${!selectedNoteId ? 'hidden' : ''} flex-1 overflow-y-auto px-5 py-4 lg:block lg:px-10 lg:py-6`}>
          <NoteEditorPane
            note={selectedNote}
            onUpdateNote={handleEditNote}
            onTogglePinned={handlePin}
            onToggleArchived={handleArchive}
            onDeleteNote={handleDeleteNote}
            onEnsureNote={handleEnsureNote}
            onBack={handleBack}
            onAttachmentAdded={handleAttachmentAdded}
          />
        </main>
      </div>
    </div>
  )
}
