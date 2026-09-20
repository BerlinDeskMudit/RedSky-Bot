import * as fs from 'node:fs'
import * as path from 'node:path'
import { logsDir } from './paths'

export function audit(event: string, payload: Record<string, unknown>): void {
  try {
    const line = JSON.stringify({ ts: new Date().toISOString(), event, ...payload })
    fs.appendFileSync(path.join(logsDir(), 'audit.ndjson'), `${line}\n`, 'utf8')
  } catch {
    /* never throw */
  }
}
