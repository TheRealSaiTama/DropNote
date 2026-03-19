import Dexie, { type Table } from 'dexie'

import type { Attachment, Note } from '@/types/note'

export interface AttachmentBlob {
  storageKey: string
  data: Blob
}

export interface AppMeta {
  key: string
  value: string
}

class DropnoteDB extends Dexie {
  notes!: Table<Note, string>
  attachments!: Table<Attachment, string>
  blobs!: Table<AttachmentBlob, string>
  meta!: Table<AppMeta, string>

  constructor() {
    super('dropnote')
    this.version(1).stores({
      notes: 'id, title, pinned, archived, updatedAt, createdAt, *tags',
      attachments: 'id, noteId, type, name, createdAt',
    })
    this.version(2).stores({
      blobs: 'storageKey',
    })
    this.version(3).stores({
      notes: 'id, title, pinned, archived, updatedAt, createdAt, *tags, syncStatus',
      attachments: 'id, noteId, type, name, createdAt, syncStatus',
    })
    this.version(4).stores({
      attachments: 'id, noteId, type, name, createdAt, syncStatus, deletedAt',
    })
    this.version(5).stores({
      meta: 'key',
    })
    this.version(6).stores({
      attachments: 'id, noteId, type, name, createdAt, syncStatus, deletedAt, mediaStatus',
    })
  }
}

export const db = new DropnoteDB()

export async function resetDatabase() {
  await db.notes.clear()
  await db.attachments.clear()
  await db.blobs.clear()
  await db.meta.clear()
}
