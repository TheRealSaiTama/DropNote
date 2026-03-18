import { useLiveQuery } from 'dexie-react-hooks'

import { db } from '@/db/dropnote-db'
import type { Note, NoteFilter } from '@/types/note'

export function useNotesLive(filter: NoteFilter, searchQuery: string): Note[] {
  const notes = useLiveQuery(async () => {
    const all = await db.notes.toArray()
    const normalized = searchQuery.trim().toLowerCase()

    let filtered = all.filter((note) => {
      if (note.deletedAt) return false
      if (filter === 'pinned') return note.pinned && !note.archived
      if (filter === 'archived') return note.archived
      return !note.archived
    })

    if (normalized) {
      filtered = filtered.filter((note) => {
        const haystack = [note.title, note.preview, note.content, ...note.tags]
          .join(' ')
          .toLowerCase()
        return haystack.includes(normalized)
      })
    }

    return filtered.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
  }, [filter, searchQuery])

  return notes ?? []
}
