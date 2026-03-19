import type { Attachment, AttachmentType } from '@/types/note'

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024

const HEIC_MIMES = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']
const HEIC_EXTS = ['.heic', '.heif']

const BROWSER_SAFE_IMAGE_MIMES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml', 'image/bmp',
]

const BROWSER_SAFE_AUDIO_MIMES = [
  'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/aac', 'audio/mp4',
  'audio/x-m4a', 'audio/flac',
]

const BROWSER_SAFE_VIDEO_MIMES = [
  'video/mp4', 'video/webm', 'video/ogg',
]

export function isHeic(mimeType: string, fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return HEIC_MIMES.includes(mimeType.toLowerCase()) || HEIC_EXTS.some((ext) => lower.endsWith(ext))
}

export function canBrowserPreviewImage(mimeType: string): boolean {
  return BROWSER_SAFE_IMAGE_MIMES.includes(mimeType.toLowerCase())
}

export function canBrowserPlayAudio(mimeType: string): boolean {
  return BROWSER_SAFE_AUDIO_MIMES.includes(mimeType.toLowerCase())
}

export function canBrowserPlayVideo(mimeType: string): boolean {
  return BROWSER_SAFE_VIDEO_MIMES.includes(mimeType.toLowerCase())
}

export function needsProcessing(attachment: Attachment): boolean {
  if (attachment.mediaStatus === 'ready') return false
  if (isHeic(attachment.mimeType, attachment.name)) return true
  if (attachment.type === 'video') return true
  if (attachment.type === 'image' && !canBrowserPreviewImage(attachment.mimeType)) return true
  return false
}

export function detectAttachmentType(file: File): AttachmentType {
  const { type, name } = file
  if (type === 'image/gif' || name.toLowerCase().endsWith('.gif')) return 'gif'
  if (type.startsWith('video/') || name.toLowerCase().match(/\.(mp4|mov|webm|avi|mkv|m4v)$/)) return 'video'
  if (type.startsWith('image/') || isHeic(type, name)) return 'image'
  if (type.startsWith('audio/')) return 'audio'
  return 'file'
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
