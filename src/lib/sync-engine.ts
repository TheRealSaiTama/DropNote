import { db } from '@/db/dropnote-db'
import { supabase, hasSupabaseEnv } from './supabase'
import { enqueueDownload } from './attachment-queue'
import type { Attachment, Folder, Note, MediaStatus } from '@/types/note'

export type SyncEngineStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline'

const DEV = import.meta.env.DEV

function syncLog(...args: unknown[]) {
  if (DEV) console.log('[sync]', ...args)
}

function arraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function noteSnapshotsEqual(local: Note, remote: Note) {
  return (
    local.title === remote.title
    && local.content === remote.content
    && local.preview === remote.preview
    && local.pinned === remote.pinned
    && local.archived === remote.archived
    && local.attachmentsCount === remote.attachmentsCount
    && local.deletedAt === remote.deletedAt
    && local.folderId === remote.folderId
    && arraysEqual(local.tags, remote.tags)
  )
}

export function shouldApplyRemoteNote(local: Note, remote: Note): boolean {
  if (local.syncStatus !== 'synced') {
    return new Date(remote.updatedAt).getTime() > new Date(local.updatedAt).getTime()
  }

  return !noteSnapshotsEqual(local, remote) || remote.updatedAt !== local.updatedAt
}

let status: SyncEngineStatus = 'idle'
const listeners = new Set<(s: SyncEngineStatus) => void>()
let isSyncing = false
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function setStatus(s: SyncEngineStatus) {
  status = s
  listeners.forEach((fn) => fn(s))
}

export function getSyncStatus(): SyncEngineStatus {
  return status
}

export function subscribeSyncStatus(fn: (s: SyncEngineStatus) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function scheduleSyncDebounced(userId: string, delayMs = 1000): void {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void syncAll(userId)
  }, delayMs)
}

export function getSyncDiagnostics() {
  return {
    status,
    isSyncing,
    hasPendingDebounce: debounceTimer !== null,
    online: navigator.onLine,
  }
}

export async function getNoteDiagnostics(noteId: string) {
  const note = await db.notes.get(noteId)
  if (!note) return { exists: false }
  const atts = await db.attachments.where('noteId').equals(noteId).toArray()
  return {
    exists: true,
    id: note.id,
    updatedAt: note.updatedAt,
    deletedAt: note.deletedAt,
    syncStatus: note.syncStatus,
    title: note.title?.slice(0, 40),
    contentLen: note.content?.length ?? 0,
    attachments: atts.map((a) => ({
      id: a.id,
      deletedAt: a.deletedAt,
      syncStatus: a.syncStatus,
      mediaStatus: a.mediaStatus,
      hasBlob: true,
    })),
  }
}

export async function forceResyncNote(noteId: string) {
  if (!hasSupabaseEnv || !supabase) return
  syncLog('[diagnostic] force resync note', noteId)
  const { data, error } = await supabase.from('notes').select('*').eq('id', noteId).single()
  if (error || !data) {
    syncLog('[diagnostic] force resync failed', error)
    return
  }
  const remote = remoteToNote(data)
  await db.notes.update(noteId, remote as Partial<Note>)
  syncLog('[diagnostic] force resync applied', noteId, remote.updatedAt)

  const { data: attData } = await supabase.from('attachments').select('*').eq('note_id', noteId)
  if (attData) {
    for (const r of attData) {
      if (r.deleted_at) {
        await deleteLocalAttachment(r.id as string)
        continue
      }
      const local = await db.attachments.get(r.id as string)
      if (!local) {
        const att = remoteToAtt(r)
        await db.attachments.add(att)
        if (r.remote_path) {
          syncLog('[diagnostic] force resync downloading attachment blob', att.id)
        }
      }
    }
  }
  syncLog('[diagnostic] force resync complete for note', noteId)
}

