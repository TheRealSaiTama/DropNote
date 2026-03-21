import { useState } from 'react'
import { Archive, ArchiveRestore, CheckSquare, Folder as FolderIcon, FolderPlus, Paperclip, Pin, Plus, StickyNote, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Folder as FolderRecord, FolderScope, Note, NoteFilter } from '@/types/note'

interface NotesListPaneProps {
  notes: Note[]
  folders: FolderRecord[]
  folderScope: FolderScope
  onFolderScopeChange: (scope: FolderScope) => void
  onCreateFolder: (name: string) => Promise<FolderRecord>
  onDeleteFolder: (folderId: string) => void | Promise<void>
  onRenameFolder: (folderId: string, name: string) => void | Promise<void>
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
  folders,
  folderScope,
  onFolderScopeChange,
  onCreateFolder,
  onDeleteFolder,
  onRenameFolder,
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
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const selecting = selectMode || selectedIds.size > 0

  function handleDone() {
    onClearSelection()
    setSelectMode(false)
  }

  async function submitNewFolder() {
    const name = newFolderName.trim()
    if (!name) return
    try {
      const f = await onCreateFolder(name)
      setNewFolderName('')
      setNewFolderOpen(false)
      onFolderScopeChange(f.id)
    } catch {
      setNewFolderName('')
    }
  }

  function startRename(folder: FolderRecord) {
    const next = window.prompt('Rename folder', folder.name)
    if (next === null) return
    const trimmed = next.trim()
    if (!trimmed || trimmed === folder.name) return
    void onRenameFolder(folder.id, trimmed)
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line/60 bg-surface-strong/50 p-2">
        <p className="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <FolderIcon className="size-3" />
          Folders
        </p>
        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            variant={folderScope === 'all' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 rounded-lg text-xs"
            onClick={() => onFolderScopeChange('all')}
          >
            All
          </Button>
          <Button
            type="button"
            variant={folderScope === 'unfiled' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 rounded-lg text-xs"
            onClick={() => onFolderScopeChange('unfiled')}
          >
            No folder
          </Button>
          {folders.map((f) => (
            <div key={f.id} className="group flex items-center gap-0.5">
              <Button
                type="button"
                variant={folderScope === f.id ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 max-w-[9rem] rounded-lg text-xs"
                onClick={() => onFolderScopeChange(f.id)}
                onDoubleClick={() => startRename(f)}
                title="Double-click to rename"
              >
                <span className="truncate">{f.name}</span>
              </Button>
              <button
                type="button"
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                aria-label={`Delete folder ${f.name}`}
                onClick={(e) => {
                  e.stopPropagation()
                  void onDeleteFolder(f.id)
                }}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
        {newFolderOpen ? (
          <div className="mt-2 flex gap-1.5 px-0.5">
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="h-9 flex-1 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitNewFolder()
                if (e.key === 'Escape') {
                  setNewFolderOpen(false)
                  setNewFolderName('')
                }
              }}
              autoFocus
            />
            <Button type="button" size="sm" className="h-9 shrink-0" onClick={() => void submitNewFolder()}>
              Add
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setNewFolderOpen(true)}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line/70 py-2 text-xs text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
          >
            <FolderPlus className="size-3.5" />
            New folder
          </button>
        )}
      </div>

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
          <p className="text-sm text-muted-foreground">No notes here</p>
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
