import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes, randomUUID, scrypt as _scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

/**
 * MedQueue Tashkent — authentication module.
 *
 * Zero-dependency user store backed by a JSON file (server/data/users.json),
 * matching the project's in-memory architecture while surviving restarts.
 * Passwords are hashed with scrypt (per-user salt) — plaintext is never
 * stored. Sessions are opaque random tokens in httpOnly cookies.
 */

const scrypt = promisify(_scrypt)
const SCRYPT_KEYLEN = 64

const DATA_DIR = resolve(dirname(fileURLToPath(import.meta.url)), 'data')
const USERS_FILE = resolve(DATA_DIR, 'users.json')

const SESSION_COOKIE = 'mq_session'
const SESSION_REMEMBER_MS = 30 * 24 * 60 * 60 * 1000
const SESSION_TEMP_MS = 12 * 60 * 60 * 1000
const RESET_TTL_MS = 30 * 60 * 1000
const AVATAR_MAX_CHARS = 2 * 1024 * 1024
const AVATAR_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/* ------------------------------- Store --------------------------------- */

function loadUsers() {
  try {
    if (!existsSync(USERS_FILE)) return []
    const parsed = JSON.parse(readFileSync(USERS_FILE, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.error(`[auth] could not load users file: ${err.message}`)
    return []
  }
}

const users = loadUsers()
const sessions = new Map() // token -> { userId, expiresAt }
const resetTokens = new Map() // token -> { userId, expiresAt }

function persistUsers() {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
    writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8')
  } catch (err) {
    console.error(`[auth] could not persist users file: ${err.message}`)
  }
}

function cleanSessions() {
  const now = Date.now()
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(token)
  }
  for (const [token, reset] of resetTokens) {
    if (reset.expiresAt <= now) resetTokens.delete(token)
  }
}

const cleanupTimer = setInterval(cleanSessions, 10 * 60 * 1000)
cleanupTimer.unref?.()

/* ----------------------------- Password hash --------------------------- */

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const derived = await scrypt(password, salt, SCRYPT_KEYLEN)
  return `scrypt$${salt}$${derived.toString('hex')}`
}

async function verifyPassword(password, stored) {
  const [algo, salt, hash] = String(stored ?? '').split('$')
  if (algo !== 'scrypt' || !salt || !hash) return false
  try {
    const derived = await scrypt(password, salt, SCRYPT_KEYLEN)
    const expected = Buffer.from(hash, 'hex')
    return expected.length === derived.length && timingSafeEqual(expected, derived)
  } catch {
    return false
  }
}

/* ------------------------------ Validation ----------------------------- */

/** Normalize a phone number to "+998XXXXXXXXX" or null when invalid. */
export function normalizePhone(raw) {
  if (typeof raw !== 'string') return null
  const digits = raw.replace(/[^\d]/g, '')
  let normalized = digits
  if (normalized.startsWith('8') && normalized.length === 12) {
    normalized = `9${normalized.slice(1)}`
  } else if (normalized.startsWith('998') && normalized.length === 12) {
    // already normalized
  } else {
    return null
  }
  if (!/^998\d{9}$/.test(normalized)) return null
  return `+${normalized}`
}

export function normalizeEmail(raw) {
  if (typeof raw !== 'string') return null
  const email = raw.trim().toLowerCase()
  if (email.length > 200 || !EMAIL_RE.test(email)) return null
  return email
}

