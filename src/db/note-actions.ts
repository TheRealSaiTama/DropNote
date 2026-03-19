import { nanoid } from 'nanoid'

import { db } from './dropnote-db'
import type { Note, NoteWithAttachments } from '@/types/note'

export function generateId() {
  return nanoid(12)
}

export function buildPreview(content: string): string {
  return content.replace(/\s+/g, ' ').trim().slice(0, 120)
}

export function now(): string {
  return new Date().toISOString()
}

export async function createNote(overrides?: Partial<Note>): Promise<Note> {
  const note: Note = {
    id: generateId(),
    title: '',
    content: '',
    preview: '',
    createdAt: now(),
    updatedAt: now(),
    pinned: false,
    archived: false,
    tags: [],
    attachmentsCount: 0,
    deletedAt: null,
    syncStatus: 'pending',
    ...overrides,
  }

  await db.notes.add(note)
  return note
}

export async function updateNote(
  noteId: string,
  changes: Partial<Pick<Note, 'title' | 'content' | 'pinned' | 'archived' | 'tags'>>,
): Promise<void> {
  const update: Partial<Note> = {
    updatedAt: now(),
    syncStatus: 'pending' as const,
    ...changes,
  }

  if ('content' in update) {
    update.preview = buildPreview(update.content ?? '')
  }

  await db.notes.update(noteId, update)
}

export async function deleteNote(noteId: string): Promise<void> {
  const note = await db.notes.get(noteId)
  if (!note) return

  if (note.userId) {
    await db.transaction('rw', db.notes, db.attachments, db.blobs, async () => {
      const atts = await db.attachments.where('noteId').equals(noteId).toArray()
      await db.blobs.bulkDelete(atts.map((a) => a.storageKey))
      await db.attachments.where('noteId').equals(noteId).delete()
      await db.notes.update(noteId, { deletedAt: now(), syncStatus: 'pending' })
    })
  } else {
    await db.transaction('rw', db.notes, db.attachments, db.blobs, async () => {
      const atts = await db.attachments.where('noteId').equals(noteId).toArray()
      await db.blobs.bulkDelete(atts.map((a) => a.storageKey))
      await db.attachments.where('noteId').equals(noteId).delete()
      await db.notes.delete(noteId)
    })
  }
}

export async function duplicateNote(noteId: string): Promise<Note> {
  const source = await db.notes.get(noteId)
  if (!source) {
    throw new Error(`Note ${noteId} not found`)
  }

  const attachments = (await db.attachments.where('noteId').equals(noteId).toArray()).filter(
    (a) => !a.deletedAt,
  )

  const newNote: Note = {
    ...source,
    id: generateId(),
    title: `${source.title} (copy)`,
    attachmentsCount: attachments.length,
    createdAt: now(),
    updatedAt: now(),
    syncStatus: 'pending' as const,
  }

  await db.transaction('rw', db.notes, db.attachments, db.blobs, async () => {
    await db.notes.add(newNote)
    for (const att of attachments) {
      const newAttId = generateId()
      const blob = await db.blobs.get(att.storageKey)
      if (blob) {
        await db.blobs.add({ storageKey: newAttId, data: blob.data })
      }
      await db.attachments.add({
        ...att,
        id: newAttId,
        storageKey: newAttId,
        noteId: newNote.id,
        createdAt: now(),
        deletedAt: null,
      })
    }
  })

  return newNote
}

export async function togglePinned(noteId: string): Promise<void> {
  const note = await db.notes.get(noteId)
  if (!note) return
  await db.notes.update(noteId, { pinned: !note.pinned, updatedAt: now(), syncStatus: 'pending' as const })
}

export async function toggleArchived(noteId: string): Promise<void> {
  const note = await db.notes.get(noteId)
  if (!note) return
  await db.notes.update(noteId, { archived: !note.archived, updatedAt: now(), syncStatus: 'pending' as const })
}

export async function addTag(noteId: string, tag: string): Promise<void> {
  const note = await db.notes.get(noteId)
  if (!note || note.tags.includes(tag)) return
  await db.notes.update(noteId, { tags: [...note.tags, tag], updatedAt: now(), syncStatus: 'pending' as const })
}

export async function removeTag(noteId: string, tag: string): Promise<void> {
  const note = await db.notes.get(noteId)
  if (!note) return
  await db.notes.update(noteId, { tags: note.tags.filter((t) => t !== tag), updatedAt: now(), syncStatus: 'pending' as const })
}

export async function getNoteWithAttachments(noteId: string): Promise<NoteWithAttachments | null> {
  const note = await db.notes.get(noteId)
  if (!note) return null

  const attachments = await db.attachments.where('noteId').equals(noteId).toArray()
  return { ...note, attachments }
}

export async function getNotesCount(): Promise<number> {
  return db.notes.count()
}

export async function bulkDeleteNotes(noteIds: string[]): Promise<void> {
  for (const noteId of noteIds) {
    await deleteNote(noteId)
  }
}

export async function bulkArchiveNotes(noteIds: string[], archived: boolean): Promise<void> {
  const timestamp = now()
  await db.notes.where('id').anyOf(noteIds).modify({
    archived,
    updatedAt: timestamp,
    syncStatus: 'pending' as const,
  })
}
