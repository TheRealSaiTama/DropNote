import { useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  FolderPlus,
  FolderClosed,
  Paperclip,
  Pencil,
  Pin,
  Plus,
  StickyNote,
  Trash2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { Folder as FolderRecord, FolderScope, Note, NoteFilter } from '@/types/note'

interface NotesListPaneProps {
  notes: Note[]
  folders: FolderRecord[]
  folderScope: FolderScope
  onFolderScopeChange: (scope: FolderScope) => void
  onCreateFolder: (name: string) => Promise<FolderRecord>
  onDeleteFolder: (folderId: string) => void | Promise<void>
  onRenameFolder: (folderId: string, name: string) => void | Promise<void>
  onMoveToFolder: (noteId: string, folderId: string | null) => void | Promise<void>
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
  onMoveToFolder,
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
  const [foldersOpen, setFoldersOpen] = useState(true)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const selecting = selectMode || selectedIds.size > 0

  function handleDone() {
    onClearSelection()
    setSelectMode(false)
  }

  async function submitNewFolder() {
    const name = newName.trim()
    if (!name) return
    try {
      const f = await onCreateFolder(name)
      setNewName('')
      setCreatingFolder(false)
      onFolderScopeChange(f.id)
    } catch {
      setNewName('')
    }
  }

  function startRename(f: FolderRecord) {
    setRenamingId(f.id)
    setRenameValue(f.name)
  }

  function submitRename() {
    if (!renamingId) return
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== folders.find((f) => f.id === renamingId)?.name) {
      void onRenameFolder(renamingId, trimmed)
    }
    setRenamingId(null)
    setRenameValue('')
  }

  function bulkMoveToFolder(folderId: string | null) {
    for (const noteId of selectedIds) {
      void onMoveToFolder(noteId, folderId)
    }
    onClearSelection()
    setSelectMode(false)
  }

  const activeFolderName = folders.find((f) => f.id === folderScope)?.name

  return (
    <div className="space-y-3">
      <div className="space-y-0.5">
        <button
          type="button"
          onClick={() => setFoldersOpen(!foldersOpen)}
          className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/80 transition-colors hover:text-foreground"
        >
          {foldersOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          Folders
          {activeFolderName && (
            <span className="ml-auto truncate text-[10px] font-normal normal-case tracking-normal text-foreground/60">
              {activeFolderName}
            </span>
          )}
        </button>

        {foldersOpen && (
          <div className="space-y-px pl-1">
            <button
              type="button"
              onClick={() => onFolderScopeChange('all')}
              className={`folder-row ${folderScope === 'all' ? 'folder-row-active' : ''}`}
            >
              <StickyNote className="size-3.5 shrink-0" />
              <span>All notes</span>
            </button>
            <button
              type="button"
              onClick={() => onFolderScopeChange('unfiled')}
              className={`folder-row ${folderScope === 'unfiled' ? 'folder-row-active' : ''}`}
            >
              <FolderOpen className="size-3.5 shrink-0 opacity-50" />
              <span>Unfiled</span>
            </button>

            {folders.map((f) => (
              <div key={f.id} className="group flex items-center">
                {renamingId === f.id ? (
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={submitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitRename()
                      if (e.key === 'Escape') { setRenamingId(null); setRenameValue('') }
                    }}
                    className="flex-1 rounded-lg bg-surface-strong/80 px-2.5 py-1.5 text-xs text-foreground outline-none ring-1 ring-ring/30"
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => onFolderScopeChange(f.id)}
                    className={`folder-row flex-1 ${folderScope === f.id ? 'folder-row-active' : ''}`}
                  >
                    <FolderClosed className="size-3.5 shrink-0" />
                    <span className="truncate">{f.name}</span>
                  </button>
                )}
                {renamingId !== f.id && (
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => startRename(f)}
                      className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                      aria-label="Rename"
                    >
                      <Pencil className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDeleteFolder(f.id)}
                      className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-destructive"
                      aria-label="Delete"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}

            {creatingFolder ? (
              <div className="flex items-center gap-1.5 py-0.5 pl-1">
                <FolderPlus className="size-3.5 shrink-0 text-muted-foreground" />
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Folder name…"
                  className="flex-1 rounded-lg bg-surface-strong/80 px-2.5 py-1.5 text-xs text-foreground outline-none ring-1 ring-ring/30"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void submitNewFolder()
                    if (e.key === 'Escape') { setCreatingFolder(false); setNewName('') }
                  }}
                  autoFocus
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreatingFolder(true)}
                className="folder-row text-muted-foreground/70 hover:text-foreground"
              >
                <Plus className="size-3.5 shrink-0" />
                <span>New folder</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="h-px bg-line/60" />

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
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-strong/80 px-3 py-2.5">
          <span className="text-xs font-medium">{selectedIds.size} selected</span>
          <button type="button" onClick={onSelectAllVisible} className="text-xs text-muted-foreground hover:text-foreground">
            All
          </button>
          <button type="button" onClick={handleDone} className="text-xs text-muted-foreground hover:text-foreground">
            Done
          </button>
          <div className="flex-1" />
          {selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <select
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '__none__') bulkMoveToFolder(null)
                  else if (v) bulkMoveToFolder(v)
                }}
                defaultValue=""
                className="h-7 rounded-lg border border-line/60 bg-white/80 px-2 text-xs text-foreground outline-none"
              >
                <option value="" disabled>Move to…</option>
                <option value="__none__">No folder</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <Button variant="ghost" size="sm" onClick={onBulkArchive} className="h-7 text-xs">
                {activeFilter === 'archived' ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
                {activeFilter === 'archived' ? 'Unarchive' : 'Archive'}
              </Button>
              <Button variant="ghost" size="sm" onClick={onBulkDelete} className="h-7 text-xs text-destructive hover:text-destructive">
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            </div>
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
          {notes.map((note) => {
            const noteFolder = note.folderId ? folders.find((f) => f.id === note.folderId) : null
            return (
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
                    {noteFolder && folderScope === 'all' && (
                      <span className="flex items-center gap-0.5 rounded bg-surface-strong/80 px-1 py-px text-[10px]">
                        <FolderClosed className="size-2.5" />
                        {noteFolder.name}
                      </span>
                    )}
                    <span>{timeAgo(note.updatedAt)}</span>
                  </div>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
