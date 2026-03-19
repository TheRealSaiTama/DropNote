import { useState } from 'react'
import { Archive, ArchiveRestore, CheckSquare, Paperclip, Pin, Plus, StickyNote, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { Note, NoteFilter } from '@/types/note'

interface NotesListPaneProps {
  notes: Note[]
  selectedNoteId: string | null
  activeFilter: NoteFilter
  onFilterChange: (value: NoteFilter) => void
  onSelectNote: (noteId: string) => void
  onCreateNote: () => void
  selectedIds: Set<string>
  onToggleSelect: (noteId: string) => void
  onSelectAllVisible: () => void
  onClearSelection: () => void
  onBulkDelete: () => void
  onBulkArchive: () => void
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function NotesListPane({
  notes,
  selectedNoteId,
  activeFilter,
  onFilterChange,
  onSelectNote,
  onCreateNote,
  selectedIds,
  onToggleSelect,
  onSelectAllVisible,
  onClearSelection,
  onBulkDelete,
  onBulkArchive,
}: NotesListPaneProps) {
  const [selectMode, setSelectMode] = useState(false)
  const selecting = selectMode || selectedIds.size > 0

  function handleDone() {
    onClearSelection()
    setSelectMode(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {(['all', 'pinned', 'archived'] as const).map((filter) => (
          <Button
            key={filter}
            variant={activeFilter === filter ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onFilterChange(filter)}
          >
            {filter === 'all' && <StickyNote className="size-3.5" />}
            {filter === 'pinned' && <Pin className="size-3.5" />}
            {filter === 'archived' && <Archive className="size-3.5" />}
            {filter}
          </Button>
        ))}
        {!selecting && notes.length > 0 && (
          <>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={() => setSelectMode(true)} className="text-xs text-muted-foreground">
              <CheckSquare className="size-3.5" />
              Select
            </Button>
          </>
        )}
      </div>

      {selecting && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-strong px-3 py-2">
          <span className="text-xs font-medium">{selectedIds.size} selected</span>
          <button
            type="button"
            onClick={onSelectAllVisible}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            All
          </button>
          <button
            type="button"
            onClick={handleDone}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Done
          </button>
          <div className="flex-1" />
          {selectedIds.size > 0 && (
            <>
              <Button variant="ghost" size="sm" onClick={onBulkArchive} className="h-7 text-xs">
                {activeFilter === 'archived' ? (
                  <ArchiveRestore className="size-3.5" />
                ) : (
                  <Archive className="size-3.5" />
                )}
                {activeFilter === 'archived' ? 'Unarchive' : 'Archive'}
              </Button>
              <Button variant="ghost" size="sm" onClick={onBulkDelete} className="h-7 text-xs text-destructive hover:text-destructive">
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            </>
          )}
        </div>
      )}

      {notes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-muted-foreground">No notes yet</p>
          <Button size="sm" onClick={onCreateNote}>
            <Plus className="size-4" />
            New note
          </Button>
        </div>
      ) : (
        <div className="space-y-1">
          {notes.map((note) => (
            <div
              key={note.id}
              className={`group flex w-full items-start gap-2 rounded-xl p-3 text-left transition-colors ${
                selectedIds.has(note.id)
                  ? 'bg-foreground/5'
                  : selectedNoteId === note.id
                    ? 'bg-white shadow-sm'
                    : 'hover:bg-white/60'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(note.id)}
                onChange={() => onToggleSelect(note.id)}
                className={`mt-0.5 size-4 shrink-0 cursor-pointer rounded accent-foreground ${
                  selecting ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'
                }`}
              />
              <button
                type="button"
                onClick={() => selecting ? onToggleSelect(note.id) : onSelectNote(note.id)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-sm font-medium">
                  {note.title || 'Untitled'}
                </p>
                {note.preview && (
                  <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {note.preview}
                  </p>
                )}
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
                  {note.pinned && <Pin className="size-3 fill-current" />}
                  {note.attachmentsCount > 0 && <Paperclip className="size-3" />}
                  <span>{timeAgo(note.updatedAt)}</span>
                </div>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
