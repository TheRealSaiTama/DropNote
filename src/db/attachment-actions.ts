import { db } from './dropnote-db'
import { generateId, now } from './note-actions'
import { detectAttachmentType, needsProcessing } from '@/lib/attachment-utils'
import { processAttachment } from '@/lib/media-processor'
import type { Attachment } from '@/types/note'

export async function addAttachment(noteId: string, file: File): Promise<Attachment> {
  const id = generateId()
  const storageKey = id
  const type = detectAttachmentType(file)

  const attachment: Attachment = {
    id,
    noteId,
    type,
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    storageKey,
    createdAt: now(),
    deletedAt: null,
    syncStatus: 'pending' as const,
    originalMime: file.type || 'application/octet-stream',
    mediaStatus: 'uploaded',
  }

  await db.transaction('rw', db.attachments, db.blobs, db.notes, async () => {
    await db.blobs.add({ storageKey, data: file })
    await db.attachments.add(attachment)
    await db.notes
      .where('id')
      .equals(noteId)
      .modify((note) => {
        note.attachmentsCount = (note.attachmentsCount ?? 0) + 1
      })
  })

  if (needsProcessing(attachment)) {
    void processAttachment(id)
  }

  return attachment
}

export async function removeAttachment(attachmentId: string): Promise<void> {
  const att = await db.attachments.get(attachmentId)
  if (!att) return

  if (att.userId) {
    await db.transaction('rw', db.attachments, db.notes, async () => {
      await db.attachments.update(attachmentId, {
        deletedAt: now(),
        syncStatus: 'pending' as const,
      })
      await db.notes
        .where('id')
        .equals(att.noteId)
        .modify((note) => {
          note.attachmentsCount = Math.max(0, (note.attachmentsCount ?? 0) - 1)
        })
    })
  } else {
    await db.transaction('rw', db.attachments, db.blobs, db.notes, async () => {
      await db.blobs.delete(att.storageKey)
      if (att.previewStorageKey) await db.blobs.delete(att.previewStorageKey)
      await db.attachments.delete(attachmentId)
      await db.notes
        .where('id')
        .equals(att.noteId)
        .modify((note) => {
          note.attachmentsCount = Math.max(0, (note.attachmentsCount ?? 0) - 1)
        })
    })
  }
}

export async function getAttachmentBlob(storageKey: string): Promise<Blob | undefined> {
  const record = await db.blobs.get(storageKey)
  return record?.data
}
