import { generateId, now } from '@/db/note-actions'
import { db } from '@/db/dropnote-db'
import type { Folder } from '@/types/note'

export async function createFolder(name: string): Promise<Folder> {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error('Folder name is required')
  }
  const folder: Folder = {
    id: generateId(),
    name: trimmed,
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null,
    syncStatus: 'pending',
  }
  await db.folders.add(folder)
  return folder
}

export async function renameFolder(folderId: string, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) return
  const folder = await db.folders.get(folderId)
  if (!folder || folder.deletedAt) return
  await db.folders.update(folderId, {
    name: trimmed,
    updatedAt: now(),
    syncStatus: 'pending' as const,
  })
}

export async function deleteFolder(folderId: string): Promise<void> {
  const folder = await db.folders.get(folderId)
  if (!folder || folder.deletedAt) return

  const ts = now()
  if (folder.userId) {
    await db.transaction('rw', db.folders, db.notes, async () => {
      await db.notes.where('folderId').equals(folderId).modify({
        folderId: null,
        updatedAt: ts,
        syncStatus: 'pending' as const,
      })
      await db.folders.update(folderId, {
        deletedAt: ts,
        updatedAt: ts,
        syncStatus: 'pending' as const,
      })
    })
  } else {
    await db.transaction('rw', db.folders, db.notes, async () => {
      await db.notes.where('folderId').equals(folderId).modify({
        folderId: null,
        updatedAt: ts,
        syncStatus: 'pending' as const,
      })
      await db.folders.delete(folderId)
    })
  }
}
