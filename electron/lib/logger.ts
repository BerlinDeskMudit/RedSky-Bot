import * as fs from 'node:fs'
import * as path from 'node:path'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogLine {
  ts: string
  level: LogLevel
  msg: string
  ctx?: Record<string, unknown>
}

function sink(dir: string | undefined, line: LogLine): void {
  const encoded = JSON.stringify(line)
  if (line.level === 'error') console.error('[red-sky]', encoded)
  else console.log('[red-sky]', encoded)
  if (!dir) return
  try {
    fs.mkdirSync(dir, { recursive: true })
    fs.appendFileSync(path.join(dir, 'app.ndjson'), `${encoded}\n`, 'utf8')
  } catch {
    /* logging must never throw */
  }
}

export function createLogger(dir?: string) {
  const write = (level: LogLevel, msg: string, ctx?: Record<string, unknown>) =>
    sink(dir, { ts: new Date().toISOString(), level, msg, ctx })
  return {
    debug: (msg: string, ctx?: Record<string, unknown>) => write('debug', msg, ctx),
    info: (msg: string, ctx?: Record<string, unknown>) => write('info', msg, ctx),
    warn: (msg: string, ctx?: Record<string, unknown>) => write('warn', msg, ctx),
    error: (msg: string, ctx?: Record<string, unknown>) => write('error', msg, ctx),
  }
}