function noteToRemote(note: Note, userId: string) {
  return {
    id: note.id,
    user_id: userId,
    title: note.title,
    content: note.content,
    preview: note.preview,
    pinned: note.pinned,
    archived: note.archived,
    tags: note.tags,
    folder_id: note.folderId ?? null,
    attachments_count: note.attachmentsCount ?? 0,
    created_at: note.createdAt,
    updated_at: note.updatedAt,
    deleted_at: note.deletedAt,
  }
}

export function remoteToNote(r: Record<string, unknown>): Note {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    title: r.title as string,
    content: r.content as string,
    preview: r.preview as string,
    pinned: r.pinned as boolean,
    archived: r.archived as boolean,
    tags: r.tags as string[],
    folderId: (r.folder_id as string) ?? null,
    attachmentsCount: (r.attachments_count as number) ?? 0,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    deletedAt: (r.deleted_at as string) ?? null,
    syncStatus: 'synced',
  }
}

function folderToRemote(folder: Folder, userId: string) {
  return {
    id: folder.id,
    user_id: userId,
    name: folder.name,
    created_at: folder.createdAt,
    updated_at: folder.updatedAt,
    deleted_at: folder.deletedAt,
  }
}

export function remoteToFolder(r: Record<string, unknown>): Folder {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    name: r.name as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    deletedAt: (r.deleted_at as string) ?? null,
    syncStatus: 'synced',
  }
}

export function shouldApplyRemoteFolder(local: Folder | undefined, remote: Folder): boolean {
  if (!local) return true
  if (local.syncStatus !== 'synced') {
    return new Date(remote.updatedAt).getTime() > new Date(local.updatedAt).getTime()
  }
  return local.name !== remote.name || local.deletedAt !== remote.deletedAt || remote.updatedAt !== local.updatedAt
}

function attToRemote(att: Attachment, userId: string) {
  return {
    id: att.id,
    note_id: att.noteId,
    user_id: userId,
    type: att.type,
    name: att.name,
    mime_type: att.mimeType,
    size: att.size,
    remote_path: att.remotePath ?? null,
    created_at: att.createdAt,
    deleted_at: att.deletedAt ?? null,
    media_status: att.mediaStatus ?? 'uploaded',
    preview_path: att.previewPath ?? null,
    preview_mime: att.previewMime ?? null,
    width: att.width ?? null,
    height: att.height ?? null,
    duration: att.duration ?? null,
    error_code: att.errorCode ?? null,
  }
}

export function remoteToAtt(r: Record<string, unknown>): Attachment {
  return {
    id: r.id as string,
    noteId: r.note_id as string,
    userId: r.user_id as string,
    type: r.type as Attachment['type'],
    name: r.name as string,
    mimeType: r.mime_type as string,
    size: r.size as number,
    storageKey: r.id as string,
    remotePath: (r.remote_path as string) ?? undefined,
    createdAt: r.created_at as string,
    deletedAt: (r.deleted_at as string) ?? null,
    syncStatus: 'synced',
    mediaStatus: (r.media_status as MediaStatus) ?? 'uploaded',
    previewPath: (r.preview_path as string) ?? undefined,
    previewMime: (r.preview_mime as string) ?? undefined,
    width: (r.width as number) ?? undefined,
    height: (r.height as number) ?? undefined,
    duration: (r.duration as number) ?? undefined,
    errorCode: (r.error_code as string) ?? undefined,
  }
}

export async function deleteLocalNote(noteId: string) {
  const atts = await db.attachments.where('noteId').equals(noteId).toArray()
  const blobKeys = atts.flatMap((a) => [a.storageKey, ...(a.previewStorageKey ? [a.previewStorageKey] : [])])
  await db.blobs.bulkDelete(blobKeys)
  await db.attachments.where('noteId').equals(noteId).delete()
  await db.notes.delete(noteId)
}

export async function deleteLocalAttachment(attachmentId: string) {
  await db.blobs.delete(attachmentId)
  await db.blobs.delete(`${attachmentId}-preview`)
  await db.attachments.delete(attachmentId)
}

