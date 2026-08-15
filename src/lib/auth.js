import { useSyncExternalStore } from 'react'
import { API_BASE } from './api'

/**
 * MedQueue Tashkent — authentication store.
 *
 * Session lives in an httpOnly cookie (set by the backend), so a page
 * refresh keeps the user logged in. The store keeps a copy of the public
 * user profile and re-validates it against GET /api/auth/me on app start.
 */

const USER_KEY = 'mq_user'

let user = loadUser()
let status = user ? 'authenticated' : 'guest'
let bootstrapped = false

const listeners = new Set()

function loadUser() {
  try {
    const raw = window.localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function persistUser(next) {
  try {
    if (next) window.localStorage.setItem(USER_KEY, JSON.stringify(next))
    else window.localStorage.removeItem(USER_KEY)
  } catch {
    // Storage unavailable — session still works via the cookie.
  }
}

function setState(nextUser) {
  user = nextUser
  status = nextUser ? 'authenticated' : 'guest'
  persistUser(nextUser)
  emit()
}

function emit() {
  listeners.forEach((fn) => fn())
}

export function subscribeAuth(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

let cachedSnapshot = null

/**
 * Auth snapshot for useSyncExternalStore. React 19 requires the snapshot to
 * be referentially stable between calls, otherwise the store appears to
 * change forever and the app loops into "Maximum update depth exceeded".
 * The object is only recreated when one of the values actually changes.
 */
export function getAuth() {
  const next = { user, status, bootstrapped }
  if (
    !cachedSnapshot ||
    cachedSnapshot.user !== next.user ||
    cachedSnapshot.status !== next.status ||
    cachedSnapshot.bootstrapped !== next.bootstrapped
  ) {
    cachedSnapshot = next
  }
  return cachedSnapshot
}

/** Reactive auth state: { user, status: 'guest'|'authenticated', bootstrapped }. */
export function useAuth() {
  return useSyncExternalStore(subscribeAuth, getAuth, getAuth)
}

/**
 * Called once at startup: restores the session from the cookie if present.
 * Until this resolves, `bootstrapped` is false (UI shows a loader).
 */
export async function bootstrapAuth() {
  if (bootstrapped) return
  try {
    const data = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' })
    if (data.ok) {
      const body = await data.json()
      setState(body.user ?? null)
    } else {
      setState(null)
    }
  } catch {
    setState(null)
  } finally {
    bootstrapped = true
    emit()
  }
}

export async function login(identifier, password, remember = false) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ identifier, password, remember }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.user) {
    throw new ApiError(res.status, data?.error ?? 'unknown', data?.message)
  }
  setState(data.user)
  return data.user
}

export async function register(fields) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(fields),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.user) {
    throw new ApiError(res.status, data?.error ?? 'unknown', data?.message)
  }
  // Registration logs the user in automatically.
  setState(data.user)
  return data.user
}

export async function logout() {
  try {
    await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' })
  } catch {
    // Even if the server is unreachable, clear the local session.
  }
  setState(null)
}

/** Update the cached profile after profile edits. */
export function updateCachedUser(patch) {
  if (!user) return null
  setState({ ...user, ...patch })
  return user
}

export function isAuthenticated() {
  return status === 'authenticated'
}

/**
 * Guard for actions that need a session (e.g. taking a queue). Redirects to
 * /login keeping the current path, and returns false when the user is a guest.
 */
export function requireLogin(navigate) {
  if (isAuthenticated()) return true
  try {
    const current = window.location.pathname + window.location.search
    navigate(`/login?redirect=${encodeURIComponent(current)}`)
  } catch {
    navigate('/login')
  }
  return false
}

/** Triggered when any API call returns 401 (session expired / not logged in). */
export function handleSessionExpired() {
  if (user) setState(null)
}

/** ApiError carries the backend error code + safe message for translation. */
export class ApiError extends Error {
  constructor(status, code, message) {
    super(message || 'Request failed')
    this.status = status
    this.code = code
  }
}
