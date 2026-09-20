import { api } from './http'

export interface ModelOption {
  id: string
  label: string
  isDefault: boolean
  providerID: string
}

function isOllama(providerID: string, name: string): boolean {
  const hay = `${providerID} ${name}`.toLowerCase()
  return hay.includes('ollama')
}

/** Lists connected OpenCode backends. Ollama is excluded on purpose. */
export async function listModels(baseUrl: string): Promise<ModelOption[]> {
  if (!baseUrl) return []
  const info = await api<{
    all?: Array<Record<string, unknown>>
    default?: Record<string, string>
    connected?: string[]
  }>('GET', `${baseUrl}/provider`).catch(() => ({ all: [], default: {}, connected: [] }))

  const def: Record<string, string> = info.default ?? {}
  const connected = new Set<string>(info.connected ?? [])
  const options: ModelOption[] = []
  const seen = new Set<string>()
  const push = (providerID: string, modelID: string, label: string, isDefault: boolean) => {
    if (!providerID || !modelID) return
    if (isOllama(providerID, label)) return
    const id = `${providerID}\u241f${modelID}`
    if (seen.has(id)) return
    seen.add(id)
    options.push({ id, label, isDefault, providerID })
  }

  const providerFor = (pid: string) => (info.all ?? []).find((p) => String(p.id) === pid)

  for (const pid of connected) {
    const p = providerFor(pid)
    const pname = String(p?.name ?? pid)
    if (isOllama(pid, pname)) continue
    const ms = Array.isArray(p?.models) ? p.models : []
    const dflt = def[pid]
    if (ms.length) {
      for (const m of ms) {
        const rec = typeof m === 'string' ? { id: m, name: m } : (m as Record<string, unknown>)
        const mid = String(rec?.id ?? '')
        if (mid) {
          push(
            pid,
            mid,
            `${pname} · ${String(rec?.name ?? mid)}`,
            mid === dflt || (dflt ?? '').endsWith(mid),
          )
        }
      }
    } else if (dflt) {
      const slash = dflt.indexOf('/')
      if (slash > 0) push(dflt.slice(0, slash), dflt.slice(slash + 1), `${pname} · ${dflt}`, true)
      else push(pid, dflt, `${pname} · ${dflt}`, true)
    }
  }

  if (!options.length) {
    options.push({ id: '', label: 'OpenCode default (configure a provider — not Ollama)', isDefault: true, providerID: '' })
  } else if (!options.some((o) => o.isDefault)) {
    options[0].isDefault = true
  }
  return options
}
