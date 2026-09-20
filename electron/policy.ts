import type { ReviewMode } from '../shared/types'

const SENSITIVE: RegExp[] = [
  /\b(send|email|mail|slack|post|tweet|publish)\b/i,
  /\b(delete|rm\s+-rf|drop\s+table|wipe)\b/i,
  /\b(spend|purchase|buy|charge|wire|transfer|invoice)\b/i,
  /\b(deploy|prod|production|drop\s+index)\b/i,
  /\b(grant|revoke|admin|sudo)\b/i,
]

export function needsHumanReview(text: string, mode: ReviewMode): boolean {
  const t = text.trim()
  if (!t) return false
  if (mode === 'off') return false
  if (mode === 'always') return true
  return SENSITIVE.some((re) => re.test(t))
}

export function reviewReason(text: string): string | undefined {
  for (const re of SENSITIVE) {
    if (re.test(text)) return `Matched sensitive pattern ${re.source}`
  }
  return undefined
}
