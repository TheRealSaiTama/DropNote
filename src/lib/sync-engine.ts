import { db } from '@/db/dropnote-db'
import { supabase, hasSupabaseEnv } from './supabase'
import type { Attachment, Note } from '@/types/note'

export type SyncEngineStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline'

const DEV = import.meta.env.DEV

function syncLog(...args: unknown[]) {
  if (DEV) console.log('[sync]', ...args)
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

export function scheduleSyncDebounced(userId: string, delayMs = 4000): void {
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
    attachments_count: note.attachmentsCount ?? 0,
    created_at: note.createdAt,
    updated_at: note.updatedAt,
    deleted_at: note.deletedAt,
  }
}

function remoteToNote(r: Record<string, unknown>): Note {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    title: r.title as string,
    content: r.content as string,
    preview: r.preview as string,
    pinned: r.pinned as boolean,
    archived: r.archived as boolean,
    tags: r.tags as string[],
    attachmentsCount: (r.attachments_count as number) ?? 0,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    deletedAt: (r.deleted_at as string) ?? null,
    syncStatus: 'synced',
  }
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
  }
}

function remoteToAtt(r: Record<string, unknown>): Attachment {
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
  }
}

async function deleteLocalNote(noteId: string) {
  const atts = await db.attachments.where('noteId').equals(noteId).toArray()
  await db.blobs.bulkDelete(atts.map((a) => a.storageKey))
  await db.attachments.where('noteId').equals(noteId).delete()
  await db.notes.delete(noteId)
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
    if (error) syncLog('storage cleanup error for note', noteId, error)
  }
  await supabase!.from('attachments').delete().eq('note_id', noteId)
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
      const remoteTime = new Date(r.updated_at as string).getTime()

      if (!local) {
        if (r.deleted_at) continue
        await db.notes.add(remoteToNote(r))
      } else if (remoteTime > new Date(local.updatedAt).getTime()) {
        if (r.deleted_at) {
          await deleteLocalNote(r.id as string)
        } else {
          await db.notes.update(r.id as string, remoteToNote(r) as Partial<Note>)
        }
      }
      // Local is newer or equal — local wins, will be pushed in pushNotes
    } catch (err) {
      syncLog('error pulling note', r.id, err)
    }
  }
}

async function pushNotes(userId: string) {
  const pending = await db.notes.filter((n) => n.syncStatus !== 'synced').toArray()
  syncLog('pushing notes', pending.length)

  for (const note of pending) {
    try {
      const { error } = await supabase!.from('notes').upsert(noteToRemote(note, userId))
      if (error) {
        syncLog('push note error', note.id, error)
        continue
      }

      if (note.deletedAt) {
        await cleanupRemoteAttachmentsForNote(note.id)
        await deleteLocalNote(note.id)
      } else {
        await db.notes.update(note.id, { syncStatus: 'synced', userId })
      }
    } catch (err) {
      syncLog('error pushing note', note.id, err)
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
      const local = await db.attachments.get(r.id as string)
      if (local && !local.deletedAt) {
        await db.blobs.delete(local.storageKey)
        await db.attachments.delete(local.id)
        syncLog('applied remote attachment tombstone', r.id)
      }
      continue
    }
    try {
      const local = await db.attachments.get(r.id as string)

      if (local) {
        if (!r.remote_path) continue
        const blobExists = await db.blobs.get(local.storageKey)
        if (blobExists) continue

        const { data: blobData, error: dlErr } = await supabase!.storage
          .from('attachments')
          .download(r.remote_path as string)
        if (blobData && !dlErr) {
          await db.blobs.put({ storageKey: local.storageKey, data: blobData })
          syncLog('re-downloaded missing blob', r.id)
        } else {
          syncLog('blob re-download error', r.id, dlErr)
        }
        continue
      }

      const att = remoteToAtt(r)
      await db.attachments.add(att)

      if (r.remote_path) {
        const { data: blobData, error: dlErr } = await supabase!.storage
          .from('attachments')
          .download(r.remote_path as string)
        if (blobData && !dlErr) {
          await db.blobs.put({ storageKey: att.storageKey, data: blobData })
          syncLog('downloaded blob', r.id)
        } else {
          syncLog('blob download error', r.id, dlErr)
        }
      }
    } catch (err) {
      syncLog('error pulling attachment', r.id, err)
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
        if (att.remotePath) {
          await supabase!.storage.from('attachments').remove([att.remotePath])
        }
        const { error } = await supabase!.from('attachments').upsert(attToRemote(att, userId))
        if (!error) {
          await db.blobs.delete(att.storageKey)
          await db.attachments.delete(att.id)
          syncLog('pushed tombstone attachment', att.id)
        } else {
          syncLog('tombstone push error', att.id, error)
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
      syncLog('error pushing attachment', att.id, err)
    }
  }
}

/*
 * Merge strategy: last-write-wins on updatedAt.
 *
 * Pull runs before push. During pull:
 *   - Remote note with newer updatedAt overwrites local (even if local is 'pending').
 *   - Local note with newer or equal updatedAt is kept and will be pushed.
 *   - Remote tombstone (deleted_at set) with newer updatedAt deletes locally.
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
  if (isSyncing) return
  if (!navigator.onLine) {
    setStatus('offline')
    return
  }

  isSyncing = true
  setStatus('syncing')
  syncLog('sync started', userId)

  try {
    await cleanupLegacySeeds(userId)
    await pullNotes(userId)
    await pushNotes(userId)
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
