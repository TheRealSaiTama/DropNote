import { useLiveQuery } from 'dexie-react-hooks'

import { db } from '@/db/dropnote-db'

export function useNote(noteId: string | null) {
  return useLiveQuery(
    async () => {
      if (!noteId) return null
      return db.notes.get(noteId) ?? null
    },
    [noteId],
    null,
  )
}
