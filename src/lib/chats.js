const CHATS_KEY = 'medqueue_chats'
const LEGACY_KEY = 'nexora.messages'
const OLD_CHATS_KEY = 'nexora_chats'
const MAX_CHATS = 20
const MAX_MESSAGES_PER_CHAT = 100

export function createChatId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  } catch {
    // Fall back to a time-based id below.
  }
  return `c-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * Build a chat title from the first user message. The AI backend never
 * names chats — the title is a pure frontend heuristic.
 *
 * @param {string} text - The message text (may be empty for image-only sends).
 * @param {string} imageFallback - Localized label used when there is no text.
 */
export function makeTitle(text, imageFallback) {
  const clean = (text || '').replace(/\s+/g, ' ').trim()
  if (!clean) return imageFallback
  const words = clean.split(' ').slice(0, 5).join(' ')
  return words.length > 36 ? `${words.slice(0, 36).trimEnd()}…` : words
}

function sanitizeChat(raw, imageFallback) {
  if (!raw || typeof raw !== 'object') return null
  const id = typeof raw.id === 'string' && raw.id ? raw.id : createChatId()
  const createdAt = typeof raw.created_at === 'number' ? raw.created_at : Date.now()
  const updatedAt = typeof raw.updated_at === 'number' ? raw.updated_at : createdAt
  const messages = Array.isArray(raw.messages)
    ? raw.messages
        .filter(
          (m) =>
            m &&
            typeof m === 'object' &&
            typeof m.id === 'string' &&
            (m.from === 'user' || m.from === 'ai') &&
            typeof m.text === 'string'
        )
        .slice(-MAX_MESSAGES_PER_CHAT)
    : []
  const title =
    typeof raw.title === 'string' && raw.title.trim()
      ? raw.title.trim().slice(0, 60)
      : makeTitle(
          messages.find((m) => m.from === 'user')?.text ?? '',
          imageFallback
        )
  return { id, title, created_at: createdAt, updated_at: updatedAt, messages }
}

/**
 * Migrate the legacy single-conversation store (nexora.messages) into the
 * new per-chat structure. Returns the migrated chat, or null.
 */
function migrateLegacy(imageFallback) {
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    const messages = parsed
      .filter(
        (m) =>
          m &&
          typeof m === 'object' &&
          typeof m.id === 'string' &&
          (m.from === 'user' || m.from === 'ai') &&
          typeof m.text === 'string'
      )
      .map((m) => ({ id: m.id, from: m.from, text: m.text, created_at: m.created_at }))
    if (messages.length === 0) return null
    return {
      id: createChatId(),
      title: makeTitle(messages.find((m) => m.from === 'user')?.text ?? '', imageFallback),
      created_at: Date.now(),
      updated_at: Date.now(),
      messages,
    }
  } catch {
    return null
  }
}

/**
 * Load persisted chats. Corrupt data is discarded, legacy data (nexora keys)
 * is migrated exactly once (then the legacy keys are removed).
 *
 * @param {string} imageFallback - Localized label for image-only chats.
 */
export function loadChats(imageFallback) {
  let chats = []
  try {
    const raw = window.localStorage.getItem(CHATS_KEY) || window.localStorage.getItem(OLD_CHATS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        chats = parsed
          .map((chat) => sanitizeChat(chat, imageFallback))
          .filter(Boolean)
          .slice(-MAX_CHATS)
      }
    }
  } catch {
    chats = []
  }

  if (chats.length === 0) {
    const legacy = migrateLegacy(imageFallback)
    if (legacy) {
      chats = [legacy]
      try {
        window.localStorage.removeItem(LEGACY_KEY)
        window.localStorage.removeItem(OLD_CHATS_KEY)
      } catch {
        // Ignore — the legacy keys just stay until the next visit.
      }
      saveChats(chats, imageFallback)
    }
  } else {
    try {
      window.localStorage.removeItem(OLD_CHATS_KEY)
    } catch {
      // Ignore — legacy key cleanup is best-effort.
    }
  }

  return chats
}

/**
 * Persist chats. If storage rejects the payload (quota), images are dropped
 * and the chat is saved again with `imageLost` flags so the UI can degrade
 * gracefully instead of losing entire conversations.
 */
export function saveChats(chats, imageFallback) {
  const bounded = chats.slice(-MAX_CHATS).map((chat) => ({
    ...chat,
    title:
      typeof chat.title === 'string' && chat.title.trim()
        ? chat.title.trim().slice(0, 60)
        : makeTitle(
            chat.messages.find((m) => m.from === 'user')?.text ?? '',
            imageFallback
          ),
  }))

  const trySave = (list) => {
    window.localStorage.setItem(CHATS_KEY, JSON.stringify(list))
  }

  try {
    trySave(bounded)
  } catch {
    const stripped = bounded.map((chat) => ({
      ...chat,
      image_lost: true,
      messages: chat.messages.map((m) => ({
        id: m.id,
        from: m.from,
        text: m.text,
        created_at: m.created_at,
      })),
    }))
    try {
      trySave(stripped)
    } catch {
      // Storage fully unavailable — the workspace keeps working in-memory.
    }
  }
}