function validDob(raw) {
  if (raw == null || raw === '') return null
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const date = new Date(`${raw}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return null
  if (date.getTime() > Date.now()) return null
  return raw
}

function validGender(raw) {
  if (raw == null || raw === '') return null
  return ['male', 'female', 'other'].includes(raw) ? raw : null
}

function validAvatar(raw) {
  if (raw == null || raw === '') return null
  if (typeof raw !== 'string' || raw.length > AVATAR_MAX_CHARS) return null
  const match = /^data:([a-z0-9./+-]+);base64,/.exec(raw)
  if (!match || !AVATAR_MIMES.has(match[1])) return null
  return raw
}

/** Pick the safe, public fields of a user — password hash never leaves this module. */
export function publicUser(user) {
  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    date_of_birth: user.date_of_birth ?? null,
    gender: user.gender ?? null,
    avatar: user.avatar ?? null,
    created_at: user.created_at,
    updated_at: user.updated_at,
  }
}

export function findUserByEmail(email) {
  const normalized = normalizeEmail(email)
  if (!normalized) return null
  return users.find((u) => u.email === normalized) ?? null
}

export function findUserByPhone(phone) {
  const normalized = normalizePhone(phone)
  if (!normalized) return null
  return users.find((u) => u.phone === normalized) ?? null
}

export function findUserById(id) {
  return users.find((u) => u.id === id) ?? null
}

/* ------------------------------ Registration --------------------------- */

/**
 * Validate registration payload. Returns { errors: [codes] } when invalid,
 * otherwise { data: normalized fields }.
 */
export function validateRegistration(body) {
  const errors = []

  const full_name =
    typeof body?.full_name === 'string' ? body.full_name.trim().slice(0, 120) : ''
  if (full_name.length < 2) errors.push('invalid_name')

  const email = normalizeEmail(body?.email)
  if (!email) errors.push('invalid_email')
  else if (findUserByEmail(email)) errors.push('email_taken')

  const phone = normalizePhone(body?.phone)
  if (!phone) errors.push('invalid_phone')
  else if (findUserByPhone(phone)) errors.push('phone_taken')

  const password = typeof body?.password === 'string' ? body.password : ''
  if (password.length < 8 || password.length > 128) errors.push('password_too_short')

  const confirm = typeof body?.confirm_password === 'string' ? body.confirm_password : ''
  if (password && confirm && password !== confirm) errors.push('passwords_mismatch')

  const date_of_birth = validDob(body?.date_of_birth)
  if (body?.date_of_birth != null && body.date_of_birth !== '' && !date_of_birth) {
    errors.push('invalid_dob')
  }
  const gender = validGender(body?.gender)
  if (body?.gender != null && body.gender !== '' && !gender) errors.push('invalid_gender')

  if (errors.length) return { errors }
  return {
    data: {
      full_name,
      email,
      phone,
      password,
      date_of_birth,
      gender,
    },
  }
}

export async function registerUser(fields) {
  const user = {
    id: randomUUID(),
    full_name: fields.full_name,
    email: fields.email,
    phone: fields.phone,
    password_hash: await hashPassword(fields.password),
    date_of_birth: fields.date_of_birth ?? null,
    gender: fields.gender ?? null,
    avatar: null,
    patient_id: null,
    created_at: Date.now(),
    updated_at: Date.now(),
  }
  users.push(user)
  persistUsers()
  return user
}

/* -------------------------------- Login -------------------------------- */

/** Find a user by "email or phone" login identifier. */
export function findUserByLogin(identifier) {
  const byEmail = findUserByEmail(identifier)
  if (byEmail) return byEmail
  const byPhone = findUserByPhone(identifier)
  if (byPhone) return byPhone
  return null
}

export async function verifyCredentials(identifier, password) {
  const user = findUserByLogin(identifier)
  if (!user) return null
  const ok = await verifyPassword(password, user.password_hash)
  return ok ? user : null
}

/* ------------------------------- Sessions ------------------------------ */

function issueToken() {
  return randomBytes(32).toString('hex')
}

export function createSession(userId, remember = false) {
  const token = issueToken()
  const expiresAt = Date.now() + (remember ? SESSION_REMEMBER_MS : SESSION_TEMP_MS)
  sessions.set(token, { userId, expiresAt })
  return { token, expiresAt }
}

export function destroySession(token) {
  if (token) sessions.delete(token)
}

export function getUserFromToken(token) {
  if (!token) return null
  const session = sessions.get(token)
  if (!session) return null
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token)
    return null
  }
  return findUserById(session.userId)
}

export function sessionCookieValue(token, remember, crossOrigin = false) {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    crossOrigin ? 'SameSite=None; Secure' : 'SameSite=Lax',
  ]
  if (remember) parts.push(`Max-Age=${Math.floor(SESSION_REMEMBER_MS / 1000)}`)
  return parts.join('; ')
}

/** Read the session token from a Cookie header. */
export function readSessionToken(cookieHeader) {
  if (typeof cookieHeader !== 'string') return null
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === SESSION_COOKIE && rest.length) return rest.join('=').trim()
  }
  return null
}

/* ------------------------------- Profile ------------------------------- */

export function validateProfileUpdate(body) {
  const errors = []
  const next = {}

  const full_name =
    typeof body?.full_name === 'string' ? body.full_name.trim().slice(0, 120) : ''
  if (full_name.length < 2) errors.push('invalid_name')
  else next.full_name = full_name

  const email = normalizeEmail(body?.email)
  if (!email) errors.push('invalid_email')
  else {
    const taken = findUserByEmail(email)
    if (taken && taken.id !== body?._userId) errors.push('email_taken')
    else next.email = email
  }

  const phone = normalizePhone(body?.phone)
  if (!phone) errors.push('invalid_phone')
  else {
    const taken = findUserByPhone(phone)
    if (taken && taken.id !== body?._userId) errors.push('phone_taken')
    else next.phone = phone
  }

  const date_of_birth = validDob(body?.date_of_birth)
  if (body?.date_of_birth != null && body.date_of_birth !== '' && !date_of_birth) {
    errors.push('invalid_dob')
  } else {
    next.date_of_birth = date_of_birth
  }

  const gender = validGender(body?.gender)
  if (body?.gender != null && body.gender !== '' && !gender) errors.push('invalid_gender')
  else next.gender = gender

  const avatar = validAvatar(body?.avatar)
  if (body?.avatar != null && body.avatar !== '' && !avatar) errors.push('invalid_avatar')
  else next.avatar = avatar

  if (errors.length) return { errors }
  return { data: next }
}

export function updateUserProfile(userId, data) {
  const user = findUserById(userId)
  if (!user) return null
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) user[key] = value
  }
  user.updated_at = Date.now()
  persistUsers()
  return user
}

/* ---------------------------- Change password -------------------------- */

export async function changeUserPassword(userId, currentPassword, newPassword) {
  const user = findUserById(userId)
  if (!user) return { code: 'not_authenticated' }
  if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
    return { code: 'password_too_short' }
  }
  if (currentPassword && !(await verifyPassword(currentPassword, user.password_hash))) {
    return { code: 'wrong_password' }
  }
  if (currentPassword && (await verifyPassword(newPassword, user.password_hash))) {
    return { code: 'same_password' }
  }
  user.password_hash = await hashPassword(newPassword)
  user.updated_at = Date.now()
  persistUsers()
  return { ok: true }
}

/* ----------------------------- Password reset -------------------------- */

/** Create a reset token (30 min TTL). In production this is emailed. */
export function createResetToken(user) {
  const token = issueToken()
  resetTokens.set(token, { userId: user.id, expiresAt: Date.now() + RESET_TTL_MS })
  return token
}

export async function resetUserPassword(token, newPassword) {
  if (typeof token !== 'string' || !token) return { code: 'invalid_token' }
  const reset = resetTokens.get(token)
  if (!reset) return { code: 'invalid_token' }
  if (reset.expiresAt <= Date.now()) {
    resetTokens.delete(token)
    return { code: 'invalid_token' }
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
    return { code: 'password_too_short' }
  }
  const user = findUserById(reset.userId)
  if (!user) return { code: 'invalid_token' }
  resetTokens.delete(token)
  user.password_hash = await hashPassword(newPassword)
  user.updated_at = Date.now()
  persistUsers()
  return { ok: true }
}

/* ------------------------------ Demo helpers --------------------------- */

/** All registered users (sanitized) — used by stats/admin surfaces if needed. */
export function listPublicUsers() {
  return users.map(publicUser)
}
