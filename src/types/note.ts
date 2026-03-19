export type AttachmentType = 'image' | 'gif' | 'audio' | 'file'
export type SyncStatus = 'pending' | 'synced'

export interface Attachment {
  id: string
  noteId: string
  type: AttachmentType
  name: string
  mimeType: string
  size: number
  storageKey: string
  createdAt: string
  deletedAt: string | null
  userId?: string
  remotePath?: string
  syncStatus: SyncStatus
}

export interface Note {
  id: string
  title: string
  content: string
  preview: string
  createdAt: string
  updatedAt: string
  pinned: boolean
  archived: boolean
  tags: string[]
  attachmentsCount: number
  deletedAt: string | null
  userId?: string
  syncStatus: SyncStatus
  isSeed?: boolean
}

export type NoteFilter = 'all' | 'pinned' | 'archived'

export interface NoteWithAttachments extends Note {
  attachments: Attachment[]
}

export type NoteSortKey = 'updatedAt' | 'createdAt' | 'title'
