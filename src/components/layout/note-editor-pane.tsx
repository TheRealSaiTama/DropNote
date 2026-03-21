import { startTransition, useEffect, useRef, useState } from 'react'
import { Archive, ArrowLeft, Paperclip, Pin, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { addAttachment, removeAttachment } from '@/db/attachment-actions'
import { useFileDrop } from '@/hooks/use-file-drop'
import { useNoteAttachments } from '@/hooks/use-note-attachments'
import { usePasteAttachments } from '@/hooks/use-paste-attachments'
import { MAX_FILE_SIZE_BYTES, formatFileSize } from '@/lib/attachment-utils'
import type { Folder, Note } from '@/types/note'

import { AttachmentPreview } from './attachment-preview'
import { NoteRichEditor } from './note-rich-editor'

const DEV = import.meta.env.DEV

interface NoteEditorPaneProps {
  note: Note | null | undefined
  folders: Folder[]
  onMoveToFolder: (noteId: string, folderId: string | null) => void | Promise<void>
  onUpdateNote: (
    noteId: string,
    changes: Pick<Note, 'title' | 'content'>,
    onSaved?: (changes: Pick<Note, 'title' | 'content'>) => void,
  ) => void
  onTogglePinned: (noteId: string) => void
  onToggleArchived: (noteId: string) => void
  onDeleteNote: (noteId: string) => void
  onEnsureNote: () => Promise<string>
  onBack?: () => void
  onAttachmentAdded?: (attachmentId: string) => void
  onAttachmentRemoved?: (attachmentId: string) => void
}

export function NoteEditorPane({ note, folders, onMoveToFolder, onUpdateNote, onTogglePinned, onToggleArchived, onDeleteNote, onEnsureNote, onBack, onAttachmentAdded, onAttachmentRemoved }: NoteEditorPaneProps) {
  const [localTitle, setLocalTitle] = useState(() => note?.title ?? '')
  const [localContent, setLocalContent] = useState(() => note?.content ?? '')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const attachments = useNoteAttachments(note?.id)

  const noteIdRef = useRef<string | null | undefined>(note?.id)
  const lastSyncedRef = useRef({ title: note?.title ?? '', content: note?.content ?? '' })

  useEffect(() => {
    if (!note) return

    if (noteIdRef.current !== note.id) {
      noteIdRef.current = note.id
      lastSyncedRef.current = { title: note.title, content: note.content }
      if (DEV) console.log('[editor] note switched', note.id, note.updatedAt)
      return
    }

    const dbTitle = note.title
    const dbContent = note.content
    const syncedTitle = lastSyncedRef.current.title
    const syncedContent = lastSyncedRef.current.content

    const dbChangedFromSynced = dbTitle !== syncedTitle || dbContent !== syncedContent

    if (dbChangedFromSynced) {
      startTransition(() => {
        setLocalTitle(dbTitle)
        setLocalContent(dbContent)
      })
      lastSyncedRef.current = { title: dbTitle, content: dbContent }
      if (DEV) console.log('[editor] draft replaced from DB', note.id, note.updatedAt, note.syncStatus)
    }
  }, [note])

  function handleTitleChange(value: string) {
    setLocalTitle(value)
    if (note) onUpdateNote(note.id, { title: value, content: localContent }, (saved) => {
      lastSyncedRef.current = { ...lastSyncedRef.current, title: saved.title }
    })
  }

  function handleContentChange(value: string) {
    setLocalContent(value)
    if (note) onUpdateNote(note.id, { title: localTitle, content: value }, (saved) => {
      lastSyncedRef.current = { ...lastSyncedRef.current, content: saved.content }
    })
  }

  async function handleFiles(files: File[]) {
    const noteId = note?.id ?? (await onEnsureNote())
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        alert(`${file.name} exceeds ${formatFileSize(MAX_FILE_SIZE_BYTES)}`)
        continue
      }
      const att = await addAttachment(noteId, file)
      onAttachmentAdded?.(att.id)
    }
  }

  function handleAttachmentRemoved(attachmentId: string) {
    void removeAttachment(attachmentId).then(() => {
      onAttachmentRemoved?.(attachmentId)
    }).catch((error) => {
      if (import.meta.env.DEV) console.error('[delete] attachment delete failed', attachmentId, error)
    })
  }

  const { isDragging, onDragEnter, onDragLeave, onDragOver, onDrop } = useFileDrop({ onFiles: handleFiles })
  usePasteAttachments(handleFiles)

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (files && files.length > 0) {
      void handleFiles(Array.from(files))
      e.target.value = ''
    }
  }

  if (!note) {
    return (
      <div className="flex min-h-full items-center justify-center text-sm text-muted-foreground">
        Select a note or create a new one
      </div>
    )
  }

  const visualAttachments = attachments.filter((a) => a.type === 'image' || a.type === 'gif' || a.type === 'video')
  const otherAttachments = attachments.filter((a) => a.type !== 'image' && a.type !== 'gif' && a.type !== 'video')

  return (
    <section
      className="relative flex min-h-full flex-1 flex-col"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-foreground/20 bg-surface/80 backdrop-blur-sm">
          <p className="text-sm text-muted-foreground">Drop files here</p>
        </div>
      )}

      <div className="flex items-center gap-1 pb-3">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="size-8 rounded-full lg:hidden" aria-label="Back">
            <ArrowLeft className="size-4" />
          </Button>
        )}
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onTogglePinned(note.id)}
          className={`size-8 rounded-full ${note.pinned ? 'text-foreground' : 'text-muted-foreground'}`}
          aria-label={note.pinned ? 'Unpin' : 'Pin'}
        >
          <Pin className={`size-4 ${note.pinned ? 'fill-current' : ''}`} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onToggleArchived(note.id)}
          className={`size-8 rounded-full ${note.archived ? 'text-foreground' : 'text-muted-foreground'}`}
          aria-label={note.archived ? 'Unarchive' : 'Archive'}
        >
          <Archive className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDeleteNote(note.id)}
          className="size-8 rounded-full text-muted-foreground hover:text-destructive"
          aria-label="Delete"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="note-canvas-shell mt-3 flex min-h-0 flex-1 flex-col">
        <div className="note-canvas-title-wrap space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="note-folder" className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Folder
            </label>
            <select
              id="note-folder"
              value={note.folderId ?? ''}
              onChange={(e) => {
                const v = e.target.value
                void onMoveToFolder(note.id, v === '' ? null : v)
              }}
              className="min-w-[8rem] max-w-full flex-1 rounded-lg border border-line/60 bg-surface-strong/70 px-2 py-1.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">No folder</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <input
            type="text"
            value={localTitle}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Untitled"
            className="note-title-field placeholder:text-muted-foreground/50"
            aria-label="Note title"
          />
        </div>
        <div className="note-canvas-ruled flex min-h-0 flex-1 flex-col">
          <NoteRichEditor value={localContent} onChange={handleContentChange} placeholder="Start writing…" />
        </div>
      </div>

      {visualAttachments.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {visualAttachments.map((att) => (
            <AttachmentPreview key={att.id} attachment={att} onRemove={handleAttachmentRemoved} />
          ))}
        </div>
      )}

      {otherAttachments.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {otherAttachments.map((att) => (
            <AttachmentPreview key={att.id} attachment={att} onRemove={handleAttachmentRemoved} />
          ))}
        </div>
      )}

      <div className="mt-4">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Paperclip className="size-3.5" />
          Attach file
        </button>
      </div>
    </section>
  )
}
