import { useRef, useState } from 'react'

interface UseFileDropOptions {
  onFiles: (files: File[]) => Promise<void>
}

export function useFileDrop({ onFiles }: UseFileDropOptions) {
  const [isDragging, setIsDragging] = useState(false)
  const dragCount = useRef(0)

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault()
    dragCount.current++
    if (dragCount.current === 1) setIsDragging(true)
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault()
    dragCount.current--
    if (dragCount.current === 0) setIsDragging(false)
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault()
    dragCount.current = 0
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) await onFiles(files)
  }

  return { isDragging, onDragEnter, onDragLeave, onDragOver, onDrop }
}
