import React, { useMemo, useState } from 'react'
import { api } from './api'
import { renderMarkdown, timeLabel } from './format'
import type {
  AppSettings,
  Bot,
  ChatMessage,
  Connector,
  FileNode,
  JobTemplate,
  MemoryRow,
  ReviewMode,
  Room,
  Routine,
} from './types'

export function BlobAvatar({ hue, size = 32 }: { hue: string; size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className="shrink-0 overflow-visible" aria-hidden>
      <path fill={hue} d="M27.4 16.2c0 7.1-5.2 12.4-11.4 12.4S4.6 23.3 4.6 16.2 9.8 3.8 16 3.8s11.4 5.3 11.4 12.4Z" />
      <ellipse cx="12.3" cy="15.2" rx="2.15" ry="2.5" fill="#1a1a1a" />
      <ellipse cx="20.2" cy="15.2" rx="2.15" ry="2.5" fill="#1a1a1a" />
      <circle cx="12.9" cy="14.3" r="0.7" fill="#fff" />
      <circle cx="20.8" cy="14.3" r="0.7" fill="#fff" />
    </svg>
  )
}

export function IconBtn({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      title={title}
      onClick={onClick}
      className="w-6 h-6 rounded-[6px] flex items-center justify-center"
      style={{
        background: active ? 'var(--bg-active)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
      }}
    >
      {children}
    </button>
  )
}