export async function deleteLocalFolder(folderId: string) {
  const ts = new Date().toISOString()
  await db.transaction('rw', db.folders, db.notes, async () => {
    await db.notes.where('folderId').equals(folderId).modify({
      folderId: null,
      updatedAt: ts,
      syncStatus: 'pending' as const,
    })
    await db.folders.delete(folderId)
  })
}

async function pullFolders(userId: string) {
  const { data, error } = await supabase!.from('folders').select('*').eq('user_id', userId)
  if (error || !data) {
    syncLog('pullFolders error', error)
    return
  }
  syncLog('pulling folders', data.length)

  for (const r of data) {
    try {
      const local = await db.folders.get(r.id as string)
      const remote = remoteToFolder(r)

      if (r.deleted_at) {
        if (local) {
          await deleteLocalFolder(r.id as string)
        }
        continue
      }

      if (!local) {
        await db.folders.add(remote)
        continue
      }

      if (shouldApplyRemoteFolder(local, remote)) {
        await db.folders.update(r.id as string, remote as Partial<Folder>)
      }
    } catch (err) {
      syncLog('pull folder failure', r.id, err)
    }
  }
}

async function pushFolders(userId: string) {
  const pending = await db.folders.filter((f) => f.syncStatus !== 'synced').toArray()
  syncLog('pushing folders', pending.length)

  for (const folder of pending) {
    try {
      if (folder.deletedAt) {
        syncLog('[delete] pushing tombstone folder', folder.id)
      }
      const { error } = await supabase!.from('folders').upsert(folderToRemote(folder, userId))
      if (error) {
        if (folder.deletedAt) syncLog('[delete] remote folder tombstone push failed', folder.id, error)
        else syncLog('push folder error', folder.id, error)
        continue
      }

      if (folder.deletedAt) {
        await deleteLocalFolder(folder.id)
        syncLog('[delete] remote folder tombstone pushed', folder.id)
      } else {
        await db.folders.update(folder.id, { syncStatus: 'synced', userId })
      }
    } catch (err) {
      if (folder.deletedAt) syncLog('[delete] push tombstone folder failure', folder.id, err)
      else syncLog('error pushing folder', folder.id, err)
    }
  }
}

async function cleanupRemoteAttachmentsForNote(noteId: string) {
  const { data } = await supabase!
    .from('attachments')
    .select('id, remote_path')
    .eq('note_id', noteId)
  if (!data || data.length === 0) return

  const paths = data.filter((a) => a.remote_path).map((a) => a.remote_path as string)
  if (paths.length > 0) {
    const { error } = await supabase!.storage.from('attachments').remove(paths)
    if (error) syncLog('[delete] remote storage cleanup error for note', noteId, error)
  }
  const { error } = await supabase!.from('attachments').delete().eq('note_id', noteId)
  if (error) syncLog('[delete] remote attachment row cleanup error for note', noteId, error)
}


async function pullNotes(userId: string) {
  const { data, error } = await supabase!.from('notes').select('*').eq('user_id', userId)
  if (error || !data) {
    syncLog('pullNotes error', error)
    return
  }
  syncLog('pulling notes', data.length)

  for (const r of data) {
    try {
      const local = await db.notes.get(r.id as string)
      const remote = remoteToNote(r)

      if (r.deleted_at) {
        syncLog('[delete] pull applied tombstone', r.id)
        await deleteLocalNote(r.id as string)
        continue
      }

      if (local?.deletedAt) {
        syncLog('[delete] keeping local note tombstone pending', r.id)
        continue
      }

      if (!local) {
        await db.notes.add(remote)
        continue
      }

      if (shouldApplyRemoteNote(local, remote)) {
        await db.notes.update(r.id as string, remote as Partial<Note>)
        if (DEV) syncLog('[diagnostic] pull reconciled note', r.id, {
          remoteTime: remote.updatedAt,
          localTime: local.updatedAt,
          remoteContent: remote.content.slice(0, 40),
          localSyncStatus: local.syncStatus,
        })
      }
      // Pending local edits keep winning unless the remote note is clearly newer.
    } catch (err) {
      syncLog('[delete] pull note failure', r.id, err)
    }
  }
}

