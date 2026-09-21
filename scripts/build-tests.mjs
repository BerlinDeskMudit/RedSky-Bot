import { build } from 'esbuild'
import { mkdir, readdir, rm } from 'node:fs/promises'
import * as path from 'node:path'

/**
 * Bundles `test/*.test.ts` into a single `build-tests/suite.test.cjs` so the
 * suites can run on plain `node --test` with no runtime TypeScript loader, no
 * glob support, and no shell dependency.
 *
 * Suites are discovered from the directory and pulled in through a generated
 * entry, so adding `test/foo.test.ts` needs no change here.
 *
 * Everything is bundled, including `electron/**`, except `electron` itself,
 * which is aliased to a test double — the real module only exists inside the
 * Electron runtime.
 */

const testDir = 'test'
const outDir = 'build-tests'
const outFile = path.join(outDir, 'suite.test.cjs')

await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })

const suites = (await readdir(testDir)).filter((name) => name.endsWith('.test.ts')).sort()

if (!suites.length) {
  console.error(`no *.test.ts files found in ${testDir}/`)
  process.exit(1)
}

// A generated entry file, so the suites are imported rather than passed as
// positional arguments to the test runner.
const entry = suites.map((name) => `import ${JSON.stringify(`./${testDir}/${name}`)}`).join('\n')

await build({
  bundle: true,
  stdin: { contents: entry, resolveDir: process.cwd(), sourcefile: 'test-suite.ts', loader: 'ts' },
  outfile: outFile,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  sourcemap: 'inline',
  logLevel: 'info',
  alias: { electron: path.resolve(testDir, 'stubs', 'electron.ts') },
})

console.log(`built ${suites.length} suite(s) → ${outFile}`)
