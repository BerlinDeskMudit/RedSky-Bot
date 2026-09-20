export interface ModelRef {
  providerID: string
  modelID: string
}

export function opencodeHeaders(): Record<string, string> {
  const headers: Record<string, string> = { accept: 'application/json', 'content-type': 'application/json' }
  const pass = process.env.OPENCODE_SERVER_PASSWORD
  if (pass) {
    const user = process.env.OPENCODE_SERVER_USERNAME || 'opencode'
    headers.authorization = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`
  }
  return headers
}

/** Thin typed HTTP helper for the OpenCode server API. */
export async function api<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: opencodeHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) {
    let detail = text.slice(0, 400)
    try {
      const j = JSON.parse(text) as { data?: { message?: string }; message?: string; error?: { message?: string } }
      detail = j.data?.message ?? j.error?.message ?? j.message ?? detail
    } catch {
      /* keep raw */
    }
    throw new Error(`${method} ${url} → ${res.status}: ${detail}`)
  }
  if (!text) return undefined as T
  return unwrapJson<T>(JSON.parse(text))
}

export function unwrapJson<T>(value: unknown): T {
  if (value && typeof value === 'object' && 'data' in (value as object)) {
    const data = (value as { data: unknown }).data
    if (data !== undefined && data !== null && typeof data === 'object') {
      const rec = data as Record<string, unknown>
      if ('id' in rec || Array.isArray(data) || 'title' in rec || 'content' in rec) return data as T
    }
  }
  return value as T
}

export async function apiEmpty(method: string, url: string, body?: unknown): Promise<void> {
  const res = await fetch(url, {
    method,
    headers: opencodeHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${method} ${url} → ${res.status}: ${text.slice(0, 400)}`)
  }
}
