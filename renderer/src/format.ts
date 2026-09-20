import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { stripThinking } from '../../shared/visible'

export function renderMarkdown(text: string): string {
  const raw = marked.parse(stripThinking(text || ''), { async: false }) as string
  return DOMPurify.sanitize(raw)
}

export function timeLabel(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export { stripThinking }
