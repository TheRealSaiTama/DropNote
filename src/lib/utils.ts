import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNoteTimestamp(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

export function formatAttachmentSize(sizeKb: number) {
  if (sizeKb < 1024) {
    return `${sizeKb} KB`
  }

  return `${(sizeKb / 1024).toFixed(1)} MB`
}

export function buildExcerpt(content: string) {
  return content.replace(/\s+/g, ' ').trim().slice(0, 120)
}
