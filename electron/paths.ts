import { app } from 'electron'
import * as fs from 'node:fs'
import * as path from 'node:path'

/** User data dir — never wiped between tasks. */
export function userDataDir(): string {
  return app.getPath('userData')
}

/** Sandboxed working directory for the agent. All file/shell tools operate here. */
export function workspaceDir(): string {
  const dir = path.join(userDataDir(), 'workspace')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

/** Per-run tool / transcript logs. */
export function logsDir(): string {
  const dir = path.join(workspaceDir(), 'logs')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}