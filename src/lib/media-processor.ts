import { db } from '@/db/dropnote-db'
import { isHeic, canBrowserPreviewImage } from './attachment-utils'
import type { Attachment, MediaStatus } from '@/types/note'
import { supabase, hasSupabaseEnv } from './supabase'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  return 'processing_error'
}

export function needsMediaProcessing(attachment: Attachment): boolean {
  if (attachment.mediaStatus === 'ready') return false
  if (isHeic(attachment.mimeType, attachment.name)) return true
  if (attachment.type === 'image' && !canBrowserPreviewImage(attachment.mimeType)) return true
  if (attachment.type === 'video') return true
  return false
}

export async function processAttachment(attachmentId: string): Promise<void> {
  const att = await db.attachments.get(attachmentId)
  if (!att || att.mediaStatus === 'ready' || att.mediaStatus === 'processing') return

  await updateStatus(attachmentId, 'processing')

  try {
    const blobRecord = await db.blobs.get(att.storageKey)
    if (!blobRecord) {
      await db.attachments.update(attachmentId, { mediaStatus: 'failed', errorCode: 'no_blob' })
      return
    }

    const previewKey = attachmentId + '-preview'
    let result: { preview: Blob; mime: string; width?: number; height?: number; duration?: number }

    if (isHeic(att.mimeType, att.name)) {
      result = await convertHeic(blobRecord.data)
    } else if (att.type === 'video') {
      result = await extractVideoThumbnail(blobRecord.data)
    } else {
      result = await convertUnsupportedImage(blobRecord.data)
    }

    await db.blobs.put({ storageKey: previewKey, data: result.preview })

    await db.attachments.update(attachmentId, {
      mediaStatus: 'ready',
      previewStorageKey: previewKey,
      previewMime: result.mime,
      width: result.width,
      height: result.height,
      duration: result.duration,
    })

    if (hasSupabaseEnv && supabase) {
      const freshAtt = await db.attachments.get(attachmentId)
      if (freshAtt?.userId) {
        try {
          const previewBlobRecord = await db.blobs.get(previewKey)
          if (previewBlobRecord) {
            const previewRemotePath = `${freshAtt.userId}/${attachmentId}/preview.jpg`
            const { error: uploadErr } = await supabase.storage
              .from('attachments')
              .upload(previewRemotePath, previewBlobRecord.data, { upsert: true, contentType: result.mime })
            if (!uploadErr) {
              await supabase
                .from('attachments')
                .update({
                  media_status: 'ready',
                  preview_path: previewRemotePath,
                  preview_mime: result.mime,
                  width: result.width ?? null,
                  height: result.height ?? null,
                  duration: result.duration ?? null,
                })
                .eq('id', attachmentId)
              await db.attachments.update(attachmentId, { previewPath: previewRemotePath })
              if (import.meta.env.DEV) console.log('[media] preview uploaded', attachmentId)
            }
          }
        } catch (uploadErr) {
          if (import.meta.env.DEV) console.error('[media] preview upload failed', attachmentId, uploadErr)
        }
      }
    }

    if (import.meta.env.DEV) console.log('[media] processed', attachmentId)
  } catch (err) {
    if (import.meta.env.DEV) console.error('[media] failed', attachmentId, err)
    await db.attachments.update(attachmentId, {
      mediaStatus: 'failed',
      errorCode: getErrorMessage(err),
    })
  }
}

async function updateStatus(id: string, mediaStatus: MediaStatus) {
  await db.attachments.update(id, { mediaStatus })
}

async function convertHeic(blob: Blob): Promise<{ preview: Blob; mime: string; width?: number; height?: number }> {
  const heic2any = (await import('heic2any')).default
  const converted = await heic2any({ blob, toType: 'image/jpeg', quality: 0.85 })
  const preview = Array.isArray(converted) ? converted[0] : converted
  const { width, height } = await getImageDimensions(preview)
  return { preview, mime: 'image/jpeg', width, height }
}

async function extractVideoThumbnail(blob: Blob): Promise<{ preview: Blob; mime: string; width: number; height: number; duration: number }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('video_thumbnail_timeout'))
    }, 15000)

    const video = document.createElement('video')
    const url = URL.createObjectURL(blob)
    video.muted = true
    video.preload = 'metadata'
    video.src = url

    const cleanup = () => {
      clearTimeout(timeout)
      URL.revokeObjectURL(url)
    }

    video.addEventListener('error', () => {
      cleanup()
      reject(new Error('video_load_error'))
    })

    video.addEventListener('loadeddata', () => {
      video.currentTime = Math.min(1, video.duration / 10)
    })

    video.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(video, 0, 0)
        canvas.toBlob(
          (jpegBlob) => {
            cleanup()
            if (!jpegBlob) {
              reject(new Error('canvas_export_failed'))
              return
            }
            resolve({
              preview: jpegBlob,
              mime: 'image/jpeg',
              width: video.videoWidth,
              height: video.videoHeight,
              duration: video.duration,
            })
          },
          'image/jpeg',
          0.85,
        )
      } catch (err) {
        cleanup()
        reject(err)
      }
    })
  })
}

async function convertUnsupportedImage(blob: Blob): Promise<{ preview: Blob; mime: string; width: number; height: number }> {
  const url = URL.createObjectURL(blob)
  try {
    const img = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    const preview = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('canvas_export_failed'))),
        'image/jpeg',
        0.85,
      )
    })
    return { preview, mime: 'image/jpeg', width: img.naturalWidth, height: img.naturalHeight }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image_load_error'))
    img.src = src
  })
}

async function getImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(blob)
  try {
    const img = await loadImage(url)
    return { width: img.naturalWidth, height: img.naturalHeight }
  } finally {
    URL.revokeObjectURL(url)
  }
}
