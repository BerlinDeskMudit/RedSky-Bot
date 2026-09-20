import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api'
import { stripThinking } from './format'
import type { AppNotice, Bot, EventEnvelope, FileNode, JobTemplate, MemoryRow, ModelOption, Routine } from './types'
import {
  BellIcon,
  BlobAvatar,
  BotRow,
  ComputerIcon,
  ComputerPanel,
  EmptyState,
  GearIcon,
  IconBtn,
  MemoryIcon,
  MemoryPanel,
  MessageBlock,
  PlusIcon,
  RoutineIcon,
  RoutinePanel,
  RunningDots,
  SearchIcon,
  SendIcon,
  SettingsPanel,
  StreakPill,
  TrafficLights,
} from './ui'
import type { AppSettings } from './types'

type Boot = 'starting' | 'online' | 'offline'
type Panel = 'none' | 'computer' | 'memory' | 'routines' | 'settings'

const STREAK_KEY = 'redsky.streak'
const QUICK = [
  { label: 'Keep going', text: 'Keep going from that result. Make it sharper.' },
  { label: 'Shorter', text: 'Give me a tighter version of that result.' },
  { label: 'Another angle', text: 'Same goal, different angle. Surprise me.' },
]

function loadStreak(): number {
  try {
    const raw = JSON.parse(localStorage.getItem(STREAK_KEY) || 'null') as { day?: string; n?: number } | null
    if (!raw?.day || !raw.n) return 1
    const today = new Date().toDateString()
    const yest = new Date(Date.now() - 86400000).toDateString()
    if (raw.day === today) return raw.n
    if (raw.day === yest) return raw.n
    return 1
  } catch {
    return 1
  }
}

function bumpStreak(): number {
  const today = new Date().toDateString()
  try {
    const raw = JSON.parse(localStorage.getItem(STREAK_KEY) || 'null') as { day?: string; n?: number } | null
    if (raw?.day === today) return raw.n ?? 1
    const yest = new Date(Date.now() - 86400000).toDateString()
    const n = raw?.day === yest ? (raw.n ?? 0) + 1 : 1
    localStorage.setItem(STREAK_KEY, JSON.stringify({ day: today, n }))
    return n
  } catch {
    return 1
  }
}

