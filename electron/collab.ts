export interface MentionHit {
  botId: string
  name: string
}

export function parseMentions(
  text: string,
  bots: Array<{ id: string; name: string }>,
): { mentions: MentionHit[]; remainder: string } {
  const ranked = [...bots].sort((a, b) => b.name.length - a.name.length)
  const found: MentionHit[] = []
  let remainder = text
  for (const bot of ranked) {
    const re = new RegExp(`(?:^|\\s)@${escapeRegExp(bot.name)}\\b`, 'ig')
    if (!remainder.match(re)) continue
    remainder = remainder.replace(re, ' ').replace(/\s+/g, ' ').trim()
    if (!found.some((m) => m.botId === bot.id)) found.push({ botId: bot.id, name: bot.name })
  }
  return { mentions: found, remainder }
}

export function buildHandoffPrompt(opts: {
  fromName: string
  fromJob: string
  remainder: string
  threadTail: string
}): string {
  return [
    `[handoff from ${opts.fromName}${opts.fromJob ? ` · ${opts.fromJob}` : ''}]`,
    opts.remainder.trim(),
    opts.threadTail ? `\nContext:\n${opts.threadTail}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
