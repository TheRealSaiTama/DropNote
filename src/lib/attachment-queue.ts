import { db } from '@/db/dropnote-db'
import { needsProcessing } from './attachment-utils'
import { processAttachment } from './media-processor'
import { supabase, hasSupabaseEnv } from './supabase'
import type { AttachmentJobState, Note } from '@/types/note'

const MAX_CONCURRENT = 3
const MAX_RETRIES = 3
const RETRY_DELAYS = [2000, 5000, 10000]

interface Job {
  attachmentId: string
  type: 'upload' | 'download'
  state: AttachmentJobState
  retries: number
  remotePath?: string
  userId?: string
}

const jobs = new Map<string, Job>()
let active = 0
const pending: string[] = []
const listeners = new Set<() => void>()

function queueLog(...args: unknown[]) {
  if (import.meta.env.DEV) {
    console.log('[queue]', ...args)
  }
}

function notify() {
  listeners.forEach((fn) => fn())
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

export function getJobState(attachmentId: string): AttachmentJobState {
  return jobs.get(attachmentId)?.state ?? 'idle'
}

export function subscribeJobs(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function hasPendingJobs(): boolean {
  for (const job of jobs.values()) {
    if (job.state === 'uploading' || job.state === 'downloading') return true
  }
  return pending.length > 0
}

export function getFailedCount(): number {
  let count = 0
  for (const job of jobs.values()) {
    if (job.state === 'failed') count++
  }
  return count
}

function processNext() {
  while (active < MAX_CONCURRENT && pending.length > 0) {
    const id = pending.shift()!
    const job = jobs.get(id)
    if (!job) continue
    active++
    if (job.type === 'upload') {
      runUpload(job).finally(() => {
        active--
        processNext()
      })
    } else {
      runDownload(job).finally(() => {
        active--
        processNext()
      })
    }
  }
}

async function runUpload(job: Job) {
  job.state = 'uploading'
  notify()
  queueLog('uploading', job.attachmentId)
  try {
    const att = await db.attachments.get(job.attachmentId)
    if (!att) throw new Error('Attachment not found')
    const note = await db.notes.get(att.noteId)
    if (!note) throw new Error('Parent note not found')

    if (job.userId) {
      const { error: noteUpsertError } = await supabase!
        .from('notes')
        .upsert(noteToRemote(note, job.userId))
      if (noteUpsertError) throw noteUpsertError
      await db.notes.update(note.id, { userId: job.userId })
      queueLog('ensured remote parent note', note.id, 'for attachment', att.id)
    }

    let remotePath = att.remotePath
    if (!remotePath) {
      const blob = await db.blobs.get(att.storageKey)
      if (!blob) throw new Error('Blob not found')
      const path = `${job.userId}/${att.id}/${att.name}`
      const { error: uploadError } = await supabase!.storage
        .from('attachments')
        .upload(path, blob.data, { upsert: true })
      if (uploadError) throw uploadError
      remotePath = path
      await db.attachments.update(att.id, { remotePath })
    }

    const { error: upsertError } = await supabase!
      .from('attachments')
      .upsert({
        id: att.id,
        note_id: att.noteId,
        user_id: job.userId,
        type: att.type,
        name: att.name,
        mime_type: att.mimeType,
        size: att.size,
        remote_path: remotePath,
        created_at: att.createdAt,
        deleted_at: att.deletedAt,
      })
    if (upsertError) throw upsertError

    await db.attachments.update(att.id, { syncStatus: 'synced', userId: job.userId })

    const freshAtt = await db.attachments.get(att.id)
    if (freshAtt?.previewStorageKey && freshAtt.mediaStatus === 'ready' && !freshAtt.previewPath) {
      try {
        const previewBlob = await db.blobs.get(freshAtt.previewStorageKey)
        if (previewBlob) {
          const previewRemotePath = `${job.userId}/${att.id}/preview.jpg`
          const { error: previewUploadErr } = await supabase!.storage
            .from('attachments')
            .upload(previewRemotePath, previewBlob.data, { upsert: true, contentType: freshAtt.previewMime || 'image/jpeg' })
          if (!previewUploadErr) {
            await supabase!
              .from('attachments')
              .update({
                media_status: 'ready',
                preview_path: previewRemotePath,
                preview_mime: freshAtt.previewMime ?? null,
                width: freshAtt.width ?? null,
                height: freshAtt.height ?? null,
                duration: freshAtt.duration ?? null,
              })
              .eq('id', att.id)
            await db.attachments.update(att.id, { previewPath: previewRemotePath })
            queueLog('preview uploaded', att.id)
          }
        }
      } catch (previewErr) {
        queueLog('preview upload failed', att.id, previewErr)
      }
    }

    job.state = 'done'
    notify()
    queueLog('upload done', job.attachmentId)
  } catch (err) {
    queueLog('upload failed', job.attachmentId, err)
    handleFailure(job)
  }
}

async function runDownload(job: Job) {
  job.state = 'downloading'
  notify()
  queueLog('downloading', job.attachmentId)
  try {
    const { data, error } = await supabase!.storage
      .from('attachments')
      .download(job.remotePath!)
    if (error) throw error

    await db.blobs.put({ storageKey: job.attachmentId, data })
    job.state = 'done'
    notify()
    queueLog('download done', job.attachmentId)

    const att = await db.attachments.get(job.attachmentId)
    if (att && needsProcessing(att)) {
      void processAttachment(job.attachmentId)
    }
  } catch (err) {
    queueLog('download failed', job.attachmentId, err)
    handleFailure(job)
  }
}

function handleFailure(job: Job) {
  job.retries++
  if (job.retries <= MAX_RETRIES) {
    const delay = RETRY_DELAYS[job.retries - 1] ?? RETRY_DELAYS[RETRY_DELAYS.length - 1]
    job.state = 'idle'
    notify()
    queueLog('retrying', job.attachmentId, `in ${delay}ms`, `(${job.retries}/${MAX_RETRIES})`)
    setTimeout(() => {
      pending.push(job.attachmentId)
      processNext()
    }, delay)
  } else {
    job.state = 'failed'
    notify()
    queueLog('permanently failed', job.attachmentId)
  }
}

export function enqueueUpload(attachmentId: string, userId: string) {
  if (!hasSupabaseEnv) return
  const existing = jobs.get(attachmentId)
  if (existing && (existing.state === 'uploading' || existing.state === 'done')) return

  const job: Job = {
    attachmentId,
    type: 'upload',
    state: 'idle',
    retries: 0,
    userId,
  }
  jobs.set(attachmentId, job)
  pending.push(attachmentId)
  processNext()
}

export function enqueueDownload(attachmentId: string, remotePath: string) {
  if (!hasSupabaseEnv) return
  const existing = jobs.get(attachmentId)
  if (existing && (existing.state === 'downloading' || existing.state === 'done')) return

  db.blobs.get(attachmentId).then((blob) => {
    if (blob) {
      queueLog('blob already exists locally', attachmentId)
      return
    }

    const job: Job = {
      attachmentId,
      type: 'download',
      state: 'idle',
      retries: 0,
      remotePath,
    }
    jobs.set(attachmentId, job)
    pending.push(attachmentId)
    processNext()
  })
}

export function retryJob(attachmentId: string) {
  const job = jobs.get(attachmentId)
  if (!job || job.state !== 'failed') return
  job.retries = 0
  job.state = 'idle'
  pending.push(attachmentId)
  notify()
  processNext()
}
