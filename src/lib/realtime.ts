import type { RealtimeChannel } from '@supabase/supabase-js'
import { db } from '@/db/dropnote-db'
import { supabase, hasSupabaseEnv } from './supabase'
import { remoteToNote, remoteToAtt, deleteLocalNote, deleteLocalAttachment } from './sync-engine'
import { enqueueDownload } from './attachment-queue'
import type { Note } from '@/types/note'

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
    .subscribe()

  rtLog('subscribed for', userId)
}

export function stopRealtime(): void {
  if (channel) {
    supabase?.removeChannel(channel)
    channel = null
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

    const remoteTime = new Date(remote.updatedAt).getTime()
    const localTime = new Date(local.updatedAt).getTime()

    if (remoteTime <= localTime) return

    await db.notes.update(remote.id, remote as Partial<Note>)
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
      }
      return
    }

    const att = remoteToAtt(r)
    await db.attachments.add(att)
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
