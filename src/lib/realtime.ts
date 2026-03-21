import type { RealtimeChannel } from '@supabase/supabase-js'
import { db } from '@/db/dropnote-db'
import { supabase, hasSupabaseEnv } from './supabase'
import {
  remoteToNote,
  remoteToAtt,
  remoteToFolder,
  deleteLocalNote,
  deleteLocalFolder,
  deleteLocalAttachment,
  shouldApplyRemoteNote,
  shouldApplyRemoteFolder,
} from './sync-engine'
import { enqueueDownload } from './attachment-queue'
import type { Folder, Note } from '@/types/note'

function rtLog(...args: unknown[]) {
  if (import.meta.env.DEV) {
    console.log('[realtime]', ...args)
  }
}

let channel: RealtimeChannel | null = null

function getPayloadRecord(payload: Record<string, unknown>): Record<string, unknown> | undefined {
  const eventType = String(payload.eventType ?? '')
  if (eventType === 'DELETE') {
    return (payload.old as Record<string, unknown> | undefined) ?? (payload.new as Record<string, unknown> | undefined)
  }
  return (payload.new as Record<string, unknown> | undefined) ?? (payload.old as Record<string, unknown> | undefined)
}

export function startRealtime(userId: string): void {
  if (!hasSupabaseEnv || !supabase) return

  stopRealtime()

  channel = supabase
    .channel(`sync-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${userId}` },
      handleNoteChange,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'attachments', filter: `user_id=eq.${userId}` },
      handleAttachmentChange,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'folders', filter: `user_id=eq.${userId}` },
      handleFolderChange,
    )
    .subscribe()

  rtLog('subscribed for', userId)
}

export function stopRealtime(): void {
  if (channel) {
    supabase?.removeChannel(channel)
    channel = null
  }
}

async function handleFolderChange(payload: Record<string, unknown>) {
  const eventType = String(payload.eventType ?? '')
  const r = getPayloadRecord(payload)
  if (!r || !r.id) return

  rtLog(eventType, 'folder', r.id)

  try {
    const remote = remoteToFolder(r)
    const local = await db.folders.get(remote.id)

    if (eventType === 'DELETE') {
      if (local) {
        await deleteLocalFolder(remote.id)
        rtLog('realtime folder hard delete', remote.id)
      }
      return
    }

    if (remote.deletedAt) {
      rtLog('realtime folder tombstone', remote.id)
      if (local) await deleteLocalFolder(remote.id)
      return
    }

    if (!local) {
      await db.folders.add(remote)
      return
    }

    if (!shouldApplyRemoteFolder(local, remote)) return

    await db.folders.update(remote.id, remote as Partial<Folder>)
  } catch (err) {
    rtLog('error handling folder change', err)
  }
}

async function handleNoteChange(payload: Record<string, unknown>) {
  const eventType = String(payload.eventType ?? '')
  const r = getPayloadRecord(payload)
  if (!r || !r.id) return

  rtLog(eventType, 'note', r.id)

  try {
    const remote = remoteToNote(r)
    const local = await db.notes.get(remote.id)

    if (eventType === 'DELETE') {
      rtLog('[delete] received realtime hard delete', remote.id)
      await deleteLocalNote(remote.id)
      rtLog('[delete] realtime cleanup finished', remote.id)
      return
    }

    if (remote.deletedAt) {
      rtLog('[delete] received realtime tombstone', remote.id)
      await deleteLocalNote(remote.id)
      rtLog('[delete] realtime cleanup finished', remote.id)
      return
    }

    if (local?.deletedAt) {
      rtLog('[delete] keeping local note tombstone pending', remote.id)
      return
    }

    if (!local) {
      await db.notes.add(remote)
      return
    }

    if (!shouldApplyRemoteNote(local, remote)) return

    await db.notes.update(remote.id, remote as Partial<Note>)
    rtLog('[diagnostic] realtime reconciled note', remote.id, {
      remoteTime: remote.updatedAt,
      localTime: local.updatedAt,
      remoteContent: remote.content?.slice(0, 40),
      localSyncStatus: local.syncStatus,
    })
  } catch (err) {
    rtLog('[delete] error handling note change', err)
  }
}

async function handleAttachmentChange(payload: Record<string, unknown>) {
  const eventType = String(payload.eventType ?? '')
  const r = getPayloadRecord(payload)
  if (!r || !r.id) return

  rtLog(eventType, 'attachment', r.id)

  try {
    if (eventType === 'DELETE') {
      rtLog('[delete] received realtime hard delete attachment', r.id)
      await deleteLocalAttachment(r.id as string)
      rtLog('[delete] realtime attachment cleanup finished', r.id)
      return
    }

    if (r.deleted_at) {
      rtLog('[delete] received realtime attachment tombstone', r.id)
      await deleteLocalAttachment(r.id as string)
      rtLog('[delete] realtime attachment cleanup finished', r.id)
      return
    }

    const local = await db.attachments.get(r.id as string)

    if (local?.deletedAt) {
      rtLog('[delete] keeping local attachment tombstone pending', r.id)
      return
    }

    if (local) {
      const blob = await db.blobs.get(local.storageKey)
      if (!blob && r.remote_path) {
        enqueueDownload(r.id as string, r.remote_path as string)
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
        rtLog('[diagnostic] realtime updated attachment preview', local.id, 'for note', local.noteId)
      }
      return
    }

    const att = remoteToAtt(r)
    await db.attachments.add(att)
    rtLog('[diagnostic] realtime added attachment', att.id, 'for note', att.noteId)
    if (r.remote_path) {
      enqueueDownload(att.id, r.remote_path as string)
    }
    if (r.preview_path) {
      enqueueDownload(att.id + '-preview', r.preview_path as string)
    }
  } catch (err) {
    rtLog('[delete] error handling attachment change', err)
  }
}
