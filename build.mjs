import { build as esbuild } from 'esbuild'

await esbuild({
  bundle: true,
  logLevel: 'info',
  entryPoints: ['electron/main.ts'],
  outfile: 'dist/main.js',
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['electron'],
})

await esbuild({
  bundle: true,
  logLevel: 'info',
  entryPoints: ['electron/preload.ts'],
  outfile: 'dist/preload.js',
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['electron'],
})

console.log('main + preload built → dist/')