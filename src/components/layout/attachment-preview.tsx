import { useEffect, useState } from 'react'
import { File as FileIcon, Music, X } from 'lucide-react'

import { getAttachmentBlob } from '@/db/attachment-actions'
import { formatFileSize } from '@/lib/attachment-utils'
import type { Attachment } from '@/types/note'

function useBlobUrl(storageKey: string): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let objectUrl: string | null = null

    getAttachmentBlob(storageKey).then((blob) => {
      if (blob) {
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      }
    })

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [storageKey])

  return url
}

interface AttachmentPreviewProps {
  attachment: Attachment
  onRemove: (id: string) => void
}

export function AttachmentPreview({ attachment, onRemove }: AttachmentPreviewProps) {
  const blobUrl = useBlobUrl(attachment.storageKey)

  if (attachment.type === 'image' || attachment.type === 'gif') {
    return (
      <div className="group relative overflow-hidden rounded-xl border border-line">
        {blobUrl ? (
          <img src={blobUrl} alt={attachment.name} className="max-h-48 w-full object-cover" />
        ) : (
          <div className="flex h-24 items-center justify-center bg-white/50 text-xs text-muted-foreground">
            Loading…
          </div>
        )}
        <button
          type="button"
          onClick={() => onRemove(attachment.id)}
          className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition hover:bg-black/60 group-hover:opacity-100"
        >
          <X className="size-3.5" />
        </button>
      </div>
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
          </div>
          <button
            type="button"
            onClick={() => onRemove(attachment.id)}
            className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-black/5 hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
        {blobUrl && <audio controls src={blobUrl} className="w-full" />}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-white/60 px-3 py-2.5">
      <FileIcon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{attachment.name}</p>
        <p className="text-xs text-muted-foreground">
          {attachment.mimeType || 'Unknown type'} · {formatFileSize(attachment.size)}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onRemove(attachment.id)}
        className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-black/5 hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}
