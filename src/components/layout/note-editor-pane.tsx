import { useEffect, useRef, useState } from 'react'
import { Archive, ArrowLeft, Paperclip, Pin, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { addAttachment, removeAttachment } from '@/db/attachment-actions'
import { useFileDrop } from '@/hooks/use-file-drop'
import { useNoteAttachments } from '@/hooks/use-note-attachments'
import { usePasteAttachments } from '@/hooks/use-paste-attachments'
import { MAX_FILE_SIZE_BYTES, formatFileSize } from '@/lib/attachment-utils'
import type { Note } from '@/types/note'

import { AttachmentPreview } from './attachment-preview'

interface NoteEditorPaneProps {
  note: Note | null | undefined
  onUpdateNote: (noteId: string, changes: Pick<Note, 'title' | 'content'>) => void
  onTogglePinned: (noteId: string) => void
  onToggleArchived: (noteId: string) => void
  onDeleteNote: (noteId: string) => void
  onEnsureNote: () => Promise<string>
  onBack?: () => void
  onAttachmentAdded?: (attachmentId: string) => void
}

export function NoteEditorPane({ note, onUpdateNote, onTogglePinned, onToggleArchived, onDeleteNote, onEnsureNote, onBack, onAttachmentAdded }: NoteEditorPaneProps) {
  const [localTitle, setLocalTitle] = useState('')
  const [localContent, setLocalContent] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const attachments = useNoteAttachments(note?.id)

  useEffect(() => {
    setLocalTitle(note?.title ?? '')
    setLocalContent(note?.content ?? '')
  }, [note?.id])

  function handleTitleChange(value: string) {
    setLocalTitle(value)
    if (note) onUpdateNote(note.id, { title: value, content: localContent })
  }

  function handleContentChange(value: string) {
    setLocalContent(value)
    if (note) onUpdateNote(note.id, { title: localTitle, content: value })
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
      className="relative flex min-h-full flex-col"
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

      <input
        type="text"
        value={localTitle}
        onChange={(e) => handleTitleChange(e.target.value)}
        placeholder="Untitled"
        className="w-full bg-transparent text-lg font-medium outline-none placeholder:text-muted-foreground/50"
      />

      <textarea
        value={localContent}
        onChange={(e) => handleContentChange(e.target.value)}
        placeholder="Start writing..."
        className="mt-3 w-full flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50"
      />

      {visualAttachments.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {visualAttachments.map((att) => (
            <AttachmentPreview key={att.id} attachment={att} onRemove={removeAttachment} />
          ))}
        </div>
      )}

      {otherAttachments.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {otherAttachments.map((att) => (
            <AttachmentPreview key={att.id} attachment={att} onRemove={removeAttachment} />
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
