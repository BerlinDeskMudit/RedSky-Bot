import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

const homes: string[] = []

/**
 * Point `REDSKY_TEST_HOME` at a fresh temp directory and return it.
 *
 * The Electron stub resolves `app.getPath('userData')` from that variable, so
 * anything that reads or writes a store lands in a directory this test owns.
 * Call it before constructing the unit under test; the path is resolved lazily
 * on each call to `userDataDir()`.
 */
export function useTempHome(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'red-sky-test-'))
  process.env.REDSKY_TEST_HOME = dir
  homes.push(dir)
  return dir
}

/** Remove every directory created by `useTempHome()`. */
export function cleanupTempHomes(): void {
  for (const dir of homes.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
  delete process.env.REDSKY_TEST_HOME
}

/** Read and parse a JSON file written by a store. */
export function readJsonFile<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T
}

/** Let pending microtasks (promise chains) settle without waiting on a timer. */
export function drainMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}
