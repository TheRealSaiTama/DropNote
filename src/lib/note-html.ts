import DOMPurify from 'dompurify'

export function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export function sanitizeNoteHtml(html: string) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'div', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'span', 'font'],
    ALLOWED_ATTR: ['style', 'color', 'class'],
  })
}

export function normalizeNoteHtml(raw: string) {
  const t = raw ?? ''
  if (!t.trim()) return ''
  if (/<[a-z][\s\S]*>/i.test(t.trim())) return sanitizeNoteHtml(t)
  return `<div>${escapeHtml(t).replace(/\n/g, '<br/>')}</div>`
}
