import { Archive, Paperclip, Pin, Plus, StickyNote } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { Note, NoteFilter } from '@/types/note'

interface NotesListPaneProps {
  notes: Note[]
  selectedNoteId: string | null
  activeFilter: NoteFilter
  onFilterChange: (value: NoteFilter) => void
  onSelectNote: (noteId: string) => void
  onCreateNote: () => void
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

export function NotesListPane({ notes, selectedNoteId, activeFilter, onFilterChange, onSelectNote, onCreateNote }: NotesListPaneProps) {
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
      </div>

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
            <button
              key={note.id}
              type="button"
              onClick={() => onSelectNote(note.id)}
              className={`w-full rounded-xl p-3 text-left transition-colors ${
                selectedNoteId === note.id
                  ? 'bg-white shadow-sm'
                  : 'hover:bg-white/60'
              }`}
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
          ))}
        </div>
      )}
    </div>
  )
}
