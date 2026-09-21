import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

/**
 * Test double for the `electron` module.
 *
 * `electron` only exists inside the Electron runtime, so `scripts/build-tests.mjs`
 * aliases the import to this file while bundling the tests. Only `app.getPath`
 * needs to be real — `electron/paths.ts` is the sole Electron dependency
 * reachable from the modules under test — and the rest exist so that importing a
 * module never explodes.
 *
 * The directory is read from `REDSKY_TEST_HOME` on every call rather than
 * captured at import time, so a test can point a store at a fresh directory
 * before constructing it (see `test/helpers.ts`).
 */
export const app = {
  getPath: (name = 'userData'): string => {
    const root = process.env.REDSKY_TEST_HOME || path.join(os.tmpdir(), 'red-sky-tests')
    fs.mkdirSync(root, { recursive: true })
    void name
    return root
  },
  getName: (): string => 'red-sky',
  getVersion: (): string => '0.0.0-test',
  whenReady: (): Promise<void> => Promise.resolve(),
  on: (): void => undefined,
  quit: (): void => undefined,
  setAppUserModelId: (): void => undefined,
}
