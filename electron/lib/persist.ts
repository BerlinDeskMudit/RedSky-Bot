import * as fs from 'node:fs'
import * as path from 'node:path'

/** Crash-safe JSON write: temp file then rename (copy+unlink fallback on Windows). */
export function writeJsonAtomic(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  const payload = `${JSON.stringify(value, null, 2)}\n`
  fs.writeFileSync(tmp, payload, { encoding: 'utf8', flag: 'w' })
  try {
    fs.renameSync(tmp, file)
  } catch {
    fs.copyFileSync(tmp, file)
    fs.unlinkSync(tmp)
  }
}

export function readJson<T>(file: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(file, 'utf8')
    if (!raw.trim()) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export class JsonStore<T> {
  constructor(
    private readonly file: string,
    private readonly fallback: T,
  ) {}

  read(): T {
    return readJson(this.file, this.fallback)
  }

  write(value: T): void {
    writeJsonAtomic(this.file, value)
  }
}
