import { useEffect, useRef } from 'react'

export function usePasteAttachments(onFiles: (files: File[]) => Promise<void>) {
  const onFilesRef = useRef(onFiles)

  useEffect(() => {
    onFilesRef.current = onFiles
  })

  useEffect(() => {
    async function handlePaste(e: ClipboardEvent) {
      const items = Array.from(e.clipboardData?.items ?? [])
      const files = items
        .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((f): f is File => f !== null)
      if (files.length > 0) await onFilesRef.current(files)
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [])
}