export default function App(): React.JSX.Element {
  const [boot, setBoot] = useState<Boot>('starting')
  const [detail, setDetail] = useState('')
  const [models, setModels] = useState<ModelOption[]>([])
  const [model, setModel] = useState('')
  const [bots, setBots] = useState<Bot[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [composer, setComposer] = useState('')
  const [sending, setSending] = useState(false)
  const [panel, setPanel] = useState<Panel>('none')
  const [memories, setMemories] = useState<MemoryRow[]>([])
  const [routines, setRoutines] = useState<Routine[]>([])
  const [templates, setTemplates] = useState<JobTemplate[]>([])
  const [files, setFiles] = useState<FileNode[]>([])
  const [fileView, setFileView] = useState<{ path: string; content: string } | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [notices, setNotices] = useState<AppNotice[]>([])
  const [inboxOpen, setInboxOpen] = useState(false)
  const [unread, setUnread] = useState<Record<string, number>>({})
  const [editor, setEditor] = useState<{ name: string; job: string } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [streak, setStreak] = useState(loadStreak)
  const [showJump, setShowJump] = useState(false)
  const threadRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef(true)
  const selectedIdRef = useRef<string | null>(null)

  const upsertBot = useCallback((bot: Bot) => {
    setBots((prev) => {
      const i = prev.findIndex((b) => b.id === bot.id)
      const next = i >= 0 ? prev.map((b) => (b.id === bot.id ? bot : b)) : [bot, ...prev]
      return [...next].sort((a, b) => b.updatedAt - a.updatedAt)
    })
  }, [])

  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  useEffect(() => {
    void api
      .init()
      .then((p) => {
        setBoot(p.status)
        setDetail(p.baseUrl ?? '')
        setModels(p.models)
        setModel(p.models.find((o) => o.isDefault)?.id ?? p.models[0]?.id ?? '')
        setBots(p.bots)
        setMemories(p.memories)
        setRoutines(p.routines)
        setTemplates(p.templates)
        setSettings(p.settings)
        setNotices(p.notices ?? [])
        if (p.bots.length) setSelectedId(p.bots[0].id)
      })
      .catch((err) => {
        setBoot('offline')
        setDetail((err as Error).message)
      })
  }, [])

  useEffect(() => {
    const off = api.onEvent((evt: EventEnvelope) => {
      if (evt.source === 'status') {
        setBoot(evt.state)
        if (evt.detail) setDetail(evt.detail)
        if (evt.state === 'online') void api.models().then(setModels)
        return
      }
      if (evt.source === 'bot') {
        const watching = selectedIdRef.current
        if (watching !== evt.bot.id && (evt.bot.status === 'idle' || evt.bot.status === 'waiting')) {
          setUnread((u) => ({ ...u, [evt.bot.id]: (u[evt.bot.id] ?? 0) + 1 }))
        }
        upsertBot(evt.bot)
      }
      if (evt.source === 'deleted') {
        setBots((prev) => prev.filter((b) => b.id !== evt.botId))
        setSelectedId((id) => (id === evt.botId ? null : id))
        setUnread((u) => {
          const next = { ...u }
          delete next[evt.botId]
          return next
        })
      }
      if (evt.source === 'notice') setNotices((prev) => [evt.notice, ...prev.filter((n) => n.id !== evt.notice.id)].slice(0, 80))
      if (evt.source === 'notices') setNotices(evt.notices)
      if (evt.source === 'settings') setSettings(evt.settings)
    })
    return off
  }, [upsertBot])

  const selected = useMemo(() => bots.find((b) => b.id === selectedId) ?? null, [bots, selectedId])

  const visibleThread = useMemo(() => {
    return (selected?.thread ?? []).filter((m) => {
      if (m.role === 'system') return false
      if (m.role === 'assistant' && !stripThinking(m.text)) return false
      return Boolean(m.text?.trim())
    })
  }, [selected?.thread])

  const unreadCount = useMemo(() => Object.values(unread).reduce((a, b) => a + b, 0), [unread])
  const unreadNotices = notices.filter((n) => !n.read).length
  const nextHit = useMemo(() => bots.find((b) => unread[b.id] && b.id !== selectedId) ?? null, [bots, unread, selectedId])

  useEffect(() => {
    if (!model && models.length) setModel(models.find((m) => m.isDefault)?.id ?? models[0].id)
  }, [models, model])

  useEffect(() => {
    if (panel === 'computer') void api.files('.').then(setFiles).catch(() => setFiles([]))
    if (panel === 'memory') void api.listMemories(selected?.id).then(setMemories)
    if (panel === 'routines') void api.listRoutines().then(setRoutines)
  }, [panel, selected?.id, selected?.computer.length])

  const scrollToEnd = useCallback((smooth = false) => {
    const el = threadRef.current
    if (!el || !stickRef.current) return
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  useEffect(() => {
    scrollToEnd(selected?.status !== 'running')
  }, [selected?.id, visibleThread.length, selected?.status, visibleThread.at(-1)?.text, scrollToEnd])

  const openBot = useCallback((id: string) => {
    setSelectedId(id)
    setInboxOpen(false)
    setUnread((u) => {
      if (!u[id]) return u
      const next = { ...u }
      delete next[id]
      return next
    })
    stickRef.current = true
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest('input, textarea, select')) return
      if (e.key === 'j' || e.key === 'ArrowDown') {
        const hit = bots.find((b) => unread[b.id])
        if (hit) openBot(hit.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [bots, unread, openBot])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return bots
    return bots.filter((b) => `${b.name} ${b.job} ${b.preview}`.toLowerCase().includes(q))
  }, [bots, search])

  const newAgent = useCallback(
    async (tpl?: JobTemplate) => {
      try {
        const bot = await api.createBot(tpl ? { name: tpl.name, job: tpl.job } : undefined)
        upsertBot(bot)
        openBot(bot.id)
        setComposer('')
        setEditor({ name: bot.name, job: bot.job })
        requestAnimationFrame(() => document.getElementById('composer')?.focus())
      } catch (err) {
        alert((err as Error).message)
      }
    },
    [upsertBot, openBot],
  )

  const send = useCallback(
    async (preset?: string) => {
      const text = (preset ?? composer).trim()
      if (!text || sending) return
      setSending(true)
      stickRef.current = true
      try {
        let bot = selected
        if (!bot) {
          bot = await api.createBot()
          upsertBot(bot)
          openBot(bot.id)
        }
        if (bot.status === 'running') return
        const next = await api.send(bot.id, { text, model: model || undefined })
        upsertBot(next)
        if (!preset) setComposer('')
        setStreak(bumpStreak())
        requestAnimationFrame(() => scrollToEnd(true))
      } catch (err) {
        alert((err as Error).message)
      } finally {
        setSending(false)
      }
    },
    [composer, sending, selected, model, upsertBot, openBot, scrollToEnd],
  )

  const saveEditor = useCallback(async () => {
    if (!selected || !editor) return
    const next = await api.renameBot(selected.id, { name: editor.name.trim() || selected.name, job: editor.job })
    upsertBot(next)
    setEditor(null)
  }, [selected, editor, upsertBot])

  const statusLabel = boot === 'online' ? 'Live' : boot === 'starting' ? 'Starting…' : 'Offline'
  const lastWasResult = selected?.status === 'idle' && visibleThread.at(-1)?.role === 'assistant'

  return (
    <div className="flex h-full text-[var(--text-primary)]" style={{ background: 'var(--substrate)' }}>
      <aside className="w-[280px] shrink-0 flex flex-col relative" style={{ background: 'var(--sidebar-tint)' }}>
        <div className="absolute top-0 right-0 bottom-0 w-px" style={{ background: 'var(--border)' }} />
        <div className="window-drag h-11 px-4 flex items-center shrink-0">
          <TrafficLights />
          <button
            onClick={() => void newAgent()}
            disabled={boot !== 'online'}
            className="window-no-drag ml-auto w-6 h-6 rounded-[6px] flex items-center justify-center text-[var(--sidebar-muted)] hover:bg-[var(--sidebar-hover)] disabled:opacity-30"
            title="New agent"
          >
            <PlusIcon />
          </button>
        </div>
        <div className="window-no-drag px-4 mb-2 flex items-center gap-2">
          <StreakPill days={streak} />
          {unreadCount > 0 && (
            <span className="text-[11px]" style={{ color: 'var(--text-accent)' }}>
              {unreadCount} waiting
            </span>
          )}
        </div>
        {bots.length > 0 && (
          <div className="window-no-drag flex gap-2 overflow-x-auto px-3 pb-2">
            {bots.slice(0, 12).map((b) => (
              <button key={b.id} onClick={() => openBot(b.id)} className={unread[b.id] || b.status === 'waiting' ? 'story-ring shrink-0' : 'shrink-0'} title={b.name}>
                <BlobAvatar hue={b.hue} size={36} />
              </button>
            ))}
          </div>
        )}
        <label
          className="window-no-drag mx-4 mb-2 h-8 rounded-[10px] flex items-center gap-2 px-2.5"
          style={{ background: 'var(--bg-tertiary)', border: '0.5px solid var(--border)', color: 'var(--sidebar-faint)' }}
        >
          <SearchIcon />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents"
            className="min-w-0 flex-1 bg-transparent text-[13px] leading-[18px] text-[var(--sidebar-text)] placeholder:text-[var(--sidebar-faint)] outline-none"
          />
        </label>
        <nav className="flex-1 overflow-y-auto px-2.5 pb-2">
          {visible.map((b) => (
            <BotRow key={b.id} bot={b} active={b.id === selected?.id} unread={Boolean(unread[b.id])} onSelect={() => openBot(b.id)} />
          ))}
          {!bots.length && (
            <p className="px-3 py-6 text-[12px] leading-relaxed" style={{ color: 'var(--sidebar-faint)' }}>
              Create an agent, give it a job, get a hit of finished work.
            </p>
          )}
        </nav>
        <div className="px-3.5 pb-3.5 pt-2 flex items-center gap-2 shrink-0">
          <span
            className="w-[7px] h-[7px] rounded-full"
            style={{ background: boot === 'online' ? 'var(--text-success)' : boot === 'starting' ? 'var(--text-warning)' : 'var(--text-danger)' }}
          />
          <span className="text-[12px] truncate" style={{ color: 'var(--sidebar-muted)' }}>
            {statusLabel}
          </span>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0" style={{ background: 'var(--chat-fill)' }}>
        <header className="window-drag h-11 flex items-center gap-2 px-3 shrink-0" style={{ borderBottom: '0.5px solid var(--border)' }}>
          {selected ? (
            <button className="window-no-drag flex items-center gap-2 min-w-0" onClick={() => setEditor({ name: selected.name, job: selected.job })}>
              <BlobAvatar hue={selected.hue} size={22} />
              <span className="text-[13px] font-medium truncate">{selected.name}</span>
              {selected.status === 'running' && (
                <span className="text-[11px]" style={{ color: 'var(--text-warning)' }}>
                  Working
                </span>
              )}
              {selected.status === 'waiting' && (
                <span className="text-[11px]" style={{ color: 'var(--text-accent)' }}>
                  Needs you
                </span>
              )}
            </button>
          ) : (
            <span className="text-[13px]" style={{ color: 'var(--text-tertiary)' }}>
              Meet your first Bot
            </span>
          )}
          <div className="window-no-drag ml-auto flex items-center gap-1">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="bg-transparent text-[11px] px-2 py-1 max-w-48 rounded-[6px] outline-none"
              style={{ color: 'var(--text-secondary)' }}
            >
              {models.map((m) => (
                <option key={m.id || m.label} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <IconBtn
              active={inboxOpen}
              onClick={() => setInboxOpen((v) => !v)}
              title="Notifications"
            >
              <span className="relative">
                <BellIcon />
                {unreadNotices > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 rounded-full text-[9px] flex items-center justify-center" style={{ background: '#ff5f57', color: '#fff' }}>
                    {unreadNotices > 9 ? '9+' : unreadNotices}
                  </span>
                )}
              </span>
            </IconBtn>
            <IconBtn active={panel === 'computer'} onClick={() => setPanel((p) => (p === 'computer' ? 'none' : 'computer'))} title="Open computer">
              <ComputerIcon />
            </IconBtn>
            <IconBtn active={panel === 'memory'} onClick={() => setPanel((p) => (p === 'memory' ? 'none' : 'memory'))} title="Memory">
              <MemoryIcon />
            </IconBtn>
            <IconBtn active={panel === 'routines'} onClick={() => setPanel((p) => (p === 'routines' ? 'none' : 'routines'))} title="Routines">
              <RoutineIcon />
            </IconBtn>
            <IconBtn active={panel === 'settings'} onClick={() => setPanel((p) => (p === 'settings' ? 'none' : 'settings'))} title="Settings">
              <GearIcon />
            </IconBtn>
          </div>
        </header>

        <div className="flex-1 flex min-h-0">
          <div className="flex-1 flex flex-col min-w-0 relative">
            <div
              ref={threadRef}
              className="flex-1 overflow-y-auto px-8 py-5 space-y-4"
              onScroll={(e) => {
                const el = e.currentTarget
                stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96
                setShowJump(!stickRef.current)
              }}
            >
              {selected ? (
                <>
                  {selected.job && !visibleThread.length && (
                    <p className="text-[13px] max-w-lg" style={{ color: 'var(--text-tertiary)' }}>
                      {selected.job}
                    </p>
                  )}
                  {visibleThread.map((m, i) => (
                    <MessageBlock
                      key={m.id ?? `${selected.id}-${i}`}
                      role={m.role}
                      text={m.role === 'assistant' ? stripThinking(m.text) : m.text}
                      kind={m.kind}
                      hue={selected.hue}
                      name={selected.name}
                      editing={editingId === m.id}
                      draft={editingId === m.id ? draft : undefined}
                      onDraft={setDraft}
                      onSave={() => {
                        if (!m.id) return
                        void api.patchMessage(selected.id, m.id, draft).then(upsertBot)
                        setEditingId(null)
                      }}
                      onCancel={() => setEditingId(null)}
                      onCopy={() => void navigator.clipboard.writeText(m.text)}
                      onEdit={() => {
                        if (!m.id) return
                        setEditingId(m.id)
                        setDraft(m.text)
                      }}
                      onDelete={() => {
                        if (!m.id) return
                        void api.deleteMessage(selected.id, m.id).then(upsertBot)
                      }}
                      onResend={
                        m.role === 'user' && m.id
                          ? () => {
                              stickRef.current = true
                              void api.resendFrom(selected.id, m.id!, model || undefined).then(upsertBot)
                            }
                          : undefined
                      }
                    />
                  ))}
                  {selected.status === 'running' && <RunningDots hue={selected.hue} />}
                  {lastWasResult && (
                    <div className="flex flex-wrap gap-1.5 pl-10">
                      {QUICK.map((q) => (
                        <button
                          key={q.label}
                          onClick={() => void send(q.text)}
                          className="rounded-full px-3 py-1 text-[12px] hover:bg-[var(--bg-hover)]"
                          style={{ border: '0.5px solid var(--border)', color: 'var(--text-secondary)' }}
                        >
                          {q.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {selected.pendingPermission && (
                    <div className="rounded-2xl p-3 max-w-lg" style={{ background: 'var(--bubble-agent)' }}>
                      <p className="text-[14px] font-semibold">{selected.pendingPermission.title}</p>
                      <p className="text-[13px] mt-1 whitespace-pre-wrap" style={{ color: 'var(--text-tertiary)' }}>
                        {selected.pendingPermission.detail}
                      </p>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => void api.permission({ botId: selected.id, permissionId: selected.pendingPermission!.id, response: 'once' })}
                          className="text-[13px] font-medium rounded-full px-3 py-1.5"
                          style={{ background: 'var(--fill-emphasis)', color: 'var(--bubble-user-ink)' }}
                        >
                          Allow once
                        </button>
                        <button
                          onClick={() => void api.permission({ botId: selected.id, permissionId: selected.pendingPermission!.id, response: 'always' })}
                          className="text-[13px] rounded-full px-3 py-1.5"
                          style={{ background: 'var(--fill-secondary)' }}
                        >
                          Always
                        </button>
                        <button
                          onClick={() => void api.permission({ botId: selected.id, permissionId: selected.pendingPermission!.id, response: 'reject' })}
                          className="text-[13px] px-3 py-1.5"
                          style={{ color: 'var(--text-danger)' }}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                  {selected.error && (
                    <div className="rounded-xl px-3 py-2 text-[13px]" style={{ background: '#2a1416', color: 'var(--text-danger)' }}>
                      {selected.error}
                    </div>
                  )}
                  <div className="h-2" />
                </>
              ) : (
                <EmptyState templates={templates} onPick={(t) => void newAgent(t)} onNew={() => void newAgent()} />
              )}
            </div>

            {showJump && (
              <button
                onClick={() => {
                  stickRef.current = true
                  scrollToEnd(true)
                  setShowJump(false)
                }}
                className="absolute bottom-24 right-8 rounded-full px-3 py-1.5 text-[12px]"
                style={{ background: 'var(--raised)', border: '0.5px solid var(--border)' }}
              >
                Jump to latest
              </button>
            )}

            {nextHit && (
              <button
                onClick={() => openBot(nextHit.id)}
                className="absolute bottom-24 left-8 rounded-full px-3 py-1.5 text-[12px] flex items-center gap-2"
                style={{ background: 'var(--fill-emphasis)', color: 'var(--bubble-user-ink)' }}
              >
                Next hit · {nextHit.name}
              </button>
            )}

            {selected?.status === 'running' && (
              <div className="px-8 pb-1 flex justify-end">
                <button
                  onClick={() => void api.abortBot(selected.id)}
                  className="text-[12px] rounded-full px-3 py-1"
                  style={{ color: 'var(--text-warning)', border: '0.5px solid color-mix(in srgb, var(--text-warning) 28%, transparent)' }}
                >
                  Stop
                </button>
              </div>
            )}

            <footer className="px-5 pb-4 pt-2">
              <div className="flex items-center gap-2 rounded-full px-2 py-2" style={{ background: 'var(--raised)', border: '0.5px solid var(--border)' }}>
                <button
                  className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--fill-secondary)', color: 'var(--text-secondary)' }}
                  title="New agent"
                  onClick={() => void newAgent()}
                >
                  <PlusIcon size={14} />
                </button>
                <textarea
                  id="composer"
                  rows={1}
                  value={composer}
                  onChange={(e) => {
                    setComposer(e.target.value)
                    e.currentTarget.style.height = 'auto'
                    e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 120)}px`
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void send()
                    }
                  }}
                  placeholder={selected?.status === 'running' ? 'Working on it…' : selected ? `Message ${selected.name} — try “remind me to drink water each min”` : 'Drop a task. Get a hit.'}
                  disabled={selected?.status === 'running'}
                  className="flex-1 resize-none bg-transparent px-1 py-1 text-[14px] leading-5 outline-none max-h-[120px]"
                  style={{ color: 'var(--text-primary)' }}
                />
                <button
                  onClick={() => void send()}
                  disabled={sending || !composer.trim() || selected?.status === 'running' || boot !== 'online'}
                  className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center disabled:opacity-30"
                  style={{ background: 'var(--fill-emphasis)', color: 'var(--bubble-user-ink)' }}
                  title="Send"
                >
                  <SendIcon />
                </button>
              </div>
              {detail ? (
                <p className="mt-2 text-[10px] text-center" style={{ color: 'var(--text-tertiary)' }}>
                  {detail}
                </p>
              ) : null}
            </footer>
          </div>

          {inboxOpen && (
            <aside className="w-[320px] shrink-0 flex flex-col" style={{ borderLeft: '0.5px solid var(--border)', background: 'color-mix(in srgb, var(--bg-elevated) 88%, transparent)' }}>
              <div className="h-11 px-4 flex items-center justify-between" style={{ borderBottom: '0.5px solid var(--border)' }}>
                <h2 className="text-[13px] font-medium">Hits</h2>
                <div className="flex gap-2">
                  <button onClick={() => void api.markAllNoticesRead().then(setNotices)} className="text-[11px]" style={{ color: 'var(--text-accent)' }}>
                    Read all
                  </button>
                  <button onClick={() => void api.clearNotices().then(() => setNotices([]))} className="text-[11px]" style={{ color: 'var(--text-danger)' }}>
                    Clear
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {notices.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      openBot(n.botId)
                      void api.markNoticeRead(n.id).then(setNotices)
                    }}
                    className="w-full text-left rounded-[12px] px-3 py-2 mb-1"
                    style={{ background: n.read ? 'transparent' : 'var(--bg-card)' }}
                  >
                    <div className="flex justify-between gap-2">
                      <span className="text-[12px] font-medium">{n.title}</span>
                      <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                        {new Date(n.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[12px] truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {n.body}
                    </p>
                  </button>
                ))}
                {!notices.length && (
                  <p className="px-3 py-8 text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
                    When an agent finishes, it lands here. Check back for the next hit.
                  </p>
                )}
              </div>
            </aside>
          )}

          {panel !== 'none' && !inboxOpen && (
            <aside className="w-[360px] shrink-0 flex flex-col" style={{ borderLeft: '0.5px solid var(--border)', background: 'color-mix(in srgb, var(--bg-elevated) 88%, transparent)' }}>
              {panel === 'computer' && (
                <ComputerPanel
                  bot={selected}
                  files={files}
                  fileView={fileView}
                  onOpenWorkspace={() => void api.openWorkspace()}
                  onOpenFile={async (p) => {
                    const content = await api.fileContent(p)
                    setFileView({ path: p, content })
                  }}
                />
              )}
              {panel === 'memory' && <MemoryPanel memories={memories} botId={selected?.id} onChange={setMemories} />}
              {panel === 'routines' && <RoutinePanel routines={routines} bots={bots} selectedId={selected?.id} onChange={setRoutines} />}
              {panel === 'settings' && settings && <SettingsPanel settings={settings} onChange={setSettings} />}
            </aside>
          )}
        </div>
      </main>

      {editor && selected && (
        <div className="fixed inset-0 z-30 flex items-center justify-center" style={{ background: '#00000066' }} onClick={() => setEditor(null)}>
          <div className="w-[420px] rounded-2xl p-4" style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[15px] font-medium mb-3">Edit agent</h2>
            <input
              value={editor.name}
              onChange={(e) => setEditor({ ...editor, name: e.target.value })}
              className="w-full rounded-[10px] px-3 py-2 text-[13px] outline-none mb-2"
              style={{ background: 'var(--bg-tertiary)', border: '0.5px solid var(--border)' }}
              placeholder="Name"
            />
            <textarea
              value={editor.job}
              onChange={(e) => setEditor({ ...editor, job: e.target.value })}
              className="w-full rounded-[10px] px-3 py-2 text-[13px] outline-none min-h-[88px]"
              style={{ background: 'var(--bg-tertiary)', border: '0.5px solid var(--border)' }}
              placeholder="Job"
            />
            <div className="flex flex-wrap gap-2 mt-3">
              <button onClick={() => void saveEditor()} className="rounded-full px-3 py-1.5 text-[13px]" style={{ background: 'var(--fill-emphasis)', color: 'var(--bubble-user-ink)' }}>
                Save
              </button>
              <button
                onClick={() => {
                  void api.duplicateBot(selected.id).then((b) => {
                    upsertBot(b)
                    openBot(b.id)
                    setEditor(null)
                  })
                }}
                className="rounded-full px-3 py-1.5 text-[13px]"
                style={{ background: 'var(--fill-secondary)' }}
              >
                Duplicate
              </button>
              <button
                onClick={() => {
                  if (confirm(`Clear chat with ${selected.name}?`)) void api.clearThread(selected.id).then(upsertBot)
                }}
                className="rounded-full px-3 py-1.5 text-[13px]"
                style={{ color: 'var(--text-secondary)' }}
              >
                Clear chat
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete ${selected.name}?`)) {
                    void api.deleteBot(selected.id)
                    setEditor(null)
                  }
                }}
                className="ml-auto rounded-full px-3 py-1.5 text-[13px]"
                style={{ color: 'var(--text-danger)' }}
              >
                Delete agent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
