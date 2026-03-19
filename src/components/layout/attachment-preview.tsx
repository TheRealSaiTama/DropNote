import { useEffect, useState } from 'react'
import { Download, File as FileIcon, Film, Loader2, Music, RefreshCw, X } from 'lucide-react'

import { getAttachmentBlob } from '@/db/attachment-actions'
import { useAttachmentJob } from '@/hooks/use-attachment-job'
import { retryJob } from '@/lib/attachment-queue'
import { formatFileSize, isHeic, canBrowserPreviewImage, canBrowserPlayAudio, canBrowserPlayVideo } from '@/lib/attachment-utils'
import { processAttachment } from '@/lib/media-processor'
import type { Attachment } from '@/types/note'

function useBlobUrl(storageKey: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!storageKey) return
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

function JobBadge({ state }: { state: string }) {
  if (state === 'failed') {
    return <span className="flex items-center gap-1 text-[10px] text-destructive">failed</span>
  }
  if (state === 'processing') {
    return (
      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Loader2 className="size-2.5 animate-spin" />
        processing
      </span>
    )
  }
  if (state === 'uploading' || state === 'downloading') {
    return (
      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Loader2 className="size-2.5 animate-spin" />
        {state}
      </span>
    )
  }
  return null
}

function ActionButtons({
  attachment,
  jobState,
  onRemove,
  variant = 'overlay',
}: {
  attachment: Attachment
  jobState: string
  onRemove: (id: string) => void
  variant?: 'overlay' | 'inline'
}) {
  const isOverlay = variant === 'overlay'
  const btnClass = isOverlay
    ? 'flex size-6 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60'
    : 'flex size-6 items-center justify-center rounded-full text-muted-foreground transition hover:bg-black/5 hover:text-foreground'
  const iconSize = isOverlay ? 'size-3' : 'size-3.5'

  return (
    <div className={`flex shrink-0 gap-1 ${isOverlay ? 'transition sm:opacity-0 sm:group-hover:opacity-100' : ''}`}>
      {(jobState === 'failed' || attachment.mediaStatus === 'failed') && (
        <button
          type="button"
          onClick={() => {
            if (jobState === 'failed') retryJob(attachment.id)
            else void processAttachment(attachment.id)
          }}
          className={isOverlay ? btnClass : 'flex size-6 items-center justify-center rounded-full text-destructive transition hover:bg-black/5'}
          aria-label="Retry"
        >
          <RefreshCw className={iconSize} />
        </button>
      )}
      <button
        type="button"
        onClick={() => void downloadFile(attachment.storageKey, attachment.name)}
        className={btnClass}
        aria-label="Download original"
      >
        <Download className={iconSize} />
      </button>
      <button
        type="button"
        onClick={() => onRemove(attachment.id)}
        className={btnClass}
        aria-label="Remove"
      >
        <X className={iconSize} />
      </button>
    </div>
  )
}

function MetadataRow({ attachment, jobState }: { attachment: Attachment; jobState: string }) {
  const badgeState = attachment.mediaStatus === 'processing' ? 'processing'
    : attachment.mediaStatus === 'failed' ? 'failed'
    : jobState
  const showBadge = badgeState === 'uploading' || badgeState === 'downloading' || badgeState === 'failed' || badgeState === 'processing'

  return (
    <div className="flex items-center gap-1.5 px-2 py-1">
      <p className="min-w-0 truncate text-[11px] text-muted-foreground">
        {attachment.name} · {formatFileSize(attachment.size)}
      </p>
      {showBadge && <JobBadge state={badgeState} />}
    </div>
  )
}

interface AttachmentPreviewProps {
  attachment: Attachment
  onRemove: (id: string) => void
}

