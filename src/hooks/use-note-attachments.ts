import { useLiveQuery } from 'dexie-react-hooks'

import { db } from '@/db/dropnote-db'
import type { Attachment } from '@/types/note'

export function useNoteAttachments(noteId: string | null | undefined): Attachment[] {
  const result = useLiveQuery<Attachment[]>(
    () =>
      noteId
        ? db.attachments
            .where('noteId')
            .equals(noteId)
            .sortBy('createdAt')
            .then((atts) => atts.filter((a) => !a.deletedAt))
        : Promise.resolve([]),
    [noteId],
  )
  return result ?? []
}
