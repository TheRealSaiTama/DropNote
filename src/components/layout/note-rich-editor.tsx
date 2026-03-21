import { useLayoutEffect, useRef } from 'react'
import { Bold, Italic, Strikethrough, Underline } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { normalizeNoteHtml, sanitizeNoteHtml } from '@/lib/note-html'

const COLORS = ['#161616', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#2563eb', '#9333ea']

type Props = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

export function NoteRichEditor({ value, onChange, placeholder }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const last = useRef<string | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (last.current === null) {
      el.innerHTML = normalizeNoteHtml(value)
      last.current = value
      return
    }
    if (value !== last.current) {
      el.innerHTML = normalizeNoteHtml(value)
      last.current = value
    }
  }, [value])

  function run(cmd: string, arg?: string) {
    const el = ref.current
    if (!el) return
    el.focus()
    document.execCommand(cmd, false, arg)
    const html = sanitizeNoteHtml(el.innerHTML)
    if (html !== el.innerHTML) el.innerHTML = html
    last.current = html
    onChange(html)
  }

  function onInput() {
    const el = ref.current
    if (!el) return
    const html = sanitizeNoteHtml(el.innerHTML)
    if (html !== el.innerHTML) el.innerHTML = html
    last.current = html
    onChange(html)
  }

  function onPaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') return
      }
    }
    const html = e.clipboardData?.getData('text/html')
    if (html) {
      e.preventDefault()
      const clean = sanitizeNoteHtml(html)
      document.execCommand('insertHTML', false, clean)
      onInput()
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div
        className="note-toolbar flex flex-wrap items-center gap-1 rounded-lg border border-line/50 bg-surface-strong/60 px-1.5 py-1"
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) e.preventDefault()
        }}
      >
        <Button type="button" variant="ghost" size="icon" className="size-8 rounded-md" aria-label="Bold" onClick={() => run('bold')}>
          <Bold className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-8 rounded-md" aria-label="Italic" onClick={() => run('italic')}>
          <Italic className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-8 rounded-md" aria-label="Underline" onClick={() => run('underline')}>
          <Underline className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-8 rounded-md" aria-label="Strikethrough" onClick={() => run('strikeThrough')}>
          <Strikethrough className="size-3.5" />
        </Button>
        <span className="mx-0.5 h-5 w-px bg-line-strong/60" aria-hidden />
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className="size-6 shrink-0 rounded-full border border-line/60 ring-offset-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ backgroundColor: c }}
            aria-label={`Text color ${c}`}
            onClick={() => run('foreColor', c)}
          />
        ))}
      </div>
      <div className="note-body-ruled flex min-h-0 flex-1 flex-col">
        <div
          ref={ref}
          className="note-body-editable min-h-0 flex-1"
          contentEditable
          role="textbox"
          aria-multiline
          aria-label={placeholder ?? 'Note body'}
          data-placeholder={placeholder ?? ''}
          suppressContentEditableWarning
          onInput={onInput}
          onPaste={onPaste}
        />
      </div>
    </div>
  )
}
