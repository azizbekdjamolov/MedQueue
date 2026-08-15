import { API_BASE } from './api'

const CONVERSATION_KEY = 'medqueue.conversationId'
const LEGACY_CONVERSATION_KEY = 'nexora.conversationId'
const CHAT_TIMEOUT_MS = 45000

export class ChatError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

function mapStreamError(code) {
  if (code === 'timeout') return 'timeout'
  if (code === 'vision_unsupported') return 'vision'
  if (code === 'ai_unavailable') return 'ai'
  return 'server'
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const area = document.createElement('textarea')
      area.value = text
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      document.body.removeChild(area)
      return true
    } catch {
      return false
    }
  }
}

/**
 * Load or create the stable conversation id for this browser.
 * The backend keeps context per conversation_id, so follow-up
 * messages remember earlier turns.
 */
export function getConversationId() {
  try {
    const existing = window.localStorage.getItem(CONVERSATION_KEY)
    if (existing) return existing
    const legacy = window.localStorage.getItem(LEGACY_CONVERSATION_KEY)
    if (legacy) {
      window.localStorage.setItem(CONVERSATION_KEY, legacy)
      window.localStorage.removeItem(LEGACY_CONVERSATION_KEY)
      return legacy
    }
    const fresh =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `c-${Date.now()}-${Math.random().toString(36).slice(2)}`
    window.localStorage.setItem(CONVERSATION_KEY, fresh)
    return fresh
  } catch {
    return null
  }
}

/** True when the backend is reachable (used for the chat status dot). */
export async function checkBackendHealth() {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(`${API_BASE}/api/health`, { signal: controller.signal })
    clearTimeout(timer)
    return res.ok
  } catch {
    return false
  }
}

/**
 * Send one message to the shared AI backend. The browser only ever talks
 * to our own backend — no provider keys leave the server.
 *
 * When `onDelta` is provided the request uses SSE streaming and the
 * callback receives each text chunk as it arrives.
 *
 * @param {object} params
 * @param {string} params.message
 * @param {string} [params.conversationId] - Unique id for THIS chat. When
 *   omitted, a single legacy browser-wide id is used instead.
 * @param {string} [params.language] - Selected UI language ('uz'|'ru'|'en').
 * @param {string} [params.image] - Downscaled image as a data URL (optional).
 * @param {(delta: string) => void} [params.onDelta] - Streaming callback.
 * @returns {Promise<{ reply: string, conversationId: string|null, dentist: object|null }>}
 */
export async function sendChatMessage({ message, conversationId, language, image, onDelta }) {
  const resolvedId = conversationId || getConversationId()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS)

  let res
  try {
    res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        conversation_id: resolvedId,
        language,
        image,
        stream: Boolean(onDelta),
      }),
      signal: controller.signal,
      credentials: 'include',
    })
  } catch {
    throw new ChatError('network', 'Cannot reach the server.')
  } finally {
    clearTimeout(timer)
  }

  if (onDelta && res.ok && res.body) {
    return await readStream(res, resolvedId, onDelta)
  }

  if (res.status === 504) throw new ChatError('timeout', 'The AI took too long to respond.')
  if (res.status === 502) throw new ChatError('ai', 'The AI service is temporarily unavailable.')
  if (res.status === 400) {
    const body = await res.json().catch(() => null)
    const code = body?.error
    if (code === 'vision_unsupported') {
      throw new ChatError('vision', 'The AI model does not support image analysis.')
    }
    if (code === 'invalid_image') {
      throw new ChatError('invalidImage', 'The image could not be sent.')
    }
    throw new ChatError('server', 'Something went wrong. Please try again.')
  }

  const data = await res.json().catch(() => null)
  if (!res.ok || !data || typeof data.reply !== 'string') {
    throw new ChatError('server', 'Something went wrong. Please try again.')
  }

  return {
    reply: data.reply,
    conversationId: data.conversation_id ?? resolvedId,
    dentist: data.dentist ?? null,
    sources: Array.isArray(data.sources) ? data.sources : [],
  }
}

/** Consume an SSE stream from /api/chat and forward deltas via `onDelta`. */
async function readStream(res, conversationId, onDelta) {
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let reply = ''
  let dentist = null
  let sources = []

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (!payload) continue
        try {
          const data = JSON.parse(payload)
          if (typeof data.delta === 'string') {
            reply += data.delta
            onDelta(data.delta)
          } else if (data.dentist) {
            dentist = data.dentist
          } else if (Array.isArray(data.sources)) {
            sources = data.sources
          } else if (data.error) {
            throw new ChatError(mapStreamError(data.error), 'Stream failed.')
          }
        } catch (err) {
          if (err instanceof ChatError) throw err
          // Ignore malformed keep-alive frames.
        }
      }
    }
  } catch (err) {
    if (err instanceof ChatError) throw err
    if (err?.name === 'AbortError') throw new ChatError('timeout', 'The stream was interrupted.')
    throw new ChatError('network', 'The connection was lost while streaming.')
  }

  if (!reply.trim()) throw new ChatError('server', 'The AI returned an empty response.')
  return { reply, conversationId, dentist, sources }
}

/**
 * Analyze an uploaded file (PDF / text) through the dedicated backend
 * endpoint. Images go through /api/chat instead.
 *
 * @returns {Promise<{ analysis: string, extracted_text: string|null }>}
 */
export async function analyzeFile({ filename, mime, base64, question, language }) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS)

  let res
  try {
    res = await fetch(`${API_BASE}/api/ai/analyze-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, mime, base64, question, language }),
      signal: controller.signal,
      credentials: 'include',
    })
  } catch {
    throw new ChatError('network', 'Cannot reach the server.')
  } finally {
    clearTimeout(timer)
  }

  if (res.status === 504) throw new ChatError('timeout', 'The AI took too long to respond.')
  if (res.status === 413 || res.status === 415) {
    throw new ChatError('file', 'The file could not be analyzed.')
  }
  if (res.status === 502) throw new ChatError('ai', 'The AI service is temporarily unavailable.')

  const data = await res.json().catch(() => null)
  if (!res.ok || !data || typeof data.analysis !== 'string') {
    throw new ChatError('server', 'Something went wrong. Please try again.')
  }
  return { analysis: data.analysis, extracted_text: data.extracted_text ?? null }
}