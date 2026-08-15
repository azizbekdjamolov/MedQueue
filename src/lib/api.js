/**
 * Small typed fetch helpers for the MedQueue backend.
 * In development calls go through the Vite dev proxy (same origin); in
 * production the frontend is hosted separately (Render Static Site), so
 * VITE_API_BASE_URL must point at the backend, e.g.
 *   https://medqueue-api.onrender.com
 */

import { ApiError, handleSessionExpired } from './auth'

export const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')

function apiUrl(url) {
  return API_BASE + url
}

async function getJson(url, timeoutMs = 15000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(apiUrl(url), { signal: controller.signal, credentials: 'include' })
    if (res.status === 401 && !url.startsWith('/api/auth/')) handleSessionExpired()
    const data = await res.json().catch(() => null)
    if (!res.ok || !data) throw new Error(`Request failed: ${res.status}`)
    return data
  } finally {
    clearTimeout(timer)
  }
}

function qs(params) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== '' && value != null && value !== false) search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

async function sendJson(url, method, body, timeoutMs = 20000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(apiUrl(url), {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: body == null ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
    if (res.status === 401 && !url.startsWith('/api/auth/')) handleSessionExpired()
    const data = await res.json().catch(() => null)
    return { ok: res.ok, status: res.status, data }
  } finally {
    clearTimeout(timer)
  }
}

export function fetchClinics(filters = {}, lang = 'uz') {
  return getJson(`/api/clinics${qs({ lang, ...filters })}`)
}

export function fetchDoctors(filters = {}, lang = 'uz') {
  return getJson(`/api/doctors${qs({ lang, ...filters })}`)
}

export function fetchSpecialties(lang = 'uz') {
  return getJson(`/api/specialties${qs({ lang })}`)
}

export function fetchDistricts(lang = 'uz') {
  return getJson(`/api/districts${qs({ lang })}`)
}

export function fetchClinicTypes(lang = 'uz') {
  return getJson(`/api/clinic-types${qs({ lang })}`)
}

export function fetchDashboard(lang = 'uz') {
  return getJson(`/api/dashboard${qs({ lang })}`)
}

export function fetchPatient(lang = 'uz') {
  return getJson(`/api/patients${qs({ lang })}`)
}

export function fetchLaboratoryResults(lang = 'uz') {
  return getJson(`/api/laboratory-results${qs({ lang })}`)
}

export function fetchAppointments(lang = 'uz') {
  return getJson(`/api/appointments${qs({ lang })}`)
}

export function fetchMedicalHistory(lang = 'uz') {
  return getJson(`/api/medical-history${qs({ lang })}`)
}

export function fetchQueue(doctorId, lang = 'uz') {
  return getJson(`/api/queue${qs({ doctor_id: doctorId, lang })}`)
}

export function fetchCityStats() {
  return getJson('/api/stats')
}

export function fetchStats(lang = 'uz') {
  return Promise.all([fetchClinics({}, lang), fetchDoctors({}, lang), fetchCityStats()]).then(
    ([clinics, doctors, stats]) => ({
      clinics: clinics.clinics ?? [],
      doctors: doctors.doctors ?? [],
      cityStats: stats.cityStats ?? { total: 0, servedToday: 0 },
    })
  )
}

export async function takeQueue(doctorId, lang = 'uz') {
  const { ok, status, data } = await sendJson(
    '/api/queue/take',
    'POST',
    { doctor_id: doctorId, lang },
    15000
  )
  if (!ok || !data?.queue) throw new Error(`Request failed: ${status}`)
  return data.queue
}

export async function cancelQueue(doctorId, lang = 'uz') {
  const { ok, status, data } = await sendJson(
    '/api/queue/cancel',
    'POST',
    { doctor_id: doctorId, lang },
    15000
  )
  if (!ok || !data?.queue) throw new Error(`Request failed: ${status}`)
  return data.queue
}

/* ------------------------- Telegram linking ------------------------- */

export function apiTelegramStatus() {
  return getJson('/api/telegram/status')
}

export async function apiTelegramLink() {
  const { ok, status, data } = await sendJson('/api/telegram/link', 'POST', {}, 15000)
  if (!ok || !data?.link) throw new Error(`Request failed: ${status}`)
  return data.link
}

export async function apiTelegramUnlink() {
  const { ok, status } = await sendJson('/api/telegram/unlink', 'POST', {}, 15000)
  if (!ok) throw new Error(`Request failed: ${status}`)
  return true
}

export function apiTelegramBotStatus() {
  return getJson('/api/telegram/status')
}

export function apiAvailability(doctorId, date, lang = 'uz') {
  return getJson(`/api/appointments/availability${qs({ doctor_id: doctorId, date, lang })}`)
}

export async function aiSearch(query, lang = 'uz') {
  const { ok, status, data } = await sendJson(
    '/api/ai/search',
    'POST',
    { query, lang },
    30000
  )
  if (!ok || !data) throw new Error(`Request failed: ${status}`)
  return data
}

/* ------------------------------ Auth APIs ------------------------------ */

export async function apiUpdateProfile(patch) {
  const { ok, status, data } = await sendJson('/api/auth/profile', 'PUT', patch)
  if (!ok) throw new ApiError(status, data?.error ?? 'unknown', data?.message)
  return data
}

export async function apiChangePassword(current_password, new_password) {
  const { ok, status, data } = await sendJson('/api/auth/change-password', 'POST', {
    current_password,
    new_password,
  })
  if (!ok) throw new ApiError(status, data?.error ?? 'unknown', data?.message)
  return data
}

export async function apiForgotPassword(identifier) {
  const { ok, status, data } = await sendJson('/api/auth/forgot-password', 'POST', { email: identifier })
  if (!ok) throw new ApiError(status, data?.error ?? 'unknown', data?.message)
  return data
}

export async function apiResetPassword(token, new_password) {
  const { ok, status, data } = await sendJson('/api/auth/reset-password', 'POST', {
    token,
    new_password,
  })
  if (!ok) throw new ApiError(status, data?.error ?? 'unknown', data?.message)
  return data
}
