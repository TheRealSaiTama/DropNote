import { useEffect, useState } from 'react'
import { Download, File as FileIcon, Loader2, Music, RefreshCw, X } from 'lucide-react'

import { getAttachmentBlob } from '@/db/attachment-actions'
import { useAttachmentJob } from '@/hooks/use-attachment-job'
import { retryJob } from '@/lib/attachment-queue'
import { formatFileSize, isHeic } from '@/lib/attachment-utils'
import type { Attachment } from '@/types/note'

function useBlobUrl(storageKey: string): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false

    const load = () => {
      getAttachmentBlob(storageKey).then((blob) => {
        if (blob && !cancelled) {
          objectUrl = URL.createObjectURL(blob)
          setUrl(objectUrl)
        }
      })
    }

    load()

    const interval = setInterval(() => {
      if (!objectUrl) load()
      else clearInterval(interval)
    }, 2000)

    return () => {
      cancelled = true
      clearInterval(interval)
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [storageKey])

  return url
}

async function downloadFile(storageKey: string, filename: string) {
  const blob = await getAttachmentBlob(storageKey)
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

interface LightboxProps {
  src: string
  alt: string
  onClose: () => void
  onDownload: () => void
}

function Lightbox({ src, alt, onClose, onDownload }: LightboxProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <img
        src={src}
        alt={alt}
        className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <div className="absolute right-4 top-4 flex gap-2">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDownload() }}
          className="flex size-10 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
          aria-label="Download"
        >
          <Download className="size-5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex size-10 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
          aria-label="Close"
        >
          <X className="size-5" />
        </button>
      </div>
    </div>
  )
}

function JobBadge({ state }: { state: 'uploading' | 'downloading' | 'failed' }) {
  if (state === 'failed') {
    return (
      <span className="flex items-center gap-1 text-[10px] text-destructive">
        failed
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
      <Loader2 className="size-2.5 animate-spin" />
      {state === 'uploading' ? 'uploading' : 'downloading'}
    </span>
  )
}

interface AttachmentPreviewProps {
  attachment: Attachment
  onRemove: (id: string) => void
}

export function AttachmentPreview({ attachment, onRemove }: AttachmentPreviewProps) {
  const blobUrl = useBlobUrl(attachment.storageKey)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const jobState = useAttachmentJob(attachment.id)

  const showJobBadge = jobState === 'uploading' || jobState === 'downloading' || jobState === 'failed'
  const heic = isHeic(attachment.mimeType, attachment.name)

  if ((attachment.type === 'image' || attachment.type === 'gif') && !heic) {
    return (
      <>
        <div className="group relative overflow-hidden rounded-xl border border-line">
          {blobUrl ? (
            <img
              src={blobUrl}
              alt={attachment.name}
              className="max-h-48 w-full cursor-pointer object-cover transition hover:opacity-90"
              onClick={() => setLightboxOpen(true)}
            />
          ) : (
            <div className="flex h-24 items-center justify-center bg-white/50">
              {jobState === 'downloading' ? (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  downloading
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Loading…</span>
              )}
            </div>
          )}
          <div className="absolute right-2 top-2 flex gap-1 transition sm:opacity-0 sm:group-hover:opacity-100">
            {jobState === 'failed' && (
              <button
                type="button"
                onClick={() => retryJob(attachment.id)}
                className="flex size-6 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60"
                aria-label="Retry"
              >
                <RefreshCw className="size-3" />
              </button>
            )}
            <button
              type="button"
              onClick={() => void downloadFile(attachment.storageKey, attachment.name)}
              className="flex size-6 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60"
              aria-label="Download"
            >
              <Download className="size-3" />
            </button>
            <button
              type="button"
              onClick={() => onRemove(attachment.id)}
              className="flex size-6 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60"
              aria-label="Remove"
            >
              <X className="size-3" />
            </button>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1">
            <p className="min-w-0 truncate text-[11px] text-muted-foreground">
              {attachment.name} · {formatFileSize(attachment.size)}
            </p>
            {showJobBadge && <JobBadge state={jobState as 'uploading' | 'downloading' | 'failed'} />}
          </div>
        </div>
        {lightboxOpen && blobUrl && (
          <Lightbox
            src={blobUrl}
            alt={attachment.name}
            onClose={() => setLightboxOpen(false)}
            onDownload={() => void downloadFile(attachment.storageKey, attachment.name)}
          />
        )}
      </>
    )
  }

  if (attachment.type === 'audio') {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-line bg-white/60 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Music className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm font-medium">{attachment.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatFileSize(attachment.size)}
            </span>
            {showJobBadge && <JobBadge state={jobState as 'uploading' | 'downloading' | 'failed'} />}
          </div>
          <div className="flex shrink-0 gap-1">
            {jobState === 'failed' && (
              <button
                type="button"
                onClick={() => retryJob(attachment.id)}
                className="flex size-6 items-center justify-center rounded-full text-destructive transition hover:bg-black/5"
                aria-label="Retry"
              >
                <RefreshCw className="size-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => void downloadFile(attachment.storageKey, attachment.name)}
              className="flex size-6 items-center justify-center rounded-full text-muted-foreground transition hover:bg-black/5 hover:text-foreground"
              aria-label="Download"
            >
              <Download className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onRemove(attachment.id)}
              className="flex size-6 items-center justify-center rounded-full text-muted-foreground transition hover:bg-black/5 hover:text-foreground"
              aria-label="Remove"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
        {blobUrl ? (
          <audio controls src={blobUrl} className="w-full" />
        ) : jobState === 'downloading' ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            downloading audio…
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-white/60 px-3 py-2.5">
      <FileIcon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{attachment.name}</p>
        <div className="flex items-center gap-1.5">
          <p className="text-xs text-muted-foreground">
            {attachment.mimeType || 'Unknown type'} · {formatFileSize(attachment.size)}
          </p>
          {showJobBadge && <JobBadge state={jobState as 'uploading' | 'downloading' | 'failed'} />}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        {jobState === 'failed' && (
          <button
            type="button"
            onClick={() => retryJob(attachment.id)}
            className="flex size-6 items-center justify-center rounded-full text-destructive transition hover:bg-black/5"
            aria-label="Retry"
          >
            <RefreshCw className="size-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => void downloadFile(attachment.storageKey, attachment.name)}
          className="flex size-6 items-center justify-center rounded-full text-muted-foreground transition hover:bg-black/5 hover:text-foreground"
          aria-label="Download"
        >
          <Download className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onRemove(attachment.id)}
          className="flex size-6 items-center justify-center rounded-full text-muted-foreground transition hover:bg-black/5 hover:text-foreground"
          aria-label="Remove"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