async function pushNotes(userId: string) {
  const pending = await db.notes.filter((n) => n.syncStatus !== 'synced').toArray()
  syncLog('pushing notes', pending.length)

  for (const note of pending) {
    try {
      if (note.deletedAt) {
        syncLog('[delete] pushing tombstone note', note.id)
      }
      const { error } = await supabase!.from('notes').upsert(noteToRemote(note, userId))
      if (error) {
        if (note.deletedAt) syncLog('[delete] remote tombstone push failed', note.id, error)
        else syncLog('push note error', note.id, error)
        continue
      }

      if (note.deletedAt) {
        syncLog('[delete] remote tombstone pushed', note.id)
        await cleanupRemoteAttachmentsForNote(note.id)
        await deleteLocalNote(note.id)
        syncLog('[delete] cleanup finished', note.id)
      } else {
        await db.notes.update(note.id, { syncStatus: 'synced', userId })
      }
    } catch (err) {
      if (note.deletedAt) syncLog('[delete] push tombstone note failure', note.id, err)
      else syncLog('error pushing note', note.id, err)
    }
  }
}

async function pullAttachments(userId: string) {
  const { data, error } = await supabase!.from('attachments').select('*').eq('user_id', userId)
  if (error || !data) {
    syncLog('pullAttachments error', error)
    return
  }
  syncLog('pulling attachments', data.length)

  for (const r of data) {
    if (r.deleted_at) {
      syncLog('[delete] pull applied attachment tombstone', r.id)
      await deleteLocalAttachment(r.id as string)
      continue
    }
    try {
      const local = await db.attachments.get(r.id as string)

      if (local?.deletedAt) {
        syncLog('[delete] keeping local attachment tombstone pending', r.id)
        continue
      }

      if (local) {
        if (r.remote_path) {
          const blobExists = await db.blobs.get(local.storageKey)
          if (!blobExists) {
            enqueueDownload(local.id, r.remote_path as string)
            syncLog('queued missing blob download', r.id)
          }
        }

        if (r.preview_path && !local.previewStorageKey) {
          const previewKey = local.id + '-preview'
          enqueueDownload(previewKey, r.preview_path as string)
          await db.attachments.update(local.id, {
            previewStorageKey: previewKey,
            previewPath: r.preview_path as string,
            previewMime: (r.preview_mime as string) ?? undefined,
            mediaStatus: 'ready',
            width: (r.width as number) ?? undefined,
            height: (r.height as number) ?? undefined,
            duration: (r.duration as number) ?? undefined,
          })
          syncLog('queued preview download for existing', r.id)
        }
        continue
      }

      const att = remoteToAtt(r)
      await db.attachments.add(att)

      if (r.remote_path) {
        enqueueDownload(att.id, r.remote_path as string)
        syncLog('queued blob download', r.id)
      }
      if (r.preview_path && att.mediaStatus === 'ready') {
        const previewKey = att.id + '-preview'
        enqueueDownload(previewKey, r.preview_path as string)
        await db.attachments.update(att.id, { previewStorageKey: previewKey })
        syncLog('queued preview download', r.id)
      }
    } catch (err) {
      syncLog('[delete] pull attachment failure', r.id, err)
    }
  }
}

