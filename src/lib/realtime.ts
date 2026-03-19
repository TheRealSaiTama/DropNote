import type { RealtimeChannel } from '@supabase/supabase-js'
import { db } from '@/db/dropnote-db'
import { supabase, hasSupabaseEnv } from './supabase'
import { remoteToNote, remoteToAtt, deleteLocalNote } from './sync-engine'
import { enqueueDownload } from './attachment-queue'
import type { Note } from '@/types/note'

function rtLog(...args: unknown[]) {
  if (import.meta.env.DEV) {
    console.log('[realtime]', ...args)
  }
}

let channel: RealtimeChannel | null = null

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
  const r = payload.new as Record<string, unknown> | undefined
  if (!r || !r.id) return

  rtLog(payload.eventType, 'note', r.id)

  try {
    const local = await db.notes.get(r.id as string)
    const remote = remoteToNote(r)

    if (payload.eventType === 'DELETE') {
      if (local) await deleteLocalNote(r.id as string)
      return
    }

    if (!local) {
      if (!remote.deletedAt) await db.notes.add(remote)
      return
    }

    const remoteTime = new Date(remote.updatedAt).getTime()
    const localTime = new Date(local.updatedAt).getTime()

    if (remoteTime <= localTime) return

    if (remote.deletedAt) {
      await deleteLocalNote(remote.id)
    } else {
      await db.notes.update(remote.id, remote as Partial<Note>)
    }
  } catch (err) {
    rtLog('error handling note change', err)
  }
}

async function handleAttachmentChange(payload: Record<string, unknown>) {
  const r = payload.new as Record<string, unknown> | undefined
  if (!r || !r.id) return

  rtLog(payload.eventType, 'attachment', r.id)

  try {
    if (r.deleted_at) {
      const local = await db.attachments.get(r.id as string)
      if (local && !local.deletedAt) {
        await db.blobs.delete(local.storageKey)
        await db.attachments.delete(local.id)
      }
      return
    }

    const local = await db.attachments.get(r.id as string)

    if (local) {
      const blob = await db.blobs.get(local.storageKey)
      if (!blob && r.remote_path) {
        enqueueDownload(r.id as string, r.remote_path as string)
      }
      return
    }

    const att = remoteToAtt(r)
    await db.attachments.add(att)
    if (r.remote_path) {
      enqueueDownload(att.id, r.remote_path as string)
    }
  } catch (err) {
    rtLog('error handling attachment change', err)
  }
}
