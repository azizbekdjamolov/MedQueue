import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { analyzeFile, checkBackendHealth, ChatError, copyText, sendChatMessage } from '../lib/chat'
import { renderMarkdown } from '../lib/markdown.jsx'
import { useLang, useT } from '../i18n'
import { createChatId, loadChats, makeTitle, saveChats } from '../lib/chats'
import { processImage, validateImage } from '../lib/image'
import { requireLogin } from '../lib/auth'
import { takeQueue } from '../lib/api'

const WELCOME_MESSAGE = {
  id: 'welcome',
  from: 'ai',
  key: 'ai.welcome',
}

const ERROR_KEYS = {
  network: 'ai.errors.network',
  timeout: 'ai.errors.timeout',
  ai: 'ai.errors.ai',
  server: 'ai.errors.server',
  vision: 'ai.errors.vision',
  invalidImage: 'ai.errors.invalidImage',
  file: 'ai.errors.file',
}

const FILE_TYPES = ['application/pdf', 'text/plain', 'text/csv', 'text/markdown', 'application/json', 'application/xml']
const FILE_MAX_BYTES = 8 * 1024 * 1024

const STATUS_DOT = {
  checking: 'bg-amber-400',
  online: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]',
  offline: 'bg-rose-500',
}

const STATUS_KEY = { checking: 'ai.connecting', online: 'ai.online', offline: 'ai.offline' }

const LOCALES = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-US' }

function updateChat(list, chatId, fn) {
  const idx = list.findIndex((c) => c.id === chatId)
  if (idx === -1) return list
  const next = [...list]
  next[idx] = fn(next[idx])
  const updated = next.splice(idx, 1)[0]
  next.unshift(updated)
  return next
}

function dayKey(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function TimeLabel({ ts, className = '' }) {
  const t = useT()
  const lang = useLang()
  const label = useMemo(() => {
    const now = new Date()
    const date = new Date(ts)
    const sameDay = (a, b) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    if (sameDay(now, date)) return t('ai.time.today')
    if (sameDay(new Date(now.getTime() - 86400000), date)) return t('ai.time.yesterday')
    return date.toLocaleDateString(LOCALES[lang] ?? 'en-US', {
      day: 'numeric',
      month: 'short',
    })
  }, [ts, t, lang])
  return <p className={className}>{label}</p>
}

/** Copy-to-clipboard button used on AI messages and code blocks. */
function CopyButton({ text, label, className = '' }) {
  const t = useT()
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const ok = await copyText(text)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label ?? t('ai.copy')}
      title={label ?? t('ai.copy')}
      className={
        'flex h-6 w-6 items-center justify-center rounded-md text-faint transition-colors hover:bg-card-hover hover:text-fg ' +
        (copied ? 'text-emerald-400 hover:text-emerald-300' : '') +
        ' ' +
        className
      }
    >
      {copied ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      )}
    </button>
  )
}

/** Source links returned by the shared AI web-search service. */
function SourceChips({ sources }) {
  const t = useT()
  if (!Array.isArray(sources) || sources.length === 0) return null
  return (
    <div className="mt-1.5 flex max-w-[85%] flex-wrap items-center gap-1.5 self-start">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-faint">
        {t('ai.sources')}:
      </span>
      {sources.slice(0, 5).map((source) => {
        let host = ''
        try {
          host = new URL(source.url).hostname.replace(/^www\./, '')
        } catch {
          host = source.url
        }
        return (
          <a
            key={source.url}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            title={source.title}
            className="max-w-[180px] truncate rounded-full border border-electric-500/30 bg-electric-500/10 px-2.5 py-0.5 text-[10px] font-medium text-electric-300 transition-colors hover:border-electric-500/60 hover:bg-electric-500/20"
          >
            {host}
          </a>
        )
      })}
    </div>
  )
}