async function pushAttachments(userId: string) {
  const pending = await db.attachments.filter((a) => a.syncStatus !== 'synced').toArray()
  syncLog('pushing attachments', pending.length)

  for (const att of pending) {
    try {
      if (!att.remotePath) {
        const blobRecord = await db.blobs.get(att.storageKey)
        if (blobRecord) {
          const path = `${userId}/${att.id}/${att.name}`
          const { error: uploadErr } = await supabase!.storage
            .from('attachments')
            .upload(path, blobRecord.data, { upsert: true })
          if (uploadErr) {
            syncLog('blob upload error', att.id, uploadErr)
            continue
          }
          await db.attachments.update(att.id, { remotePath: path })
          att.remotePath = path
        }
      }

      if (att.deletedAt) {
        syncLog('[delete] pushing tombstone attachment', att.id)
        if (att.remotePath) {
          const { error: storageError } = await supabase!.storage.from('attachments').remove([att.remotePath])
          if (storageError) {
            syncLog('[delete] remote attachment storage cleanup failed', att.id, storageError)
          }
        }
        const { error } = await supabase!.from('attachments').upsert(attToRemote(att, userId))
        if (!error) {
          await deleteLocalAttachment(att.id)
          syncLog('[delete] remote attachment tombstone pushed', att.id)
          syncLog('[delete] cleanup finished attachment', att.id)
        } else {
          syncLog('[delete] remote attachment tombstone push failed', att.id, error)
        }
        continue
      }

      const { error } = await supabase!.from('attachments').upsert(attToRemote(att, userId))
      if (!error) {
        await db.attachments.update(att.id, { syncStatus: 'synced', userId })
      } else {
        syncLog('attachment metadata push error', att.id, error)
      }
    } catch (err) {
      syncLog('[delete] push attachment failure', att.id, err)
    }
  }
}

/*
 * Merge strategy: last-write-wins on updatedAt.
 *
 * Pull runs before push. During pull:
 *   - Remote tombstone (deleted_at set) always deletes locally.
 *   - Remote active note with newer updatedAt overwrites local.
 *   - Local active note with newer or equal updatedAt is kept and will be pushed.
 *
 * This means: if two devices edit the same note offline, the one that syncs last wins.
 * The losing device's changes are silently discarded on next pull. This is intentional
 * and documented. For a local-first personal-use app, this is an acceptable tradeoff.
 *
 * First device: all local notes are 'pending', pushed to empty remote.
 * Second device: remote notes pulled first, then local pending pushed (only truly local ones).
 */
const LEGACY_SEED_TITLES = [
  'Arrival board for the Kyoto weekender',
  'Studio reset before Monday',
  'Voice fragments worth transcribing',
  'Capsule wardrobe shortlist',
  'Reading stack for quiet Sundays',
  'Kitchen loop playlist ideas',
]

async function cleanupLegacySeeds(userId: string) {
  const flag = await db.meta.get('hasCleanedLegacySeeds')
  if (flag) return

  const localNotes = await db.notes.toArray()
  const seedNotes = localNotes.filter((n) => n.isSeed || LEGACY_SEED_TITLES.includes(n.title))

  for (const note of seedNotes) {
    await deleteLocalNote(note.id)
    syncLog('cleaned up local seed note', note.title)
  }

  const { error } = await supabase!
    .from('notes')
    .delete()
    .eq('user_id', userId)
    .in('title', LEGACY_SEED_TITLES)

  if (error) {
    syncLog('remote seed cleanup error', error)
    return
  }

  syncLog('cleaned up remote seed notes')
  await db.meta.put({ key: 'hasCleanedLegacySeeds', value: 'true' })
}

export async function syncAll(userId: string): Promise<void> {
  if (!hasSupabaseEnv) return
  if (isSyncing) {
    scheduleSyncDebounced(userId, 500)
    return
  }
  if (!navigator.onLine) {
    setStatus('offline')
    return
  }

  isSyncing = true
  setStatus('syncing')
  syncLog('sync started', userId)

  try {
    await cleanupLegacySeeds(userId)
    await pullFolders(userId)
    await pullNotes(userId)
    await pushNotes(userId)
    await pushFolders(userId)
    await pullAttachments(userId)
    await pushAttachments(userId)
    setStatus('synced')
    syncLog('sync complete')
  } catch (err) {
    syncLog('sync fatal error', err)
    setStatus('error')
  } finally {
    isSyncing = false
  }
}
