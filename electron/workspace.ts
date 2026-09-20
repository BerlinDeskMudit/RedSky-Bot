import * as fs from 'node:fs'
import * as path from 'node:path'
import { workspaceDir } from './paths'
import type { RunDiff, SearchHit } from '../shared/types'

export interface FileSnap {
  rel: string
  size: number
  mtime: number
}

const SKIP = new Set(['logs', 'node_modules', '.git', 'dist'])

function walk(dir: string, rel: string, out: FileSnap[]): void {
  if (out.length > 400) return
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    if (SKIP.has(e.name) || (e.name.startsWith('.') && e.name !== '.env.example')) continue
    const r = rel ? `${rel}/${e.name}` : e.name
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, r, out)
    else {
      try {
        const st = fs.statSync(p)
        out.push({ rel: r.replace(/\\/g, '/'), size: st.size, mtime: st.mtimeMs })
      } catch {
        /* skip */
      }
    }
  }
}

export function snapshotWorkspace(root = workspaceDir()): FileSnap[] {
  const out: FileSnap[] = []
  walk(root, '', out)
  return out
}

export function diffSnaps(before: FileSnap[], after: FileSnap[]): RunDiff {
  const a = new Map(before.map((x) => [x.rel, x]))
  const b = new Map(after.map((x) => [x.rel, x]))
  const added: string[] = []
  const changed: string[] = []
  const removed: string[] = []
  for (const [k, v] of b) {
    const prev = a.get(k)
    if (!prev) added.push(k)
    else if (prev.size !== v.size || Math.abs(prev.mtime - v.mtime) > 2) changed.push(k)
  }
  for (const k of a.keys()) {
    if (!b.has(k)) removed.push(k)
  }
  return { added: added.slice(0, 40), changed: changed.slice(0, 40), removed: removed.slice(0, 40), at: Date.now() }
}

export function importDroppedFiles(files: Array<{ name: string; data: ArrayBuffer | Uint8Array | number[] }>): string[] {
  const dir = path.join(workspaceDir(), 'inbox')
  fs.mkdirSync(dir, { recursive: true })
  const paths: string[] = []
  for (const f of files) {
    const safe = path.basename(f.name).replace(/[^\w.\- ()]/g, '_') || 'file'
    const dest = path.join(dir, `${Date.now().toString(36)}_${safe}`)
    const buf = Buffer.from(f.data as ArrayBuffer)
    fs.writeFileSync(dest, buf)
    paths.push(path.relative(workspaceDir(), dest).replace(/\\/g, '/'))
  }
  return paths
}

const TEXT_EXT = new Set(['.md', '.txt', '.json', '.ts', '.tsx', '.js', '.css', '.html', '.csv', '.yml', '.yaml', '.py'])

export function searchWorkspaceFiles(query: string, limit = 12): SearchHit[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const hits: SearchHit[] = []
  const snaps = snapshotWorkspace()
  for (const s of snaps) {
    const nameHit = s.rel.toLowerCase().includes(q)
    const ext = path.extname(s.rel).toLowerCase()
    let snippet = s.rel
    if (TEXT_EXT.has(ext) && s.size < 200_000) {
      try {
        const raw = fs.readFileSync(path.join(workspaceDir(), s.rel), 'utf8')
        const i = raw.toLowerCase().indexOf(q)
        if (i >= 0) {
          snippet = raw.slice(Math.max(0, i - 40), i + q.length + 60).replace(/\s+/g, ' ')
          hits.push({ id: `file_${s.rel}`, kind: 'file', title: s.rel, snippet, path: s.rel })
          if (hits.length >= limit) break
          continue
        }
      } catch {
        /* binary */
      }
    }
    if (nameHit) {
      hits.push({ id: `file_${s.rel}`, kind: 'file', title: s.rel, snippet, path: s.rel })
      if (hits.length >= limit) break
    }
  }
  return hits
}
