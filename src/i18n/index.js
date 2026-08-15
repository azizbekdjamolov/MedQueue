import { useCallback, useSyncExternalStore } from 'react'
import uz from './translations/uz.js'
import ru from './translations/ru.js'
import en from './translations/en.js'

const TRANSLATIONS = { uz, ru, en }

const LANG_KEY = 'language'
const DEFAULT_LANG = 'uz'

export const LANGS = [
  { code: 'uz', label: "O'zbekcha", flag: '🇺🇿' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
]

function loadLang() {
  try {
    const saved = window.localStorage.getItem(LANG_KEY)
    if (saved && TRANSLATIONS[saved]) return saved
  } catch {
    // Storage unavailable — fall back to the default language.
  }
  return DEFAULT_LANG
}

let lang = loadLang()
const listeners = new Set()

function emit() {
  listeners.forEach((fn) => fn())
}

export function getLang() {
  return lang
}

export function subscribeLang(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Change the UI language without reloading the page. Persists to localStorage. */
export function setLang(code) {
  if (!TRANSLATIONS[code] || code === lang) return
  lang = code
  document.documentElement.lang = code
  try {
    window.localStorage.setItem(LANG_KEY, code)
  } catch {
    // Storage unavailable — the language still applies for this session.
  }
  emit()
}

function lookup(dict, key) {
  let node = dict
  for (const part of key.split('.')) {
    if (node == null || typeof node !== 'object') return null
    node = node[part]
  }
  return typeof node === 'string' ? node : null
}

/** Reactive translate function: re-renders consumers when the language changes. */
export function useT() {
  const current = useSyncExternalStore(subscribeLang, getLang, getLang)
  return useCallback((key) => lookup(TRANSLATIONS[current], key) ?? key, [current])
}

/** Reactive current language code ('uz' | 'ru' | 'en'). */
export function useLang() {
  return useSyncExternalStore(subscribeLang, getLang, getLang)
}