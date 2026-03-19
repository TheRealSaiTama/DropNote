import type { AttachmentType } from '@/types/note'

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024

const HEIC_MIMES = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']
const HEIC_EXTS = ['.heic', '.heif']

export function isHeic(mimeType: string, fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return HEIC_MIMES.includes(mimeType.toLowerCase()) || HEIC_EXTS.some((ext) => lower.endsWith(ext))
}

export function detectAttachmentType(file: File): AttachmentType {
  const { type, name } = file
  if (type === 'image/gif' || name.toLowerCase().endsWith('.gif')) return 'gif'
  if (type.startsWith('image/')) return 'image'
  if (type.startsWith('audio/')) return 'audio'
  return 'file'
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