export function AttachmentPreview({ attachment, onRemove }: AttachmentPreviewProps) {
  const previewUrl = useBlobUrl(attachment.previewStorageKey)
  const originalUrl = useBlobUrl(attachment.storageKey)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const jobState = useAttachmentJob(attachment.id)

  const heic = isHeic(attachment.mimeType, attachment.name)
  const hasPreview = attachment.mediaStatus === 'ready' && attachment.previewStorageKey
  const isProcessing = attachment.mediaStatus === 'processing'
  const isFailed = attachment.mediaStatus === 'failed'

  if (attachment.type === 'image' || attachment.type === 'gif') {
    const canShowOriginal = !heic && canBrowserPreviewImage(attachment.mimeType)
    const displayUrl = hasPreview ? previewUrl : canShowOriginal ? originalUrl : null

    return (
      <>
        <div className="group relative overflow-hidden rounded-xl border border-line">
          {displayUrl ? (
            <img
              src={displayUrl}
              alt={attachment.name}
              className="max-h-48 w-full cursor-pointer object-cover transition hover:opacity-90"
              onClick={() => setLightboxOpen(true)}
            />
          ) : (
            <div className="flex h-24 items-center justify-center bg-white/50">
              {isProcessing ? (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  converting
                </span>
              ) : isFailed ? (
                <button
                  type="button"
                  onClick={() => void processAttachment(attachment.id)}
                  className="flex items-center gap-1.5 text-xs text-destructive hover:underline"
                >
                  <RefreshCw className="size-3" />
                  retry conversion
                </button>
              ) : jobState === 'downloading' ? (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  downloading
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Loading…</span>
              )}
            </div>
          )}
          <div className="absolute right-2 top-2">
            <ActionButtons attachment={attachment} jobState={jobState} onRemove={onRemove} variant="overlay" />
          </div>
          <MetadataRow attachment={attachment} jobState={jobState} />
        </div>
        {lightboxOpen && displayUrl && (
          <Lightbox
            src={displayUrl}
            alt={attachment.name}
            onClose={() => setLightboxOpen(false)}
            onDownload={() => void downloadFile(attachment.storageKey, attachment.name)}
          />
        )}
      </>
    )
  }

  if (attachment.type === 'video') {
    const canPlay = canBrowserPlayVideo(attachment.mimeType)
    const thumbnailUrl = hasPreview ? previewUrl : null

    return (
      <>
        <div className="group relative overflow-hidden rounded-xl border border-line">
          {canPlay && originalUrl ? (
            <video
              src={originalUrl}
              poster={thumbnailUrl ?? undefined}
              controls
              preload="metadata"
              className="max-h-48 w-full"
            />
          ) : thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={attachment.name}
              className="max-h-48 w-full cursor-pointer object-cover transition hover:opacity-90"
              onClick={() => setLightboxOpen(true)}
            />
          ) : (
            <div className="flex h-24 items-center justify-center bg-white/50">
              {isProcessing ? (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  processing video
                </span>
              ) : isFailed ? (
                <div className="flex flex-col items-center gap-1">
                  <Film className="size-6 text-muted-foreground" />
                  <button
                    type="button"
                    onClick={() => void processAttachment(attachment.id)}
                    className="text-xs text-destructive hover:underline"
                  >
                    retry
                  </button>
                </div>
              ) : jobState === 'downloading' ? (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  downloading
                </span>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <Film className="size-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Video</span>
                </div>
              )}
            </div>
          )}
          <div className="absolute right-2 top-2">
            <ActionButtons attachment={attachment} jobState={jobState} onRemove={onRemove} variant="overlay" />
          </div>
          <MetadataRow attachment={attachment} jobState={jobState} />
        </div>
        {lightboxOpen && thumbnailUrl && (
          <Lightbox
            src={thumbnailUrl}
            alt={attachment.name}
            onClose={() => setLightboxOpen(false)}
            onDownload={() => void downloadFile(attachment.storageKey, attachment.name)}
          />
        )}
      </>
    )
  }

  if (attachment.type === 'audio') {
    const canPlay = canBrowserPlayAudio(attachment.mimeType)

    return (
      <div className="flex flex-col gap-2 rounded-xl border border-line bg-white/60 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Music className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm font-medium">{attachment.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatFileSize(attachment.size)}
            </span>
            {attachment.duration && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {Math.floor(attachment.duration / 60)}:{String(Math.floor(attachment.duration % 60)).padStart(2, '0')}
              </span>
            )}
            <JobBadge state={attachment.mediaStatus === 'processing' ? 'processing' : jobState} />
          </div>
          <ActionButtons attachment={attachment} jobState={jobState} onRemove={onRemove} variant="inline" />
        </div>
        {canPlay && originalUrl ? (
          <audio controls src={originalUrl} className="w-full" />
        ) : originalUrl ? (
          <audio controls src={originalUrl} className="w-full" />
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
            {attachment.originalMime || attachment.mimeType || 'Unknown type'} · {formatFileSize(attachment.size)}
          </p>
          <JobBadge state={attachment.mediaStatus === 'processing' ? 'processing' : jobState} />
        </div>
      </div>
      <ActionButtons attachment={attachment} jobState={jobState} onRemove={onRemove} variant="inline" />
    </div>
  )
}
