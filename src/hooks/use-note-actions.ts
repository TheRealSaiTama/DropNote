import { useCallback, useRef } from 'react'

import {
  createNote,
  deleteNote,
  duplicateNote,
  toggleArchived,
  togglePinned,
  updateNote,
} from '@/db/note-actions'
import type { Note } from '@/types/note'

const AUTOSAVE_DELAY_MS = 600

export function useNoteActions() {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleAutosave = useCallback(
    (noteId: string, changes: Pick<Note, 'title' | 'content'>) => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
      }

      saveTimer.current = setTimeout(() => {
        void updateNote(noteId, changes)
      }, AUTOSAVE_DELAY_MS)
    },
    [],
  )

  const create = useCallback(async (): Promise<Note> => {
    return createNote()
  }, [])

  const edit = useCallback(
    (noteId: string, changes: Pick<Note, 'title' | 'content'>) => {
      scheduleAutosave(noteId, changes)
    },
    [scheduleAutosave],
  )

  const remove = useCallback(async (noteId: string) => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
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

  return {
    create,
    edit,
    remove,
    duplicate,
    pin,
    archive,
  }
}
