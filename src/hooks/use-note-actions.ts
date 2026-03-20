import { useCallback, useRef } from 'react'

import {
  createNote,
  deleteNote,
  duplicateNote,
  toggleArchived,
  togglePinned,
  updateNote,
  bulkDeleteNotes,
  bulkArchiveNotes,
} from '@/db/note-actions'
import type { Note } from '@/types/note'

const AUTOSAVE_DELAY_MS = 600

export function useNoteActions() {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingEdit = useRef<{
    noteId: string
    changes: Pick<Note, 'title' | 'content'>
    onSaved?: (changes: Pick<Note, 'title' | 'content'>) => void
  } | null>(null)

  const flushPendingEdit = useCallback(async () => {
    if (!pendingEdit.current) return

    const pending = pendingEdit.current
    pendingEdit.current = null

    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }

    await updateNote(pending.noteId, pending.changes)
    pending.onSaved?.(pending.changes)
  }, [])

  const scheduleAutosave = useCallback(
    (
      noteId: string,
      changes: Pick<Note, 'title' | 'content'>,
      onSaved?: (changes: Pick<Note, 'title' | 'content'>) => void,
    ) => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
      }

      pendingEdit.current = { noteId, changes, onSaved }
      saveTimer.current = setTimeout(() => {
        const pending = pendingEdit.current
        pendingEdit.current = null
        saveTimer.current = null
        if (!pending) return
        void updateNote(pending.noteId, pending.changes).then(() => {
          pending.onSaved?.(pending.changes)
        })
      }, AUTOSAVE_DELAY_MS)
    },
    [],
  )

  const create = useCallback(async (): Promise<Note> => {
    return createNote()
  }, [])

  const edit = useCallback(
    (
      noteId: string,
      changes: Pick<Note, 'title' | 'content'>,
      onSaved?: (changes: Pick<Note, 'title' | 'content'>) => void,
    ) => {
      scheduleAutosave(noteId, changes, onSaved)
    },
    [scheduleAutosave],
  )

  const remove = useCallback(async (noteId: string) => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    pendingEdit.current = null
    await deleteNote(noteId)
  }, [])

  const duplicate = useCallback(async (noteId: string) => {
    return duplicateNote(noteId)
  }, [])

  const pin = useCallback(async (noteId: string) => {
    await togglePinned(noteId)
  }, [])

  const archive = useCallback(async (noteId: string) => {
    await toggleArchived(noteId)
  }, [])

  const bulkRemove = useCallback(async (noteIds: string[]) => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    pendingEdit.current = null
    await bulkDeleteNotes(noteIds)
  }, [])

  const bulkArchive = useCallback(async (noteIds: string[], archived: boolean) => {
    await bulkArchiveNotes(noteIds, archived)
  }, [])

  return {
    create,
    edit,
    remove,
    duplicate,
    pin,
    archive,
    bulkRemove,
    bulkArchive,
    flushPendingEdit,
  }
}
