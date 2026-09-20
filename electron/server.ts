import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { EventEmitter } from 'node:events'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { opencodeHeaders } from './http'
import { workspaceDir, logsDir } from './paths'

export interface ServerHandle {
  baseUrl: string
  stop: () => void
}

/** Raw OpenCode server events (parsed SSE objects). */
export const serverEvents = new EventEmitter()

let abort: AbortController | null = null
let child: ChildProcessWithoutNullStreams | null = null
let stopped = false
let liveBaseUrl = ''

export function resolveOpencodeBin(): string {
  if (process.env.OPENCODE_BIN?.trim()) return process.env.OPENCODE_BIN.trim()
  const hits: string[] = []
  try {
    const out = execFileSync(process.platform === 'win32' ? 'where.exe' : 'which', ['opencode'], {
      encoding: 'utf8',
      windowsHide: true,
    })
    for (const line of out.split(/\r?\n/)) if (line.trim()) hits.push(line.trim())
  } catch {
    /* not on PATH for this process */
  }
  if (process.platform === 'win32') {
    const npmCmd = path.join(process.env.APPDATA || '', 'npm', 'opencode.cmd')
    const npmExe = path.join(process.env.APPDATA || '', 'npm', 'opencode')
    hits.push(npmCmd, npmExe)
  }
  const preferCmd = hits.find((h) => h.toLowerCase().endsWith('.cmd') && fs.existsSync(h))
  if (preferCmd) return preferCmd
  const existing = hits.find((h) => fs.existsSync(h))
  if (existing) return existing
  return process.platform === 'win32' ? 'opencode.cmd' : 'opencode'
}

/**
 * Start (or attach to) an OpenCode server scoped to the Red Sky workspace.
 * OpenCode is the agent runtime — not Ollama.
 */
export function startServer(): Promise<ServerHandle> {
  stopped = false
  return new Promise((resolve, reject) => {
    const existing = process.env.REDSKY_OPCODE_URL?.trim() || process.env.OPENCODE_SERVER_URL?.trim()
    if (existing) {
      const baseUrl = existing.replace(/\/+$/, '')
      console.log('[red-sky] attached to existing OpenCode server', baseUrl)
      liveBaseUrl = baseUrl
      serverEvents.emit('status', { state: 'online', detail: `opencode · ${baseUrl}` })
      connectStream(baseUrl)
      resolve({ baseUrl, stop })
      return
    }

    let settled = false
    const fail = (err: Error) => {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        reject(err)
      }
    }
    const timer = setTimeout(
      () => fail(new Error('Timed out starting OpenCode (is `opencode` on PATH? Install from https://opencode.ai — this app does not use Ollama.)')),
      45_000,
    )

    let lineBuf = ''
    const onLine = (line: string) => {
      const m =
        line.match(/listening on https?:\/\/([^:\s]+):(\d+)/i) ||
        line.match(/https?:\/\/(127\.0\.0\.1|localhost|\[::1\]):(\d+)/i)
      if (m && !settled) {
        settled = true
        clearTimeout(timer)
        const host = m[1] === 'localhost' ? '127.0.0.1' : m[1]
        const baseUrl = `http://${host}:${m[2]}`
        liveBaseUrl = baseUrl
        console.log('[red-sky] OpenCode server ready at', baseUrl)
        dsync(baseUrl)
        serverEvents.emit('status', { state: 'online', detail: `opencode · ${baseUrl}` })
        connectStream(baseUrl)
        resolve({ baseUrl, stop })
      } else if (line.trim()) {
        console.log('[red-sky serve]', line)
      }
    }

    const bin = resolveOpencodeBin()
    console.log('[red-sky] spawning OpenCode', bin)
    try {
      child = spawn(bin, ['serve', '--hostname', '127.0.0.1', '--port', '0', '--print-logs'], {
        cwd: workspaceDir(),
        shell: process.platform === 'win32',
        windowsHide: true,
        env: { ...process.env, OPENCODE_DISABLE_AUTOUPDATE: '1' },
      })
    } catch (err) {
      fail(err as Error)
      return
    }

    const feed = (chunk: Buffer) => {
      lineBuf += chunk.toString('utf8')
      for (;;) {
        const idx = lineBuf.indexOf('\n')
        if (idx < 0) break
        const line = lineBuf.slice(0, idx).replace(/\r$/, '')
        lineBuf = lineBuf.slice(idx + 1)
        onLine(line)
      }
    }
    child.stdout?.on('data', feed)
    child.stderr?.on('data', feed)
    child.on('error', (err) => {
      fail(
        new Error(
          `Failed to launch OpenCode (${bin}): ${err.message}. Install the OpenCode CLI (https://opencode.ai) and make sure it is on PATH. Ollama is not used.`,
        ),
      )
    })
    child.on('exit', (code) => {
      console.log('[red-sky] OpenCode exited', code)
      if (!stopped) serverEvents.emit('status', { state: 'offline', detail: `opencode exited (${code ?? '?'})` })
      if (!settled) fail(new Error(`OpenCode exited before it started listening (code ${code ?? '?'})`))
    })
  })
}

function dsync(baseUrl: string): void {
  const dir = logsDir()
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  fs.writeFileSync(path.join(dir, `server-${stamp}.info`), `listening at ${baseUrl}\n`, 'utf8')
}

function connectStream(baseUrl: string): void {
  let buf = ''
  const run = async () => {
    while (!stopped && liveBaseUrl === baseUrl) {
      try {
        abort = new AbortController()
        const headers = { ...opencodeHeaders(), accept: 'text/event-stream' }
        const res = await fetch(`${baseUrl}/event`, { signal: abort.signal, headers })
        if (!res.ok) throw new Error(`SSE ${res.status}`)
        if (!res.body) throw new Error('no response body')
        const reader = res.body.getReader()
        const dec = new TextDecoder()
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buf += dec.decode(value, { stream: true })
          let idx: number
          while ((idx = buf.indexOf('\n\n')) >= 0) {
            const block = buf.slice(0, idx)
            buf = buf.slice(idx + 2)
            const dataLines: string[] = []
            for (const line of block.split('\n')) {
              if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
            }
            const data = dataLines.join('\n')
            if (!data) continue
            try {
              const obj = JSON.parse(data) as { type: string; properties?: Record<string, unknown>; data?: unknown }
              guild(obj)
            } catch {
              /* skip keepalives that aren't json */
            }
          }
        }
      } catch (err) {
        if (!stopped && liveBaseUrl === baseUrl) console.log('[red-sky] sse reconnect:', (err as Error).message)
      }
      if (!stopped && liveBaseUrl === baseUrl) await new Promise((r) => setTimeout(r, 1500))
    }
  }
  void run()
}

function guild(evt: { type: string; properties?: Record<string, unknown>; data?: unknown }): void {
  if (evt.type === 'server.connected' || evt.type === 'server.heartbeat') return
  serverEvents.emit('event', evt)
}

export function stop(): void {
  stopped = true
  liveBaseUrl = ''
  abort?.abort()
  abort = null
  try {
    child?.kill('SIGTERM')
  } catch {
    /* already gone */
  }
  child = null
}