/** Copy + regenerate actions under the last AI message. */
function MessageActions({ text, canRegenerate, onRegenerate, className = '' }) {
  const t = useT()
  if (!text && !canRegenerate) return null
  return (
    <div className={'flex items-center gap-1 ' + className}>
      <CopyButton text={text} />
      {canRegenerate && (
        <button
          type="button"
          onClick={onRegenerate}
          aria-label={t('ai.regenerate')}
          title={t('ai.regenerate')}
          className="flex h-6 w-6 items-center justify-center rounded-md text-faint transition-colors hover:bg-card-hover hover:text-fg"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </div>
  )
}

function SidebarContent({
  chats,
  activeId,
  confirmId,
  renamingId,
  renameText,
  t,
  onSelect,
  onNew,
  onDelete,
  onStartRename,
  onRenameChange,
  onCommitRename,
}) {
  const groups = useMemo(() => {
    const today = []
    const yesterday = []
    const olderMap = new Map()
    const now = Date.now()
    for (const chat of chats) {
      const key = dayKey(chat.updated_at)
      if (key === dayKey(now)) today.push(chat)
      else if (key === dayKey(now - 86400000)) yesterday.push(chat)
      else {
        if (!olderMap.has(key)) olderMap.set(key, [])
        olderMap.get(key).push(chat)
      }
    }
    const older = Array.from(olderMap.entries()).map(([key, items]) => ({ key, items }))
    return { today, yesterday, older }
  }, [chats])

  function renderItem(chat) {
    const isActive = chat.id === activeId
    const isConfirming = confirmId === chat.id
    const isRenaming = renamingId === chat.id
    return (
      <li key={chat.id} className="group relative">
        {isActive && (
          <span
            aria-hidden="true"
            className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-gradient-to-b from-neon-400 to-electric-400"
          />
        )}
        <button
          type="button"
          onClick={() => onSelect(chat.id)}
          className={
            'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors ' +
            (isActive
              ? 'bg-gradient-to-r from-neon-500/15 to-electric-500/10'
              : 'hover:bg-card-hover')
          }
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-neon-500/20 to-electric-500/20 text-accent">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z"
                fill="currentColor"
              />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span
              className={
                'block truncate text-[13px] font-medium ' +
                (isActive ? 'text-fg' : 'text-muted')
              }
            >
              {chat.title}
            </span>
            <TimeLabel ts={chat.updated_at} className="text-[10px] text-faint" />
          </span>
        </button>

        <div className="absolute right-1.5 top-1/2 hidden -translate-y-1/2 items-center gap-1 group-hover:flex group-focus-within:flex">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onDelete(chat.id)
            }}
            aria-label={t('ai.deleteChat')}
            className={
              'flex h-6 items-center gap-1 rounded-md px-1.5 text-[10px] font-medium transition-colors ' +
              (isConfirming
                ? 'bg-rose-500/20 text-rose-300'
                : 'text-faint hover:bg-card-hover hover:text-rose-300')
            }
          >
            {isConfirming ? t('ai.confirmDelete') : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M4 7h16M9 7V5h6v2m-9 0 1 13h10l1-13M10 11v5m4-5v5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onStartRename(chat.id, chat.title)
            }}
            aria-label={t('ai.renameChat')}
            className="flex h-6 w-6 items-center justify-center rounded-md text-faint transition-colors hover:bg-card-hover hover:text-fg"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 20h4L20 8l-4-4L4 16v4ZM14 6l4 4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <AnimatePresence>
          {isRenaming && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <input
                autoFocus
                value={renameText}
                onChange={(event) => onRenameChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onCommitRename(chat.id)
                  if (event.key === 'Escape') onCommitRename(chat.id, true)
                }}
                onBlur={() => onCommitRename(chat.id)}
                aria-label={t('ai.renameChat')}
                className="mt-1 w-full rounded-lg border border-neon-500/40 bg-input px-2.5 py-1.5 text-[12px] text-fg outline-none"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </li>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-3">
        <button
          type="button"
          onClick={onNew}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-neon-600 to-electric-600 px-3 py-2.5 text-sm font-semibold text-white shadow-[0_2px_14px_rgba(139,92,246,0.35)] transition-all hover:shadow-[0_2px_20px_rgba(139,92,246,0.5)]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 5v14M5 12h14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          {t('ai.newChat')}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
        <ul className="flex flex-col gap-1">
          {groups.today.length > 0 && (
            <>
              <li className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-faint">
                {t('ai.time.today')}
              </li>
              {groups.today.map(renderItem)}
            </>
          )}
          {groups.yesterday.length > 0 && (
            <>
              <li className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-faint">
                {t('ai.time.yesterday')}
              </li>
              {groups.yesterday.map(renderItem)}
            </>
          )}
          {groups.older.map((group) => (
            <li key={group.key}>
              <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-faint">
                <TimeLabel ts={group.items[0].updated_at} />
              </p>
              <ul className="flex flex-col gap-1">
                {group.items.map(renderItem)}
              </ul>
            </li>
          ))}
          {chats.length === 0 && (
            <li className="px-3 py-8 text-center text-[12px] text-faint">
              {t('ai.noChats')}
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}

function fmt(t, key, vars) {
  return t(key).replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? '')
}

/**
 * Dentist recommendation cards rendered directly inside the chat when the
 * shared AI service returns structured dentist data. The "Qabulga yozilish"
 * button uses the same queue flow as the rest of the platform.
 */
function DentistCards({ dentist, lang, navigate, onQueued }) {
  const t = useT()
  const [busyId, setBusyId] = useState(null)
  const [queued, setQueued] = useState(null)

  async function handleJoin(doctor) {
    if (busyId) return
    if (!requireLogin(navigate)) return
    setBusyId(doctor.id)
    try {
      const queue = await takeQueue(doctor.id, lang)
      setQueued({ doctor, queue })
      if (onQueued) onQueued()
    } catch {
      setBusyId(null)
    }
  }

  return (
    <div className="w-full max-w-[85%] self-start">
      {dentist.note && (
        <p className="mb-2 text-[11px] leading-relaxed text-faint">{dentist.note}</p>
      )}
      <ul className="flex flex-col gap-2">
        {dentist.dentists.map((doctor, index) => (
          <li key={doctor.id}>
            <div className="rounded-2xl rounded-bl-md border border-border bg-ai-bot p-3.5 transition-colors hover:border-neon-500/30">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold text-fg">
                    <span className="text-sm">{index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🦷'}</span>
                    {doctor.name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {doctor.specialty} · {doctor.clinic} · {doctor.district}
                  </p>
                  <p className="text-[10px] text-faint">{doctor.address}</p>
                </div>
                <span className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-300">
                  ⭐ {doctor.rating.toFixed(1)}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-faint">
                <span>{fmt(t, 'ai.dentists.years', { n: doctor.experience })}</span>
                <span>{fmt(t, 'ai.dentists.reviews', { n: doctor.reviews })}</span>
                <span>
                  {doctor.availableToday
                    ? `${t('ai.dentists.available')} ${t('search.today')}`
                    : `${t('search.unavailable')} ${t('search.today')}`}
                </span>
                <span>
                  {doctor.availableTomorrow
                    ? `${t('ai.dentists.available')} ${t('search.tomorrow')}`
                    : `${t('search.unavailable')} ${t('search.tomorrow')}`}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
                <span className="text-[10px] text-faint">
                  {fmt(t, 'ai.dentists.queue', { n: doctor.queueAhead })} ·{' '}
                  {fmt(t, 'ai.dentists.wait', { n: doctor.avgWaitMin })}
                </span>
                <button
                  type="button"
                  onClick={() => handleJoin(doctor)}
                  disabled={Boolean(busyId)}
                  className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-neon-600 to-electric-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-[0_2px_10px_rgba(139,92,246,0.35)] transition-all hover:shadow-[0_2px_16px_rgba(139,92,246,0.55)] disabled:opacity-50"
                >
                  {busyId === doctor.id ? (
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M8 2.5v11M2.5 8h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  )}
                  {busyId === doctor.id ? t('ai.dentists.joining') : t('ai.dentists.join')}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <AnimatePresence>
        {queued && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setQueued(null)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,380px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-neon-500/30 bg-bg-soft p-6 text-center shadow-[0_20px_80px_rgba(139,92,246,0.35)]"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-neon-500 to-electric-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.5)]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="mt-4 font-display text-xl font-semibold text-fg">{t('search.taken')}</h3>
              <p className="mt-1 text-[12px] text-muted">
                {queued.doctor.name} — {queued.doctor.specialty}
              </p>
              <p className="mt-4 rounded-2xl border border-border bg-input px-4 py-3 font-display text-3xl font-semibold tracking-wide text-accent">
                {queued.queue.yourNumber}
              </p>
              <p className="mt-2 text-[12px] text-faint">
                {fmt(t, 'search.queueNow', { n: queued.queue.peopleAhead })} ·{' '}
                {fmt(t, 'search.avgWait', { n: queued.queue.waitMin })}
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setQueued(null)}
                  className="flex-1 rounded-full border border-border bg-card py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-card-hover hover:text-fg"
                >
                  {t('ai.dentists.close')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const modal = queued
                    setQueued(null)
                    if (onQueued) onQueued(modal)
                  }}
                  className="flex-1 rounded-full bg-gradient-to-r from-neon-600 to-electric-600 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-[0_2px_16px_rgba(139,92,246,0.5)]"
                >
                  {t('search.goDashboard')}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * District quick-pick chips shown when the shared AI service asks which
 * district the user needs a dentist from. Tapping a chip sends the message
 * right away — no need to type anything.
 */
const DENTIST_LOCATIONS = [
  { emoji: '📍', label: 'Yunusobod', text: 'Yunusoboddan stomatolog top' },
  { emoji: '📍', label: 'Chilonzor', text: 'Chilonzordan stomatolog top' },
  { emoji: '📍', label: "Mirzo Ulug'bek", text: "Mirzo Ulug'bekdan stomatolog top" },
  { emoji: '📍', label: 'Shayxontohur', text: 'Shayxontohurdan stomatolog top' },
  { emoji: '📍', label: 'Sergeli', text: 'Sergelidan stomatolog top' },
  { emoji: '🗺️', label: "Toshkent bo'ylab", text: "Toshkent bo'ylab eng yaxshi stomatolog top" },
]

function DentistLocationPrompt({ onPick }) {
  const t = useT()
  return (
    <div className="w-full max-w-[85%] self-start">
      <p className="mb-2 text-[11px] font-medium text-muted">{t('ai.dentists.locationPrompt')}</p>
      <div className="flex flex-wrap gap-1.5">
        {DENTIST_LOCATIONS.map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={() => onPick(option.text)}
            className="rounded-full border border-neon-500/30 bg-neon-500/10 px-3 py-1.5 text-[11px] font-medium text-accent transition-colors hover:border-neon-500/60 hover:bg-neon-500/20"
          >
            <span className="mr-1">{option.emoji}</span>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Full-screen AI workspace used on /ai: a sidebar with recent chats
 * (new / rename / delete), per-chat history persisted to localStorage,
 * and optional image attachments sent to the shared backend.
 */
export default function AiChat({ initialMessage = null, initialChatId = null, navigate = null }) {
  const t = useT()
  const lang = useLang()

  const initialChatIdRef = useRef(null)
  const initialActiveIdRef = useRef(null)
  const [state, setState] = useState(() => {
    const loaded = loadChats(t('ai.imageOnlyTitle'))
    if (initialMessage) {
      const id = createChatId()
      initialChatIdRef.current = id
      initialActiveIdRef.current = id
      return {
        chats: [
          {
            id,
            title: makeTitle(initialMessage, t('ai.imageOnlyTitle')),
            created_at: Date.now(),
            updated_at: Date.now(),
            messages: [
              WELCOME_MESSAGE,
              { id: 'initial-message', from: 'user', text: initialMessage, created_at: Date.now() },
            ],
          },
          ...loaded,
        ],
        activeId: id,
      }
    }
    if (loaded.length === 0) {
      const id = createChatId()
      initialActiveIdRef.current = id
      return {
        chats: [
          {
            id,
            title: t('ai.newChat'),
            created_at: Date.now(),
            updated_at: Date.now(),
            messages: [WELCOME_MESSAGE],
          },
        ],
        activeId: id,
      }
    }
    const matched = initialChatId ? loaded.find((c) => c.id === initialChatId) : null
    const activeId = matched ? matched.id : loaded[0].id
    initialActiveIdRef.current = activeId
    return { chats: loaded, activeId }
  })

  const chats = state.chats
  const activeId = state.activeId
  const activeChat = chats.find((c) => c.id === activeId) ?? null

  const chatsRef = useRef(chats)
  const consumedRef = useRef(false)
  const stickToBottomRef = useRef(true)
  const sessionImagesRef = useRef(new Map())
  const sessionFilesRef = useRef(new Map())
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const fileRef = useRef(null)
  const pdfRef = useRef(null)

  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(Boolean(initialMessage))
  const [streamingId, setStreamingId] = useState(null)
  const [status, setStatus] = useState('checking')
  const [error, setError] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [attachment, setAttachment] = useState(null)
  const [attachError, setAttachError] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [renamingId, setRenamingId] = useState(null)
  const [renameText, setRenameText] = useState('')

  const mutateChats = useCallback(
    (fn, options = {}) => {
      const next = fn(chatsRef.current)
      chatsRef.current = next
      setState((s) => ({ ...s, chats: next }))
      if (options.persist !== false) saveChats(next, t('ai.imageOnlyTitle'))
    },
    [t]
  )

  const setActiveId = useCallback((id) => {
    setState((s) => (s.activeId === id ? s : { ...s, activeId: id }))
    const target = `/ai/${id}`
    if (window.location.pathname !== target) {
      window.history.replaceState({}, '', target)
    }
  }, [])

  useEffect(() => {
    checkBackendHealth().then((ok) => setStatus(ok ? 'online' : 'offline'))
  }, [])

  useEffect(() => {
    if (!confirmId) return
    const timer = setTimeout(() => setConfirmId(null), 2500)
    return () => clearTimeout(timer)
  }, [confirmId])

  useEffect(() => {
    if (!attachError) return
    const timer = setTimeout(() => setAttachError(null), 4000)
    return () => clearTimeout(timer)
  }, [attachError])

  const requestReply = useCallback(
    async (chatId, text, image, file) => {
      setError(null)
      setIsSending(true)
      const replyId = createChatId()
      let buffer = ''

      const appendDelta = (delta) => {
        buffer += delta
        mutateChats(
          (list) =>
            updateChat(list, chatId, (chat) => ({
              ...chat,
              updated_at: Date.now(),
              messages: chat.messages.map((m) =>
                m.id === replyId ? { ...m, text: buffer } : m
              ),
            })),
          { persist: false }
        )
      }

      const finalize = (extra = {}) =>
        mutateChats((list) =>
          updateChat(list, chatId, (chat) => ({
            ...chat,
            updated_at: Date.now(),
            messages: chat.messages.map((m) =>
              m.id === replyId ? { ...m, text: buffer, ...extra } : m
            ),
          }))
        )

      const dropPlaceholder = () =>
        mutateChats((list) =>
          updateChat(list, chatId, (chat) => ({
            ...chat,
            updated_at: Date.now(),
            messages: chat.messages.filter((m) => m.id !== replyId),
          }))
        )

      mutateChats(
        (list) =>
          updateChat(list, chatId, (chat) => ({
            ...chat,
            updated_at: Date.now(),
            messages: [
              ...chat.messages,
              { id: replyId, from: 'ai', text: '', created_at: Date.now() },
            ],
          })),
        { persist: false }
      )
      setStreamingId(replyId)

      try {
        if (file) {
          const result = await analyzeFile({
            filename: file.name,
            mime: file.mime,
            base64: file.base64,
            question: text,
            language: lang,
          })
          buffer = result.analysis
          finalize()
        } else {
          const result = await sendChatMessage({
            message: text,
            conversationId: chatId,
            language: lang,
            image,
            onDelta: appendDelta,
          })
          if (result.sources?.length) {
            finalize({ dentist: result.dentist, sources: result.sources })
          } else if (result.dentist) {
            finalize({ dentist: result.dentist })
          } else {
            finalize()
          }
        }
        setStatus('online')
      } catch (err) {
        const code = err instanceof ChatError ? err.code : 'server'
        if (code === 'network') setStatus('offline')
        if (buffer) {
          finalize()
        } else {
          dropPlaceholder()
        }
        setError(ERROR_KEYS[code] ?? ERROR_KEYS.server)
      } finally {
        setStreamingId(null)
        setIsSending(false)
      }
    },
    [lang, mutateChats]
  )

  useEffect(() => {
    if (!initialMessage || consumedRef.current) return
    consumedRef.current = true
    // Consume the navigation state so a refresh never resends the message.
    const chatId = initialChatIdRef.current
    if (chatId) window.history.replaceState({}, '', `/ai/${chatId}`)
    if (chatId) requestReply(chatId, initialMessage)
  }, [initialMessage, requestReply])

  useEffect(() => {
    const id = initialActiveIdRef.current
    if (!id) return
    const target = `/ai/${id}`
    if (window.location.pathname !== target) {
      window.history.replaceState({}, '', target)
    }
  }, [])

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    if (stickToBottomRef.current) list.scrollTop = list.scrollHeight
  }, [activeChat?.messages, isSending, lang])

  function handleScroll() {
    const list = listRef.current
    if (!list) return
    stickToBottomRef.current =
      list.scrollHeight - list.scrollTop - list.clientHeight < 80
  }

  function handleNewChat() {
    const id = createChatId()
    const chat = {
      id,
      title: t('ai.newChat'),
      created_at: Date.now(),
      updated_at: Date.now(),
      messages: [WELCOME_MESSAGE],
    }
    mutateChats((list) => [chat, ...list])
    setActiveId(id)
    setInput('')
    setAttachment(null)
    setAttachError(null)
    setError(null)
    setDrawerOpen(false)
  }

  function handleSelect(id) {
    setActiveId(id)
    setInput('')
    setAttachment(null)
    setAttachError(null)
    setError(null)
    setDrawerOpen(false)
  }

  /** Remove the last AI reply and ask again with the preceding user message. */
  function handleRegenerate() {
    if (isSending || !activeChat) return
    const messages = activeChat.messages
    const aiIndex = messages.map((m) => m.from).lastIndexOf('ai')
    if (aiIndex < 0) return
    const lastUser = [...messages.slice(0, aiIndex)]
      .reverse()
      .find((m) => m.from === 'user')
    if (!lastUser) return
    const replyId = messages[aiIndex].id
    const sessionImages = sessionImagesRef.current.get(activeChat.id)
    const sessionFiles = sessionFilesRef.current.get(activeChat.id)
    const imageFull = sessionImages?.get(lastUser.id) ?? null
    const filePayload = sessionFiles?.get(lastUser.id) ?? null
    mutateChats((list) =>
      updateChat(list, activeChat.id, (chat) => ({
        ...chat,
        updated_at: Date.now(),
        messages: chat.messages.filter((m) => m.id !== replyId),
      }))
    )
    setError(null)
    requestReply(activeChat.id, lastUser.text, imageFull, filePayload)
  }

  function handleDelete(id) {
    if (confirmId !== id) {
      setConfirmId(id)
      return
    }
    setConfirmId(null)
    const next = chatsRef.current.filter((c) => c.id !== id)
    mutateChats(() => next)
    if (activeId === id) {
      if (next.length > 0) {
        setActiveId(next[0].id)
      } else {
        const freshId = createChatId()
        mutateChats(() => [
          {
            id: freshId,
            title: t('ai.newChat'),
            created_at: Date.now(),
            updated_at: Date.now(),
            messages: [WELCOME_MESSAGE],
          },
        ])
        setActiveId(freshId)
      }
    }
  }

  function handleStartRename(id, title) {
    setRenamingId(id)
    setRenameText(title)
  }

  function handleCommitRename(id, cancel = false) {
    if (!cancel) {
      const text = renameText.trim()
      if (text) {
        mutateChats((list) =>
          list.map((c) => (c.id === id ? { ...c, title: text } : c))
        )
      }
    }
    setRenamingId(null)
  }

  function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

function validateFile(file) {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  const isText = file.type.startsWith('text/') || FILE_TYPES.includes(file.type)
  if (!isPdf && !isText) return { ok: false, error: 'type' }
  if (file.size > FILE_MAX_BYTES) return { ok: false, error: 'size' }
  return { ok: true }
}

  async function handleAttach(file) {
    if (!file) return
    if (file.type.startsWith('image/')) {
      const result = validateImage(file)
      if (!result.ok) {
        setAttachError(result.error === 'size' ? t('ai.imageTooLarge') : t('ai.imageTypeError'))
        return
      }
      try {
        const [thumb, full] = await Promise.all([
          processImage(file, { maxDim: 512, quality: 0.7 }),
          processImage(file, { maxDim: 1280, quality: 0.82 }),
        ])
        setAttachment({ kind: 'image', full, thumb, name: file.name })
      } catch {
        setAttachError(t('ai.imageTypeError'))
      }
      return
    }

    const result = validateFile(file)
    if (!result.ok) {
      setAttachError(result.error === 'size' ? t('ai.fileTooLarge') : t('ai.fileTypeError'))
      return
    }
    try {
      const base64 = await readAsBase64(file)
      setAttachment({
        kind: 'file',
        name: file.name,
        mime: file.type || 'application/octet-stream',
        base64,
        size: file.size,
      })
    } catch {
      setAttachError(t('ai.fileTypeError'))
    }
  }

  function handleSend() {
    if (isSending || !activeChat) return
    const text = input.trim()
    if (!text && !attachment) return

    const userMessage = {
      id: createChatId(),
      from: 'user',
      text,
      created_at: Date.now(),
      ...(attachment?.kind === 'image' ? { image: attachment.thumb } : {}),
      ...(attachment?.kind === 'file' ? { file_name: attachment.name } : {}),
    }

    if (attachment?.kind === 'image') {
      let chatImages = sessionImagesRef.current.get(activeChat.id)
      if (!chatImages) {
        chatImages = new Map()
        sessionImagesRef.current.set(activeChat.id, chatImages)
      }
      chatImages.set(userMessage.id, attachment.full)
    }
    if (attachment?.kind === 'file') {
      let chatFiles = sessionFilesRef.current.get(activeChat.id)
      if (!chatFiles) {
        chatFiles = new Map()
        sessionFilesRef.current.set(activeChat.id, chatFiles)
      }
      chatFiles.set(userMessage.id, attachment)
    }

    const isFirstUserMessage = !activeChat.messages.some((m) => m.from === 'user')
    const imageFull = attachment?.kind === 'image' ? attachment.full : null
    const filePayload = attachment?.kind === 'file' ? attachment : null

    mutateChats((list) =>
      updateChat(list, activeChat.id, (chat) => ({
        ...chat,
        title:
          isFirstUserMessage
            ? makeTitle(
                text,
                attachment?.kind === 'file' ? t('ai.fileOnlyTitle') : t('ai.imageOnlyTitle')
              )
            : chat.title,
        updated_at: Date.now(),
        messages: [...chat.messages, userMessage],
      }))
    )

    setInput('')
    setAttachment(null)
    setAttachError(null)
    requestReply(activeChat.id, text, imageFull, filePayload)
  }

  /** Send a pre-composed text (dentist location quick picks, suggestions). */
  function sendQuick(text) {
    if (isSending || !activeChat || !text.trim()) return
    const userMessage = {
      id: createChatId(),
      from: 'user',
      text,
      created_at: Date.now(),
    }
    const isFirstUserMessage = !activeChat.messages.some((m) => m.from === 'user')
    mutateChats((list) =>
      updateChat(list, activeChat.id, (chat) => ({
        ...chat,
        title: isFirstUserMessage ? makeTitle(text, t('ai.imageOnlyTitle')) : chat.title,
        updated_at: Date.now(),
        messages: [...chat.messages, userMessage],
      }))
    )
    requestReply(activeChat.id, text, null, null)
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  function growInput() {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`
  }

  const trimmed = input.trim()
  const canSend = Boolean(trimmed || attachment) && !isSending

  const sessionImages = sessionImagesRef.current.get(activeChat?.id ?? '')
  const sessionFiles = sessionFilesRef.current.get(activeChat?.id ?? '')
  const streamingMsg = activeChat?.messages.find((m) => m.id === streamingId)
  const sidebarProps = {
    chats,
    activeId,
    confirmId,
    renamingId,
    renameText,
    t,
    onSelect: handleSelect,
    onNew: handleNewChat,
    onDelete: handleDelete,
    onStartRename: handleStartRename,
    onRenameChange: setRenameText,
    onCommitRename: handleCommitRename,
  }

  return (
    <div className="relative flex h-full w-full overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/4 h-64 w-96 rounded-full bg-neon-500/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-1/4 h-64 w-96 rounded-full bg-electric-500/10 blur-3xl"
      />

      <aside className="relative z-10 hidden w-[280px] shrink-0 border-r border-border bg-card/40 backdrop-blur-sm md:block">
        <SidebarContent {...sidebarProps} />
      </aside>

      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
              className="absolute inset-y-0 left-0 z-40 w-[280px] border-r border-border bg-bg shadow-2xl md:hidden"
            >
              <SidebarContent {...sidebarProps} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <section className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label={t('ai.sidebar')}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-card-hover hover:text-fg md:hidden"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M4 6h16M4 12h16M4 18h16"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-neon-500 to-electric-500 text-white shadow-[0_0_12px_rgba(139,92,246,0.45)]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z"
                  fill="currentColor"
                />
                <path
                  d="M19 15.5l.8 2.7 2.7.8-2.7.8-.8 2.7-.8-2.7-2.7-.8 2.7-.8.8-2.7Z"
                  fill="currentColor"
                  opacity="0.75"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-semibold leading-tight text-fg">
                {activeChat ? activeChat.title : ''}
              </p>
              <p className="flex items-center gap-1.5 text-[10px] leading-tight text-muted">
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
                {t(STATUS_KEY[status])}
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-neon-500/30 bg-neon-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-accent">
            {t('ai.beta')}
          </span>
        </header>

        <div
          ref={listRef}
          onScroll={handleScroll}
          className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"
        >
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-2.5 px-3 py-4 sm:px-4">
            {activeChat &&
              activeChat.messages.map((message) => {
                const full = sessionImages?.get(message.id)
                const imageSrc = full || message.image
                const fileInfo = sessionFiles?.get(message.id)
                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className={
                      'flex flex-col gap-1.5 ' +
                      (message.from === 'user'
                        ? 'items-end self-end'
                        : 'items-start self-start')
                    }
                  >
                    {message.from === 'user' ? (
                      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-r from-neon-600 to-electric-600 px-3.5 py-2.5 text-[13px] leading-relaxed text-white shadow-[0_2px_12px_rgba(139,92,246,0.3)]">
                        {imageSrc && (
                          <img
                            src={imageSrc}
                            alt=""
                            className="mb-1.5 max-h-40 w-auto max-w-full rounded-xl object-cover"
                          />
                        )}
                        {(message.file_name || fileInfo) && (
                          <div className="mb-1.5 flex items-center gap-2 rounded-lg bg-white/15 px-2.5 py-1.5 text-[11px] font-medium">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path
                                d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinejoin="round"
                              />
                              <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                            </svg>
                            <span className="truncate">{message.file_name}</span>
                          </div>
                        )}
                        {message.text && (
                          <p className="whitespace-pre-wrap break-words">{message.text}</p>
                        )}
                      </div>
                    ) : (
                      <div className="ai-message max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-md border border-border bg-ai-bot px-3.5 py-2.5 text-[13px] leading-relaxed text-fg">
                        {message.key ? (
                          <p>{t(message.key)}</p>
                        ) : (
                          <div>{renderMarkdown(message.text)}</div>
                        )}
                      </div>
                    )}
                    {message.from === 'ai' && (
                      <>
                        <SourceChips sources={message.sources} />
                        {streamingId !== message.id && message.text && (
                          <MessageActions
                            text={message.text}
                            canRegenerate={
                              activeChat.messages[activeChat.messages.length - 1]?.id ===
                              message.id
                            }
                            onRegenerate={handleRegenerate}
                            className="mt-0.5"
                          />
                        )}
                      </>
                    )}
                    {message.from === 'ai' && message.dentist && message.dentist.dentists?.length > 0 && (
                      <DentistCards
                        dentist={message.dentist}
                        lang={lang}
                        navigate={navigate}
                        onQueued={(modal) => {
                          if (modal && navigate) navigate('/queue')
                        }}
                      />
                    )}
                    {message.from === 'ai' && message.dentist?.askLocation && (
                      <DentistLocationPrompt onPick={sendQuick} />
                    )}
                  </motion.div>
                )
              })}

            {isSending && (!streamingMsg || streamingMsg.text === '') && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-1.5 self-start rounded-2xl rounded-bl-md border border-border bg-ai-bot px-3.5 py-2.5"
                aria-label={t('ai.typing')}
              >
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-neon-400"
                    style={{ animationDelay: `${dot * 0.15}s` }}
                  />
                ))}
              </motion.div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-border bg-bg/60 px-3 pb-3 pt-2 sm:px-4">
          <div className="mx-auto w-full max-w-3xl">
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <p className="mb-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-2 text-[11px] text-rose-300">
                    {t(error)}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {attachError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <p className="mb-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-2 text-[11px] text-amber-300">
                    {attachError}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {attachment && attachment.kind === 'image' && (
              <div className="mb-2 flex items-center gap-2.5 rounded-2xl border border-border bg-card px-3 py-2">
                <img
                  src={attachment.thumb}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-lg object-cover"
                />
                <p className="min-w-0 flex-1 truncate text-[12px] text-muted">
                  {attachment.name}
                </p>
                <button
                  type="button"
                  onClick={() => setAttachment(null)}
                  aria-label={t('ai.removeImage')}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-faint transition-colors hover:bg-card-hover hover:text-rose-300"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M6 6l12 12M18 6 6 18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            )}

            {attachment && attachment.kind === 'file' && (
              <div className="mb-2 flex items-center gap-2.5 rounded-2xl border border-border bg-card px-3 py-2">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neon-500/15 text-accent">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                    <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] text-muted">{attachment.name}</p>
                  <p className="text-[10px] text-faint">
                    {Math.round(attachment.size / 1024)} KB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAttachment(null)}
                  aria-label={t('ai.removeFile')}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-faint transition-colors hover:bg-card-hover hover:text-rose-300"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M6 6l12 12M18 6 6 18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            )}

            <div className="flex items-end gap-2 rounded-2xl border border-border bg-input py-1.5 pl-2 pr-1.5 transition-colors focus-within:border-neon-500/40 focus-within:bg-input-focus">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) handleAttach(file)
                  event.target.value = ''
                }}
              />
              <input
                ref={pdfRef}
                type="file"
                accept=".pdf,text/plain,text/csv,text/markdown,application/json,application/xml"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) handleAttach(file)
                  event.target.value = ''
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={isSending}
                aria-label={t('ai.attachImage')}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-card-hover hover:text-accent disabled:opacity-40"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M4 16l4.5-4.5 3 3L17 9l3 3M4 20h16M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => pdfRef.current?.click()}
                disabled={isSending}
                aria-label={t('ai.attachFile')}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-card-hover hover:text-accent disabled:opacity-40"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                  <path d="M14 2v6h6M8 13h8m-8 4h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                </svg>
              </button>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => {
                  setInput(event.target.value)
                  growInput()
                }}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder={t('ai.placeholder')}
                aria-label={t('ai.messageLabel')}
                className="max-h-24 min-w-0 flex-1 resize-none bg-transparent py-1.5 text-sm text-fg outline-none placeholder:text-faint [scrollbar-width:none]"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                aria-label={t('ai.send')}
                className={
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition-all duration-300 ' +
                  (canSend
                    ? 'bg-gradient-to-br from-neon-600 to-electric-500 shadow-[0_0_14px_rgba(139,92,246,0.4)] hover:shadow-[0_0_20px_rgba(139,92,246,0.6)]'
                    : 'bg-input text-faint')
                }
              >
                {isSending ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path
                      d="M2 8h11m0 0L9 4m4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-faint">{t('ai.hint')}</p>
          </div>
        </div>
      </section>
    </div>
  )
}
