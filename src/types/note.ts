export type AttachmentType = 'image' | 'gif' | 'audio' | 'video' | 'file'
export type SyncStatus = 'pending' | 'synced'
export type AttachmentJobState = 'idle' | 'uploading' | 'downloading' | 'done' | 'failed'
export type MediaStatus = 'uploaded' | 'processing' | 'ready' | 'failed'

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
  mediaStatus?: MediaStatus
  previewStorageKey?: string
  previewPath?: string
  previewMime?: string
  originalMime?: string
  width?: number
  height?: number
  duration?: number
  errorCode?: string
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
