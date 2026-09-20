/** Drop model reasoning so the chat only shows finished work. */

const THINK_BLOCK = /<(?:think|thinking|reasoning)>([\s\S]*?)<\/(?:think|thinking|reasoning)>/gi
const FENCE = /```(?:thinking|reasoning|thought)[\s\S]*?```/gi

export function partLooksLikeThinking(part: Record<string, unknown>): boolean {
  const t = String(part.type ?? part.kind ?? '').toLowerCase()
  if (t.includes('reason') || t.includes('think') || t === 'thought') return true
  if (part.thinking === true || part.reasoning === true) return true
  return false
}

export function stripThinking(text: string): string {
  let s = String(text ?? '')
  s = s.replace(THINK_BLOCK, '')
  s = s.replace(FENCE, '')
  const open = s.search(/<(?:think|thinking|reasoning)>/i)
  if (open >= 0) s = s.slice(0, open)
  return s.replace(/^\s+/, '').replace(/\s+$/, '')
}

export function previewOf(text: string, max = 140): string {
  const clean = stripThinking(text).replace(/\s+/g, ' ').trim()
  return clean.slice(0, max)
}
