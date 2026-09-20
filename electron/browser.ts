import { workspaceDir } from './paths'

/**
 * Phase 3: browser automation for the agent.
 *
 * Uses a Playwright persistent context rooted on disk so sessions survive,
 * powered by a tool description injected into the agent like:
 *
 *   browser_action(action: "navigate", url: "...") etc.
 *
 * "Sensitive" actions (submit forms, upload, click-on-login) gate on a
 * human-in-the-loop IPC prompt before they run. Phase 3 turns this on.
 */
export interface BrowserHandle {
  launch: () => Promise<void>
  close: () => Promise<void>
  isRunning: () => boolean
}

const profileDir = `${workspaceDir()}\\browser-profile`

export function createBrowserHandle(): BrowserHandle {
  let running = false
  return {
    async launch() {
      // TODO Phase 3: launch chromium.launchPersistentContext(profileDir, ...)
      void profileDir
      running = true
      console.log('[red-sky] browser tool enabled (Phase 3)')
    },
    async close() {
      running = false
    },
    isRunning: () => running,
  }
}