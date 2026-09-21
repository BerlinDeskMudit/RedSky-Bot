# Development

Everything you need to build, run, and change Red Sky. Read
[CONTRIBUTING.md](../CONTRIBUTING.md) first for the workflow and review expectations.

- [Setup](#setup)
- [Scripts](#scripts)
- [Build pipeline](#build-pipeline)
- [Conventions](#conventions)
- [Recipes](#recipes)
- [Debugging](#debugging)
- [Packaging and OS warnings](#packaging-and-os-warnings)
- [Testing](#testing)

## Setup

- **Node.js 20 or newer** (the repo ships a `.nvmrc`; run `nvm use`).
- **The OpenCode CLI** on your `PATH` — Red Sky needs a real runtime to do anything beyond rendering the shell.
- A configured OpenCode provider, or the model picker will be empty.

```bash
git clone https://github.com/0xMudit/RedSky-Bot.git
cd RedSky-Bot
npm install          # also downloads the Electron binary (~100 MB)
npm start            # build + launch
```

`npm install` is the only setup step. There is no code generation, no database migration, and no environment
file to create.

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | `node build.mjs && vite build` then `electron .`. The app runs from `dist/`. |
| `npm run dev` | Alias of `npm start`. |
| `npm run build` | Build main + preload + renderer into `dist/` without launching. |
| `npm run typecheck` | `tsc --noEmit` across `electron/`, `renderer/src/`, and `shared/`. |

**There is no hot reload.** Every code change needs a rebuild and an app restart. `npm run build` alone is the
fast feedback loop for a typecheck-and-bundle sanity pass; CI runs exactly that.

## Build pipeline

| Output | Tool | Target | Notes |
| --- | --- | --- | --- |
| `dist/main.js` | esbuild (`build.mjs`) | Node 20, CommonJS | Entry `electron/main.ts`, bundles everything except `electron`. |
| `dist/preload.js` | esbuild (`build.mjs`) | Node 20, CommonJS | Entry `electron/preload.ts`, same externals. |
| `dist/renderer/` | Vite (`vite.config.ts`) | Browser ESM | Root is `renderer/`, `base: './'` so `file://` loading works, Tailwind 4 via its Vite plugin, `emptyOutDir` on. |

Main and preload are bundled rather than run from source because Electron loads a single JS file per process;
renderer code is bundled by Vite because it is a React app. `electron/**` may not use bundler-only imports that
ESM would need — keep to Node built-ins and `electron`.

The main process loads `dist/renderer/index.html` with `loadFile`, so a **relative** `base` is load-bearing.

## Conventions

The codebase is small and consistent; match what is there:

- **TypeScript is strict** (`strict: true`) and there are no `any`s in the tree — use `unknown` plus a narrow,
  as the existing modules do. Type-only imports use `import type`.
- **Formatting:** 2-space indentation, single quotes, **no semicolons**, trailing commas, ~120-column lines.
  There is no Prettier or ESLint config — `.editorconfig` encodes the whitespace rules, and review catches the
  rest. Please keep diffs formatting-neutral rather than reformatting files you aren't changing.
- **Exported functions carry explicit types**, including parameter and return types on stores and IPC
  handlers.
- **Comments explain intent, not mechanics.** The existing ones mark *why* something is unusual (a Windows
  fallback, a debounce, a reserved key) — keep that bar.
- **Errors are surfaced or deliberately dropped**, never silently ignored: user-visible failures set
  `bot.status = 'error'` with the server's message; logging and audit writes fail closed on purpose.
- **Renderer purity:** the renderer never touches Node, `fs`, or OpenCode. All capability flows through
  `window.redsky` and the typed wrapper in `renderer/src/api.ts`.

## Recipes

### Adding an IPC method

Four files, in this order:

1. **`shared/types.ts`** — add the method to the `RedSkyApi` interface and, if the renderer needs to react to
   it, a new member of the `EventEnvelope` union.
2. **`electron/main.ts`** — add an `ipcMain.handle('rs:yourThing', …)` in `wireIpc()`. Validate arguments here:
   this is the boundary, and the renderer is untrusted. Throw a plain `Error` with a user-readable message.
3. **`electron/preload.ts`** — expose it on the `redsky` object alongside its siblings. Nothing else crosses
   the bridge unless it is listed here; that allow-list is the security boundary.
4. **`renderer/src/api.ts`** — add a matching method to the `demoApi()` fallback so the UI still runs in a
   browser tab. Missing demo methods are the usual cause of "works in the app, crashes in the browser".

Then call it from the UI and push updates with `broadcast({ source: '…' })` if other windows or panels care.

### Adding a setting

1. Add the key to `AppSettings` in `shared/types.ts`.
2. Add it to `DEFAULT_SETTINGS` in `electron/settings.ts` **and** to `normalize()` in the same file, so a
   malformed value falls back instead of propagating. Mirror the default in `renderer/src/api.ts`.
3. Render a control in the Settings panel (`SettingsPanel` in `renderer/src/ui.tsx`). Settings are applied on
   Save, not on every keystroke.
4. If agents should read it, include it in `buildSystem()` in `electron/agent.ts`.

### Adding a store

Follow `electron/notices.ts`: a module-level `JsonStore<T>` over a file in `userData`, an exported
`createXStore()` returning `{ list, add, … }`, sizes capped, and a `persist()` called from every mutator.
Reads normalize; writes go through the atomic writer in `lib/persist.ts`. Register the new file in
[docs/CONFIGURATION.md](CONFIGURATION.md#data-locations) so users can find it.

## Debugging

- **Logs first.** `workspace/logs/app.ndjson` has structured main-process logs; `tools.ndjson` has every file
  and shell call an agent made; `server-*.info` records the OpenCode URL for each boot. Filter with `jq` — see
  [Logs](CONFIGURATION.md#logs).
- **OpenCode itself.** Run `opencode serve --hostname 127.0.0.1 --port 4096` in a terminal and start Red Sky
  with `REDSKY_OPCODE_URL=http://127.0.0.1:4096 npm start`. You get the server's own output and can hit its
  endpoints by hand.
- **DevTools.** The window is frameless and there is no DevTools accelerator wired up yet, so the current
  workaround is to add `mainWindow.webContents.openDevTools()` temporarily inside `createWindow()` in
  `electron/main.ts`. Adding a proper toggle is a welcome first PR.
- **UI without Electron.** Open `renderer/index.html` in a browser: `renderer/src/api.ts` falls back to
  `demoApi()` with in-memory fixtures, which is the fastest way to iterate on layout and styling.
- **Renderer events.** `window.redsky.onEvent(cb)` in DevTools shows the raw `EventEnvelope` stream.
- **App won't reach `online`.** The status bar carries the real error. 45 seconds and a timeout message means
  `opencode` was not found — set `OPENCODE_BIN` to an absolute path.

## Packaging and OS warnings

`npm start` runs the app from `dist/` through the locally installed Electron. There is **no packaging step
yet**: no `electron-builder`/`electron-forge` config, no installers, no code signing, and `build/icon.ico` is
the only platform icon.

That means:

- On Windows you may get a SmartScreen warning; use *More info → Run anyway*.
- On macOS the first launch of an unsigned Electron build may need **System Settings → Privacy & Security →
  Open Anyway**.
- The app reports as `Electron` in some OS surfaces, since it is not a signed bundle.

Packaging is on the [roadmap](../README.md#roadmap). If you want to take it on, keep the existing build
outputs as the input — `dist/main.js`, `dist/preload.js`, and `dist/renderer/` are the complete app.

If you add a packaging step, wire it to a new `npm run dist` script rather than changing `npm start`; the
current behavior is the documented developer loop and CI depends on it.

## Testing

**There are no tests yet.** No runner, no test files, no CI test step. That is the single biggest gap in the
repo, and contributions here are especially welcome.

The highest-value first targets, in order:

| Module | Why it is worth testing |
| --- | --- |
| `electron/policy.ts` | Pure functions, security-relevant, trivially testable: every pattern × every mode. |
| `electron/remind.ts` | Pure parsing of ambiguous natural language, with a long tail of phrasings and a cancel path. |
| `electron/scheduler.ts` | `nextDelayMs()` is pure and date-dependent — clock edges and invalid input are the interesting cases. |
| `electron/collab.ts` | Mention parsing with overlapping names and regex-escaping hazards. |
| `electron/memory.ts` | `extractMemoryLines()` and keyword scoring. |
| `electron/lib/persist.ts` | Atomicity, corrupt-file fallback, and Windows rename fallback. |
| `electron/workspace.ts` | `diffSnaps()` and the path-escape guard in `tools.ts`. |

Node's built-in `node:test` runner is the natural fit — no runtime test framework to adopt, and TypeScript
files can be run through the same esbuild setup the app already uses. When you add the first suite, add the
script to `package.json` and a step to `.github/workflows/ci.yml` in the same PR, so the gate exists from day
one. Keep tests hermetic: cap or inject `Date.now()`, and never point a test at a user's real `userData`
directory.
