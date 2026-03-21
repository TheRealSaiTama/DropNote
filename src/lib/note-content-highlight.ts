function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function kind(line: string): 'done' | 'open' | 'plain' {
  if (/^\s*-\s*\[[xX]\]\s?/.test(line) || /^\s*[✓✔☑]\s?/.test(line)) return 'done'
  if (/^\s*-\s*\[\s\]\s?/.test(line) || /^\s*→\s?/.test(line) || /^\s*[•·]\s?/.test(line)) return 'open'
  return 'plain'
}

export function contentToHighlightHtml(content: string) {
  return content
    .split('\n')
    .map((line) => {
      const escaped = escapeHtml(line)
      const k = kind(line)
      if (k === 'done') return `<span class="note-hl-done">${escaped}</span>`
      if (k === 'open') return `<span class="note-hl-open">${escaped}</span>`
      return `<span class="note-hl-plain">${escaped}</span>`
    })
    .join('\n')
}