export function MessageBlock({
  role,
  text,
  hue,
  name,
  kind,
  editing,
  draft,
  onDraft,
  onSave,
  onCancel,
  onCopy,
  onEdit,
  onDelete,
  onResend,
  onBranch,
}: {
  role: ChatMessage['role']
  text: string
  hue: string
  name: string
  kind?: ChatMessage['kind']
  editing?: boolean
  draft?: string
  onDraft?: (v: string) => void
  onSave?: () => void
  onCancel?: () => void
  onCopy?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onResend?: () => void
  onBranch?: () => void
}): React.JSX.Element {
  const html = useMemo(() => renderMarkdown(text), [text])
  const actions = (
    <div className="msg-actions flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
      {onCopy && (
        <button onClick={onCopy} className="text-[10px] px-1.5 py-0.5 rounded-md hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-tertiary)' }}>
          Copy
        </button>
      )}
      {onEdit && (
        <button onClick={onEdit} className="text-[10px] px-1.5 py-0.5 rounded-md hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-tertiary)' }}>
          Edit
        </button>
      )}
      {onResend && (
        <button onClick={onResend} className="text-[10px] px-1.5 py-0.5 rounded-md hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-accent)' }}>
          Replay
        </button>
      )}
      {onBranch && (
        <button onClick={onBranch} className="text-[10px] px-1.5 py-0.5 rounded-md hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-accent)' }}>
          Branch
        </button>
      )}
      {onDelete && (
        <button onClick={onDelete} className="text-[10px] px-1.5 py-0.5 rounded-md hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-danger)' }}>
          Delete
        </button>
      )}
    </div>
  )
  if (editing) {
    return (
      <div className={`flex ${role === 'user' ? 'justify-end' : 'gap-2.5 items-start'}`}>
        {role !== 'user' && <BlobAvatar hue={hue} size={28} />}
        <div className="max-w-[82%] w-full">
          <textarea
            value={draft ?? text}
            onChange={(e) => onDraft?.(e.target.value)}
            className="w-full rounded-2xl px-3.5 py-2.5 text-[14px] leading-5 outline-none resize-y min-h-[72px]"
            style={{ background: 'var(--raised)', border: '0.5px solid var(--border)', color: 'var(--text-primary)' }}
          />
          <div className="flex gap-2 mt-1.5">
            <button onClick={onSave} className="text-[12px] rounded-full px-3 py-1" style={{ background: 'var(--fill-emphasis)', color: 'var(--bubble-user-ink)' }}>
              Save
            </button>
            <button onClick={onCancel} className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }
  if (kind === 'reminder') {
    return (
      <div className="flex justify-center">
        <div
          className="rounded-full px-3.5 py-1.5 text-[13px] result-pop"
          style={{ background: 'color-mix(in srgb, var(--text-warning) 16%, var(--bubble-agent))', color: 'var(--text-primary)', border: '0.5px solid color-mix(in srgb, var(--text-warning) 35%, transparent)' }}
        >
          Reminder · {text}
        </div>
      </div>
    )
  }
  if (role === 'user') {
    return (
      <div className="group flex flex-col items-end">
        <div
          className="rounded-2xl px-3.5 py-2.5 text-[14px] leading-5 whitespace-pre-wrap max-w-[72%]"
          style={{ background: 'var(--bubble-user)', color: 'var(--bubble-user-ink)' }}
        >
          {text}
        </div>
        {actions}
      </div>
    )
  }
  return (
    <div className="group flex gap-2.5 items-start">
      <BlobAvatar hue={hue} size={28} />
      <div className="min-w-0">
        <div
          className="markdown-body text-[14px] leading-5 max-w-[82%] rounded-2xl px-3.5 py-2.5 result-pop"
          style={{ background: 'var(--bubble-agent)', color: 'var(--text-primary)' }}
          title={name}
        >
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </div>
        {actions}
      </div>
    </div>
  )
}

export function RunningDots({ hue }: { hue: string }): React.JSX.Element {
  return (
    <div className="flex gap-2.5 items-center">
      <BlobAvatar hue={hue} size={28} />
      <div className="flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  )
}

export function TrafficLights(): React.JSX.Element {
  return (
    <div className="window-no-drag flex items-center gap-[7px] pr-1">
      <button aria-label="Close" onClick={() => api.windowClose()} className="w-3 h-3 rounded-full bg-[#ff5f57]" />
      <button aria-label="Minimize" onClick={() => api.windowMinimize()} className="w-3 h-3 rounded-full bg-[#febc2e]" />
      <button aria-label="Zoom" onClick={() => api.windowMaximize()} className="w-3 h-3 rounded-full bg-[#28c840]" />
    </div>
  )
}

export function EmptyState({
  templates,
  onPick,
  onNew,
}: {
  templates: JobTemplate[]
  onPick: (t: JobTemplate) => void
  onNew: () => void
}): React.JSX.Element {
  return (
    <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-center px-8">
      <h2 className="text-[28px] font-medium tracking-tight">Meet your first Bot</h2>
      <p className="mt-2 text-[14px] max-w-md leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        Give it a job. It works on this machine, keeps context, and comes back when it needs you.
      </p>
      <button
        onClick={onNew}
        className="mt-5 rounded-full text-[13px] font-medium px-4 py-2"
        style={{ background: 'var(--fill-emphasis)', color: 'var(--bubble-user-ink)' }}
      >
        New agent
      </button>
      <div className="mt-8 flex flex-wrap justify-center gap-1.5 max-w-xl">
        {templates.map((t) => (
          <button
            key={t.name}
            onClick={() => onPick(t)}
            className="rounded-full px-3 py-1.5 text-[12px] hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--text-secondary)', border: '0.5px solid var(--border)' }}
          >
            {t.name}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ComputerPanel({
  bot,
  files,
  fileView,
  onOpenWorkspace,
  onOpenFile,
}: {
  bot: Bot | null
  files: FileNode[]
  fileView: { path: string; content: string } | null
  onOpenWorkspace: () => void
  onOpenFile: (p: string) => void
}): React.JSX.Element {
  return (
    <>
      <div className="h-11 px-4 flex items-center justify-between shrink-0" style={{ borderBottom: '0.5px solid var(--border)' }}>
        <h2 className="text-[13px] font-medium">{bot ? `${bot.name}'s computer` : 'Computer'}</h2>
        <button onClick={onOpenWorkspace} className="text-[11px]" style={{ color: 'var(--text-accent)' }}>
          Open folder
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <section>
          <h3 className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
            Activity
          </h3>
          {(bot?.computer ?? [])
            .slice()
            .reverse()
            .map((c) => (
              <div key={c.id} className="mb-2 rounded-[12px] px-2.5 py-2" style={{ background: 'var(--bg-card)' }}>
                <div className="text-[12px]">{c.title}</div>
                <div className="text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>
                  {c.detail}
                </div>
              </div>
            ))}
          {!bot?.computer.length && (
            <p className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
              No tool activity yet.
            </p>
          )}
        </section>
        <section>
          <h3 className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
            Workspace
          </h3>
          {files.map((f) => (
            <button
              key={f.path}
              onClick={() => onOpenFile(f.path)}
              className="block w-full text-left text-[12px] py-1 hover:text-white truncate"
              style={{ color: 'var(--text-secondary)' }}
            >
              {f.name || f.path}
            </button>
          ))}
        </section>
        {fileView && (
          <section>
            <h3 className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
              {fileView.path}
            </h3>
            <pre className="text-[11px] whitespace-pre-wrap rounded-[10px] p-2 max-h-64 overflow-auto" style={{ background: '#111', color: 'var(--text-secondary)' }}>
              {fileView.content}
            </pre>
          </section>
        )}
      </div>
    </>
  )
}

export function MemoryPanel({
  memories,
  botId,
  onChange,
}: {
  memories: MemoryRow[]
  botId?: string
  onChange: (m: MemoryRow[]) => void
}): React.JSX.Element {
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const add = async () => {
    if (!key.trim() || !value.trim()) return
    await api.addMemory({ key: key.trim(), value: value.trim(), botId })
    setKey('')
    setValue('')
    onChange(await api.listMemories(botId))
  }
  return (
    <>
      <div className="h-11 px-4 flex items-center justify-between shrink-0" style={{ borderBottom: '0.5px solid var(--border)' }}>
        <h2 className="text-[13px] font-medium">Memory</h2>
        <button
          onClick={async () => {
            await api.clearMemories()
            onChange([])
          }}
          className="text-[11px]"
          style={{ color: 'var(--text-danger)' }}
        >
          Clear
        </button>
      </div>
      <div className="p-3 grid gap-2" style={{ borderBottom: '0.5px solid var(--border)' }}>
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="key" className="rounded-[10px] px-2 py-1.5 text-[12px] outline-none" style={{ background: 'var(--bg-tertiary)', border: '0.5px solid var(--border)' }} />
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="what to remember" className="rounded-[10px] px-2 py-1.5 text-[12px] outline-none" style={{ background: 'var(--bg-tertiary)', border: '0.5px solid var(--border)' }} />
        <button onClick={() => void add()} disabled={!key.trim() || !value.trim()} className="rounded-[10px] py-1.5 text-[12px] disabled:opacity-40" style={{ background: 'var(--bg-active)' }}>
          Remember
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {memories.map((m) => (
          <div key={m.id} className="rounded-[12px] px-3 py-2" style={{ background: 'var(--bg-card)' }}>
            <div className="flex justify-between gap-2">
              <span className="text-[12px] font-medium" style={{ color: 'var(--text-accent)' }}>
                {m.key}
              </span>
              <button
                onClick={async () => {
                  await api.deleteMemory(m.id)
                  onChange(await api.listMemories(botId))
                }}
                className="text-[10px]"
                style={{ color: 'var(--text-tertiary)' }}
              >
                remove
              </button>
            </div>
            <p className="text-[12px] mt-1" style={{ color: 'var(--text-secondary)' }}>
              {m.value}
            </p>
          </div>
        ))}
      </div>
    </>
  )
}

export function RoutinePanel({
  routines,
  bots,
  selectedId,
  onChange,
}: {
  routines: Routine[]
  bots: Bot[]
  selectedId?: string
  onChange: (r: Routine[]) => void
}): React.JSX.Element {
  const [schedule, setSchedule] = useState('every 60 m')
  const [prompt, setPrompt] = useState('')
  const botId = selectedId ?? bots[0]?.id ?? ''
  const add = async () => {
    if (!botId || !prompt.trim()) return
    await api.addRoutine({ botId, schedule, prompt: prompt.trim() })
    setPrompt('')
    onChange(await api.listRoutines())
  }
  const teach = async () => {
    if (!botId) return
    await api.teachRoutine({ botId, schedule })
    onChange(await api.listRoutines())
  }
  return (
    <>
      <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--border)' }}>
        <h2 className="text-[13px] font-medium">Routines</h2>
        <p className="text-[11px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
          Teach a finished task, or schedule with `every 30 m`, `every 2 h`, or `09:00`.
        </p>
      </div>
      <div className="p-3 grid gap-2" style={{ borderBottom: '0.5px solid var(--border)' }}>
        <input value={schedule} onChange={(e) => setSchedule(e.target.value)} className="rounded-[10px] px-2 py-1.5 text-[12px] outline-none" style={{ background: 'var(--bg-tertiary)', border: '0.5px solid var(--border)' }} />
        <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="what to run" className="rounded-[10px] px-2 py-1.5 text-[12px] outline-none" style={{ background: 'var(--bg-tertiary)', border: '0.5px solid var(--border)' }} />
        <button onClick={() => void add()} disabled={!prompt.trim() || !botId} className="rounded-[10px] py-1.5 text-[12px] disabled:opacity-40" style={{ background: 'var(--bg-active)' }}>
          Schedule
        </button>
        <button onClick={() => void teach()} disabled={!botId} className="rounded-[10px] py-1.5 text-[12px]" style={{ color: 'var(--text-accent)' }}>
          Teach last task
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {routines.map((r) => {
          const bot = bots.find((b) => b.id === r.botId)
          return (
            <div key={r.id} className="rounded-[12px] px-3 py-2" style={{ background: 'var(--bg-card)' }}>
              <div className="flex justify-between text-[12px]">
                <span>
                  {bot?.name ?? r.botId}
                  {r.origin === 'taught' ? ' · taught' : ''}
                </span>
                <span style={{ color: 'var(--text-tertiary)' }}>{r.schedule}</span>
              </div>
              <p className="text-[11px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                {r.prompt}
              </p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={async () => {
                    await api.toggleRoutine(r.id, !r.enabled)
                    onChange(await api.listRoutines())
                  }}
                  className="text-[10px]"
                  style={{ color: 'var(--text-accent)' }}
                >
                  {r.enabled ? 'Disable' : 'Enable'}
                </button>
                <button
                  onClick={async () => {
                    await api.removeRoutine(r.id)
                    onChange(await api.listRoutines())
                  }}
                  className="text-[10px]"
                  style={{ color: 'var(--text-danger)' }}
                >
                  Remove
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

export function ConnectorsPanel({
  connectors,
  onChange,
}: {
  connectors: Connector[]
  onChange: (c: Connector[]) => void
}): React.JSX.Element {
  return (
    <>
      <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--border)' }}>
        <h2 className="text-[13px] font-medium">Connectors</h2>
        <p className="text-[11px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
          Mark tools this machine can use. Sending and spend still go through Auto Review.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {connectors.map((c) => (
          <div key={c.id} className="rounded-[12px] px-3 py-2" style={{ background: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium">{c.name}</span>
              <button
                onClick={async () => {
                  await api.updateConnector({
                    id: c.id,
                    status: c.status === 'connected' ? 'disconnected' : 'connected',
                    note: c.note,
                  })
                  onChange(await api.listConnectors())
                }}
                className="text-[11px]"
                style={{ color: c.status === 'connected' ? 'var(--text-success)' : 'var(--text-accent)' }}
              >
                {c.status === 'connected' ? 'Connected' : 'Connect'}
              </button>
            </div>
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-secondary)' }}>
              {c.description}
            </p>
          </div>
        ))}
      </div>
    </>
  )
}

export function SettingsPanel({
  settings,
  onChange,
}: {
  settings: AppSettings
  onChange: (s: AppSettings) => void
}): React.JSX.Element {
  const setReview = async (autoReview: ReviewMode) => onChange(await api.updateSettings({ autoReview }))
  return (
    <>
      <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--border)' }}>
        <h2 className="text-[13px] font-medium">Settings</h2>
      </div>
      <div className="p-3 space-y-4 text-[12px]">
        <label className="flex items-center justify-between gap-3">
          <span>Privacy mode</span>
          <input
            type="checkbox"
            checked={settings.privacyMode}
            onChange={(e) => void api.updateSettings({ privacyMode: e.target.checked }).then(onChange)}
          />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>Bot-to-bot handoff</span>
          <input
            type="checkbox"
            checked={settings.allowBotHandoff}
            onChange={(e) => void api.updateSettings({ allowBotHandoff: e.target.checked }).then(onChange)}
          />
        </label>
        <div>
          <div className="mb-2" style={{ color: 'var(--text-tertiary)' }}>
            Auto Review
          </div>
          {(['sensitive', 'always', 'off'] as ReviewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => void setReview(mode)}
              className="mr-2 mb-2 rounded-full px-2.5 py-1"
              style={{
                background: settings.autoReview === mode ? 'var(--bg-active)' : 'transparent',
                border: '0.5px solid var(--border)',
              }}
            >
              {mode}
            </button>
          ))}
        </div>
        <p style={{ color: 'var(--text-tertiary)' }}>Max parallel bots: {settings.maxParallelBots}</p>
        <button onClick={() => void api.openLogs()} className="text-[11px]" style={{ color: 'var(--text-accent)' }}>
          Open logs
        </button>
      </div>
    </>
  )
}

export function Toast({ text, onDismiss }: { text: string; onDismiss: () => void }): React.JSX.Element {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 rounded-full px-4 py-2 text-[13px] flex items-center gap-3" style={{ background: 'var(--raised)', border: '0.5px solid var(--border)' }}>
      <span>{text}</span>
      <button onClick={onDismiss} className="text-[11px]" style={{ color: 'var(--text-accent)' }}>
        Dismiss
      </button>
    </div>
  )
}

export function BotRow({
  bot,
  active,
  unread,
  onSelect,
}: {
  bot: Bot
  active: boolean
  unread?: boolean
  onSelect: () => void
}): React.JSX.Element {
  const archived = Boolean(bot.archived)
  return (
    <button
      onClick={onSelect}
      title={archived ? `${bot.name} · archived` : bot.name}
      className="w-full text-left rounded-[10px] px-2 py-2 mb-0.5 flex items-center gap-2 transition-colors hover:bg-[var(--sidebar-hover)]"
      style={{ background: active ? 'var(--sidebar-selected)' : 'transparent', opacity: archived ? 0.55 : 1 }}
    >
      <span className="relative">
        <BlobAvatar hue={bot.hue} size={32} />
        {unread && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full hit-pulse" style={{ background: bot.hue }} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          {bot.pinned && (
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: 'var(--text-accent)' }}
              title="Pinned"
            />
          )}
          <span className="text-[13px] font-medium truncate" style={{ color: 'var(--sidebar-text)' }}>
            {bot.name}
          </span>
          <span className="ml-auto text-[11px] shrink-0" style={{ color: unread ? 'var(--text-accent)' : 'var(--sidebar-faint)' }}>
            {unread ? 'New' : archived ? 'Archived' : timeLabel(bot.updatedAt)}
          </span>
        </span>
        <span className="block text-[12px] truncate mt-0.5" style={{ color: 'var(--sidebar-muted)' }}>
          {bot.status === 'running' ? 'Working…' : bot.status === 'waiting' ? 'Needs you' : bot.preview || bot.job || 'No messages yet'}
        </span>
      </span>
    </button>
  )
}

export function PlusIcon({ size = 16 }: { size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function SearchIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function ComputerIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="3" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6 13h4M8 11v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function MemoryIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 2.5 13.5 5.5v5L8 13.5 2.5 10.5v-5L8 2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}

export function RoutineIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M12.5 8A4.5 4.5 0 1 1 8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M8 3.5h3.2V6.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function PlugIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M6 3v4M10 3v4M5 7h6v2.5A3.5 3.5 0 0 1 7.5 13h-0V15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function GearIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 2.5v1.5M8 12v1.5M2.5 8h1.5M12 8h1.5M4.1 4.1l1.1 1.1M10.8 10.8l1.1 1.1M11.9 4.1l-1.1 1.1M5.2 10.8l-1.1 1.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function SendIcon(): React.JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 12.5V3.5M4.5 7 8 3.5 11.5 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function BellIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 2.5a3.5 3.5 0 0 1 3.5 3.5c0 2.4.7 3.4 1.2 4H3.3c.5-.6 1.2-1.6 1.2-4A3.5 3.5 0 0 1 8 2.5Z" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6.5 13.2a1.6 1.6 0 0 0 3 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function StreakPill({ days }: { days: number }): React.JSX.Element {
  return (
    <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-active)', color: 'var(--text-warning)' }}>
      {days} day streak
    </span>
  )
}
