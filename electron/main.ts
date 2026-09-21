import { app, BrowserWindow, ipcMain, Notification, shell } from 'electron'
import * as path from 'node:path'
import { createAgent, JOB_TEMPLATES, type AgentHandle } from './agent'
import { audit } from './audit'
import { createConnectorStore } from './connectors'
import { createLogger } from './lib/logger'
import { listModels } from './models'
import { createNoticeStore } from './notices'
import { logsDir, workspaceDir } from './paths'
import { createRoomStore } from './rooms'
import { createScheduler, type SchedulerHandle } from './scheduler'
import { startServer, serverEvents, stop as stopServer } from './server'
import { createSettingsStore } from './settings'
import { tools } from './tools'
import { previewOf } from '../shared/visible'
import type { ModelRef } from './http'
import type { AppSettings, Bot, ConnectorStatus, EventEnvelope, NoticeKind } from '../shared/types'

let mainWindow: BrowserWindow | null = null
let baseUrl = ''
let agent: AgentHandle | null = null
let scheduler: SchedulerHandle | null = null
let settingsStore: ReturnType<typeof createSettingsStore> | undefined
let connectorStore: ReturnType<typeof createConnectorStore> | undefined
let roomStore: ReturnType<typeof createRoomStore> | undefined
let noticeStore: ReturnType<typeof createNoticeStore> | undefined
const lastBotStatus = new Map<string, Bot['status']>()
const log = createLogger()

function settings(): ReturnType<typeof createSettingsStore> {
  return (settingsStore ??= createSettingsStore())
}
function connectors(): ReturnType<typeof createConnectorStore> {
  return (connectorStore ??= createConnectorStore())
}
function rooms(): ReturnType<typeof createRoomStore> {
  return (roomStore ??= createRoomStore())
}
function notices(): ReturnType<typeof createNoticeStore> {
  return (noticeStore ??= createNoticeStore())
}

function pushNotice(bot: Bot, kind: NoticeKind, title: string, body: string, alwaysOs = false): void {
  const notice = notices().add({ kind, botId: bot.id, title, body })
  broadcast({ source: 'notice', notice })
  const focused = Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused())
  if ((alwaysOs || !focused) && Notification.isSupported()) {
    new Notification({ title, body: body.slice(0, 180) }).show()
  }
}

function onAgentEvent(evt: EventEnvelope): void {
  broadcast(evt)
  if (evt.source !== 'bot') return
  const bot = evt.bot
  const prev = lastBotStatus.get(bot.id)
  lastBotStatus.set(bot.id, bot.status)
  if (prev === 'running' && bot.status === 'idle') {
    const last = [...bot.thread].reverse().find((m) => m.role === 'assistant')
    pushNotice(bot, 'done', `${bot.name} is back`, previewOf(last?.text || 'Done.') || 'Done.')
  } else if (bot.status === 'waiting' && prev !== 'waiting') {
    pushNotice(bot, 'waiting', `${bot.name} needs you`, bot.pendingPermission?.title || 'Waiting on you')
  } else if (bot.status === 'error' && prev !== 'error') {
    pushNotice(bot, 'error', `${bot.name} hit an error`, bot.error || 'Something failed')
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#141412',
    title: 'Red Sky',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  void mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'renderer', 'index.html'))
}

function broadcast(evt: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('rs:event', evt)
  }
}

function parseModel(encoded?: string): ModelRef | undefined {
  if (!encoded) return undefined
  const sep = encoded.indexOf('\u241f')
  if (sep <= 0) return undefined
  const providerID = encoded.slice(0, sep)
  const modelID = encoded.slice(sep + 1)
  return providerID && modelID ? { providerID, modelID } : undefined
}

function requireAgent(): AgentHandle {
  if (!agent) throw new Error('app is still starting')
  return agent
}

function wireIpc(): void {
  ipcMain.handle('rs:init', async () => {
    const a = requireAgent()
    const models = baseUrl ? await listModels(baseUrl) : []
    return {
      status: baseUrl ? 'online' : 'starting',
      baseUrl: baseUrl || null,
      workspace: workspaceDir(),
      logs: logsDir(),
      models,
      bots: a.listBots(),
      memories: a.memory.list(),
      routines: scheduler?.rows() ?? [],
      templates: JOB_TEMPLATES,
      connectors: connectors().list(),
      rooms: rooms().list(),
      notices: notices().list(),
      settings: settings().get(),
      runtime: 'opencode',
    }
  })

  ipcMain.handle('rs:models', async () => listModels(baseUrl))

  ipcMain.handle('rs:createBot', async (_e, payload?: { name?: string; job?: string }) => requireAgent().createBot(payload))

  ipcMain.handle('rs:renameBot', async (_e, botId: string, payload: { name: string; job?: string }) =>
    requireAgent().renameBot(botId, payload.name, payload.job),
  )

  ipcMain.handle('rs:duplicateBot', async (_e, botId: string) => requireAgent().duplicateBot(botId))

  ipcMain.handle('rs:setBotFlags', async (_e, botId: string, flags: { pinned?: boolean; archived?: boolean }) =>
    requireAgent().setBotFlags(botId, flags ?? {}),
  )

  ipcMain.handle('rs:branchFrom', async (_e, botId: string, messageId: string, model?: string) => {
    const a = requireAgent()
    const message = a.getBot(botId)?.thread.find((m) => m.id === messageId)
    if (!message) throw new Error('message not found')
    // Branching from a result means a fresh take on the ask that produced it, so the
    // prompt is resolved here rather than trusted from the renderer.
    const prompt = message.role === 'user' ? message.text : a.lastUserPrompt(botId) || message.text
    if (!prompt.trim()) throw new Error('nothing to branch from yet — send a task first')
    return a.branchFrom(botId, prompt, parseModel(model))
  })

  ipcMain.handle('rs:search', async (_e, query: string) => (query?.trim() ? requireAgent().search(query.trim()) : []))

  ipcMain.handle('rs:send', async (_e, botId: string, payload: { text: string; model?: string; roomId?: string }) => {
    if (!payload?.text?.trim()) throw new Error('empty prompt')
    if (!baseUrl) throw new Error('OpenCode is still starting')
    return requireAgent().send(botId, { text: payload.text, model: parseModel(payload.model), roomId: payload.roomId })
  })

  ipcMain.handle('rs:abortBot', async (_e, botId: string) => {
    await requireAgent().abort(botId)
    return { ok: true }
  })

  ipcMain.handle('rs:listBots', async () => requireAgent().listBots())

  ipcMain.handle('rs:deleteBot', async (_e, botId: string) => {
    await requireAgent().deleteBot(botId)
    return { ok: true }
  })

  ipcMain.handle('rs:patchMessage', async (_e, botId: string, messageId: string, text: string) => {
    if (!text?.trim()) throw new Error('empty message')
    return requireAgent().patchMessage(botId, messageId, text.trim())
  })
  ipcMain.handle('rs:deleteMessage', async (_e, botId: string, messageId: string) => requireAgent().deleteMessage(botId, messageId))
  ipcMain.handle('rs:clearThread', async (_e, botId: string) => requireAgent().clearThread(botId))
  ipcMain.handle('rs:resendFrom', async (_e, botId: string, messageId: string, model?: string) =>
    requireAgent().resendFrom(botId, messageId, parseModel(model)),
  )

  ipcMain.handle('rs:permission', async (_e, payload: { botId: string; permissionId: string; response: 'once' | 'always' | 'reject' }) => {
    await requireAgent().respondPermission(payload.botId, payload.permissionId, payload.response)
    return { ok: true }
  })

  ipcMain.handle('rs:files', async (_e, rel?: string) => requireAgent().listFiles(rel))
  ipcMain.handle('rs:fileContent', async (_e, rel: string) => requireAgent().readFile(rel))

  ipcMain.handle('rs:listMemories', async (_e, botId?: string) => requireAgent().memory.list(botId))

  ipcMain.handle('rs:addMemory', async (_e, payload: { key: string; value: string; botId?: string }) => {
    if (!payload?.key?.trim() || !payload?.value?.trim()) throw new Error('key and value required')
    return requireAgent().memory.add(payload.key.trim(), payload.value.trim(), payload.botId)
  })

  ipcMain.handle('rs:deleteMemory', async (_e, id: string) => {
    requireAgent().memory.remove(id)
    return { ok: true }
  })

  ipcMain.handle('rs:clearMemories', async () => {
    requireAgent().memory.clear()
    return { ok: true }
  })

  ipcMain.handle('rs:listRoutines', async () => scheduler?.rows() ?? [])
  ipcMain.handle('rs:addRoutine', async (_e, payload: { botId: string; schedule: string; prompt: string; origin?: 'manual' | 'taught' }) => {
    if (!scheduler) throw new Error('scheduler not ready')
    if (!payload.botId || !payload.schedule?.trim() || !payload.prompt?.trim()) throw new Error('bot, schedule, and prompt required')
    return scheduler.add(payload.botId, payload.schedule, payload.prompt, payload.origin)
  })
  ipcMain.handle('rs:removeRoutine', async (_e, id: string) => {
    scheduler?.remove(id)
    return { ok: true }
  })
  ipcMain.handle('rs:toggleRoutine', async (_e, id: string, enabled: boolean) => {
    scheduler?.setEnabled(id, enabled)
    return { ok: true }
  })
  ipcMain.handle('rs:teachRoutine', async (_e, payload: { botId: string; schedule: string }) => {
    if (!scheduler) throw new Error('scheduler not ready')
    const prompt = requireAgent().lastUserPrompt(payload.botId)
    if (!prompt?.trim()) throw new Error('no task to teach yet — send one first')
    return scheduler.add(payload.botId, payload.schedule, prompt, 'taught')
  })
  ipcMain.handle('rs:setWatchMode', async (_e, botId: string, enabled: boolean) => requireAgent().setWatchMode(botId, enabled))

  ipcMain.handle('rs:listConnectors', async () => connectors().list())
  ipcMain.handle('rs:updateConnector', async (_e, payload: { id: string; status: ConnectorStatus; note?: string }) => {
    const row = connectors().upsert(payload.id, payload.status, payload.note)
    broadcast({ source: 'connectors', connectors: connectors().list() })
    return row
  })

  ipcMain.handle('rs:listRooms', async () => rooms().list())
  ipcMain.handle('rs:createRoom', async (_e, payload: { title?: string; participantIds: string[] }) => {
    if (!payload?.participantIds?.length) throw new Error('pick at least one bot')
    const room = rooms().create(payload.title ?? 'Thread', payload.participantIds)
    for (const id of payload.participantIds) requireAgent().attachRoom(id, room.id)
    broadcast({ source: 'rooms', rooms: rooms().list() })
    return room
  })
  ipcMain.handle('rs:addToRoom', async (_e, roomId: string, botId: string) => {
    const room = rooms().addParticipant(roomId, botId)
    requireAgent().attachRoom(botId, room.id)
    broadcast({ source: 'rooms', rooms: rooms().list() })
    return room
  })
  ipcMain.handle('rs:renameRoom', async (_e, roomId: string, title: string) => {
    const room = rooms().rename(roomId, title)
    broadcast({ source: 'rooms', rooms: rooms().list() })
    return room
  })
  ipcMain.handle('rs:deleteRoom', async (_e, roomId: string) => {
    rooms().delete(roomId)
    broadcast({ source: 'rooms', rooms: rooms().list() })
    return { ok: true }
  })

  ipcMain.handle('rs:listNotices', async () => notices().list())
  ipcMain.handle('rs:markNoticeRead', async (_e, id: string) => notices().markRead(id))
  ipcMain.handle('rs:markAllNoticesRead', async () => notices().markAllRead())
  ipcMain.handle('rs:clearNotices', async () => {
    notices().clear()
    broadcast({ source: 'notices', notices: [] })
    return { ok: true }
  })

  ipcMain.handle('rs:getSettings', async () => settings().get())
  ipcMain.handle('rs:updateSettings', async (_e, patch: Partial<AppSettings>) => {
    const next = settings().update(patch)
    broadcast({ source: 'settings', settings: next })
    return next
  })

  ipcMain.handle('rs:tool', async (_e, payload: { name: string; args: unknown[] }) => {
    const fn = (tools as Record<string, unknown>)[payload.name] as ((...a: never[]) => Promise<unknown>) | undefined
    if (!fn) throw new Error(`unknown tool: ${payload.name}`)
    return fn(...(payload.args as never[]))
  })

  ipcMain.handle('rs:openWorkspace', async () => {
    void shell.openPath(workspaceDir())
    return { ok: true }
  })

  ipcMain.handle('rs:openLogs', async () => {
    void shell.openPath(logsDir())
    return { ok: true }
  })

  ipcMain.on('win:minimize', () => mainWindow?.minimize())
  ipcMain.on('win:maximize', () => {
    if (!mainWindow) return
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.on('win:close', () => mainWindow?.close())
}

serverEvents.on('status', (evt) => broadcast({ source: 'status', ...(evt as object) }))

wireIpc()

app.whenReady().then(async () => {
  log.info('app.ready')
  if (process.platform === 'win32') app.setAppUserModelId('com.redsky.app')
  scheduler = createScheduler((row) => {
    const a = agent
    if (!a) return
    const bot = a.getBot(row.botId) ?? a.listBots()[0]
    if (!bot) return
    if (row.origin === 'reminder') {
      a.nudgeReminder(bot.id, row.prompt)
      pushNotice(bot, 'reminder', `${bot.name} · reminder`, row.prompt, true)
      return
    }
    if (!baseUrl) return
    void a.send(bot.id, { text: `[scheduled ${row.schedule}] ${row.prompt}` }).catch((err) => {
      log.error('routine.failed', { id: row.id, err: (err as Error).message })
    })
  })
  agent = createAgent({
    connectors: connectors(),
    rooms: rooms(),
    settings: settings(),
    scheduleReminder: (botId, schedule, prompt) => {
      const row = scheduler!.add(botId, schedule, prompt, 'reminder')
      broadcast({ source: 'routines', routines: scheduler!.rows() })
      return row
    },
    cancelReminders: (botId) => {
      const n = scheduler!.removeReminders(botId)
      broadcast({ source: 'routines', routines: scheduler!.rows() })
      return n
    },
  })
  agent.events.on('event', (evt) => onAgentEvent(evt as EventEnvelope))
  createWindow()
  broadcast({ source: 'status', state: 'starting', detail: 'starting OpenCode…' })

  try {
    const handle = await startServer()
    baseUrl = handle.baseUrl
    agent.attach(baseUrl)
    broadcast({ source: 'status', state: 'online', detail: `opencode · ${baseUrl}` })
    audit('runtime.online', { baseUrl })
  } catch (err) {
    log.error('opencode.start.failed', { err: (err as Error).message })
    serverEvents.emit('status', { state: 'offline', detail: (err as Error).message })
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  scheduler?.stop()
  stopServer()
})
