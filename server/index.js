import { createServer } from 'node:http'
import { env } from './env.js'
import { TelegramBot } from './telegram.js'
import {
  changeUserPassword,
  createResetToken,
  createSession,
  destroySession,
  findUserByEmail,
  findUserByPhone,
  getUserFromToken,
  normalizeEmail,
  normalizePhone,
  publicUser,
  readSessionToken,
  registerUser,
  resetUserPassword,
  sessionCookieValue,
  updateUserProfile,
  validateProfileUpdate,
  validateRegistration,
  verifyCredentials,
} from './auth.js'
import {
  AiTimeoutError,
  AiVisionUnsupportedError,
  FileTooLargeError,
  UnsupportedFileError,
  analyzeFile,
  aiSearch,
  generateMedicalSummary,
  generateReply,
  streamGenerateReply,
} from './ai.js'
import { readWebPage } from './webreader.js'
import { searchProviderName } from './search.js'
import {
  cancelQueue,
  countTotalQueues,
  createTelegramLinkCode,
  dentistRankNote,
  getAppointment,
  getAvailableSlots,
  getClinic,
  getDashboard,
  getDoctor,
  getQueueStatus,
  getQueueStateAll,
  getTelegramByUserId,
  listAppointments,
  listClinicTypes,
  listDistricts,
  listLabResults,
  listMedicalHistory,
  listNotifications,
  listSpecialties,
  patientIdForUser,
  searchClinics,
  searchDentists,
  searchDoctors,
  startQueueTicker,
  stopQueueTicker,
  takeQueue,
  unlinkTelegram,
  updateAppointmentStatus,
  verifyTelegramLink,
} from './data.js'

const PORT = Number(env('PORT', '3001'))
const BOT_TOKEN = env('TELEGRAM_BOT_TOKEN')
const WEBAPP_URL = env('TELEGRAM_WEBAPP_URL')
const ALLOWED_ORIGINS = env('FRONTEND_ORIGIN', 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_IMAGE_CHARS = 6 * 1024 * 1024

const bot = new TelegramBot({ token: BOT_TOKEN, webAppUrl: WEBAPP_URL })

/* ----------------------------- Rate limiting ----------------------------- */

const RATE_LIMIT = {
  ai: { windowMs: 60_000, max: 15 },
  data: { windowMs: 60_000, max: 180 },
}

const rateBuckets = new Map()

function rateLimited(ip, kind) {
  const { windowMs, max } = RATE_LIMIT[kind]
  const now = Date.now()
  const bucket = rateBuckets.get(ip)
  const list = bucket?.[kind] ?? []
  const fresh = list.filter((ts) => now - ts < windowMs)
  if (fresh.length >= max) {
    rateBuckets.set(ip, { ...(bucket ?? {}), [kind]: fresh })
    return true
  }
  fresh.push(now)
  rateBuckets.set(ip, { ...(bucket ?? {}), [kind]: fresh })
  return false
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim()
  return req.socket?.remoteAddress ?? 'unknown'
}

/* -------------------------------- Helpers -------------------------------- */

function corsHeaders(req) {
  const origin = req.headers.origin
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Expose-Headers': 'Set-Cookie',
    'Vary': 'Origin',
  }
}

function sendJson(res, status, body, extraHeaders = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders })
  res.end(JSON.stringify(body))
}

function sendError(res, headers, status, code) {
  sendJson(res, status, { error: code }, headers)
}

async function readJson(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** Parse and validate an optional image data URL (whitelisted mimes, capped). */
function parseImage(raw) {
  if (raw == null || raw === '') return null
  if (typeof raw !== 'string' || raw.length > MAX_IMAGE_CHARS) {
    throw { code: 'invalid_image' }
  }
  const match = /^data:([a-z0-9./+-]+);base64,/.exec(raw)
  if (!match || !IMAGE_MIMES.has(match[1])) {
    throw { code: 'invalid_image' }
  }
  return raw
}

const MAX_URL_LENGTH = 2048

function parseLang(body) {
  const lang = body?.lang ?? body?.language
  return typeof lang === 'string' && ['uz', 'ru', 'en'].includes(lang) ? lang : 'uz'
}

function parseBool(value) {
  return value === 'true' || value === '1'
}

/* ------------------------------ Auth helpers --------------------------- */

/** Resolve the authenticated user from the request cookie (or null). */
function currentUser(req) {
  return getUserFromToken(readSessionToken(req.headers.cookie))
}

function authHeaders(res, extra = {}) {
  return { ...extra, 'Set-Cookie': sessionCookieValue('', false) }
}

/** 401 payload — used by every protected endpoint. */
function sendUnauthorized(res, headers) {
  sendJson(res, 401, { error: 'not_authenticated' }, headers)
}

/** Friendly auth error mapping (codes -> client-safe messages). */
const AUTH_ERROR_MESSAGES = {
  invalid_name: 'Invalid name',
  invalid_email: 'Invalid email address',
  invalid_phone: 'Invalid phone number',
  email_taken: 'This email is already registered',
  phone_taken: 'This phone number is already registered',
  password_too_short: 'Password must be at least 8 characters',
  passwords_mismatch: 'Passwords do not match',
  invalid_dob: 'Invalid date of birth',
  invalid_gender: 'Invalid gender',
  invalid_avatar: 'Invalid avatar image',
  invalid_credentials: 'Email/phone or password is incorrect',
  wrong_password: 'Current password is incorrect',
  same_password: 'New password must be different from the current one',
  invalid_token: 'The reset link is invalid or has expired',
  missing_fields: 'Please fill in all required fields',
}

function sendAuthError(res, headers, code) {
  sendJson(
    res,
    code === 'invalid_credentials' ? 401 : 400,
    { error: code, message: AUTH_ERROR_MESSAGES[code] ?? 'Invalid request' },
    headers
  )
}

async function handleRegister(req, res, headers, body) {
  const { errors, data } = validateRegistration(body)
  if (errors) return sendAuthError(res, headers, errors[0])

  const user = await registerUser(data)
  const session = createSession(user.id, body?.remember === true)
  const cookie = sessionCookieValue(session.token, body?.remember === true)
  sendJson(
    res,
    201,
    { user: publicUser(user), redirect: typeof body?.redirect === 'string' ? body.redirect : '/cabinet' },
    { ...headers, 'Set-Cookie': cookie }
  )
}

async function handleLogin(req, res, headers, body) {
  const identifier = typeof body?.identifier === 'string' ? body.identifier.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!identifier || !password) return sendAuthError(res, headers, 'invalid_credentials')

  const user = await verifyCredentials(identifier, password)
  if (!user) return sendAuthError(res, headers, 'invalid_credentials')

  const remember = body?.remember === true
  const session = createSession(user.id, remember)
  sendJson(
    res,
    200,
    { user: publicUser(user), redirect: typeof body?.redirect === 'string' ? body.redirect : '/cabinet' },
    { ...headers, 'Set-Cookie': sessionCookieValue(session.token, remember) }
  )
}

function handleLogout(req, res, headers) {
  const token = readSessionToken(req.headers.cookie)
  destroySession(token)
  sendJson(res, 200, { ok: true }, authHeaders(res, headers))
}

function handleMe(req, res, headers) {
  const user = currentUser(req)
  if (!user) return sendUnauthorized(res, headers)
  sendJson(res, 200, { user: publicUser(user) }, headers)
}

async function handleProfileUpdate(req, res, headers, body) {
  const user = currentUser(req)
  if (!user) return sendUnauthorized(res, headers)

  const { errors, data } = validateProfileUpdate({ ...body, _userId: user.id })
  if (errors) return sendAuthError(res, headers, errors[0])

  const updated = updateUserProfile(user.id, data)
  sendJson(res, 200, { user: publicUser(updated) }, headers)
}

async function handleChangePassword(req, res, headers, body) {
  const user = currentUser(req)
  if (!user) return sendUnauthorized(res, headers)

  const current = typeof body?.current_password === 'string' ? body.current_password : ''
  const next = typeof body?.new_password === 'string' ? body.new_password : ''
  const result = await changeUserPassword(user.id, current, next)
  if (!result.ok) return sendAuthError(res, headers, result.code)
  sendJson(res, 200, { ok: true }, headers)
}

async function handleForgotPassword(req, res, headers, body) {
  const email = normalizeEmail(body?.email)
  const phone = normalizePhone(body?.phone)
  const user = email ? findUserByEmail(email) : phone ? findUserByPhone(phone) : null
  const payload = { success: true }
  if (user) {
    const token = createResetToken(user)
    // Demo environment without an email provider: the token is returned so the
    // flow can be exercised. A production build would email this link instead.
    payload.reset_token = token
  }
  sendJson(res, 200, payload, headers)
}

async function handleResetPassword(req, res, headers, body) {
  const result = await resetUserPassword(body?.token, body?.new_password)
  if (!result.ok) return sendAuthError(res, headers, result.code)
  sendJson(res, 200, { ok: true }, headers)
}

/* --------------------------- SSE queue stream ---------------------------- */

const sseClients = new Set()

function sendSse(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

function broadcastQueueState() {
  const state = { type: 'queue_update', queues: getQueueStateAll(), ts: Date.now() }
  for (const client of sseClients) {
    try {
      sendSse(client.res, state)
    } catch {
      sseClients.delete(client)
    }
  }
}

function setupSseStream(req, res, headers, patientId) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    ...headers,
  })
  res.write(': connected\n\n')

  const client = { res, patientId }
  sseClients.add(client)

  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n')
    } catch {
      clearInterval(heartbeat)
      sseClients.delete(client)
    }
  }, 15000)

  const ticker = startQueueTicker((events) => {
    broadcastQueueState()
    if (events?.length) bot.notifyEvents(events)
  })
  void ticker

  sendSse(res, { type: 'init', queues: getQueueStateAll(), ts: Date.now() })

  req.on('close', () => {
    clearInterval(heartbeat)
    sseClients.delete(client)
  })
}

/* ------------------------------- Handlers -------------------------------- */

async function handleChat(req, res, headers, body) {
  const message = typeof body?.message === 'string' ? body.message.trim() : ''
  const language = typeof body?.language === 'string' ? body.language : undefined
  const conversationId =
    typeof body?.conversation_id === 'string' && body.conversation_id.length > 0
      ? body.conversation_id
      : null
  const wantStream = body?.stream === true
  const user = currentUser(req)
  const userContext = user
    ? { patientId: `user-${user.id}`, userName: user.full_name }
    : { patientId: null, userName: null }

  let image = null
  try {
    image = parseImage(body?.image)
  } catch {
    sendError(res, headers, 400, 'invalid_image')
    return
  }

  if (!message && !image) {
    sendError(res, headers, 400, 'Message is required')
    return
  }
  if (message.length > 4000) {
    sendError(res, headers, 400, 'Message is too long')
    return
  }

  if (wantStream) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      ...headers,
    })
    res.write(': connected\n\n')
    try {
      const { conversationId: newId, dentist, sources } = await streamGenerateReply(
        { message, conversationId, language, image, ...userContext },
        (delta) => sendSse(res, { delta })
      )
      if (dentist) sendSse(res, { dentist })
      if (sources?.length) sendSse(res, { sources })
      sendSse(res, { conversation_id: newId })
      sendSse(res, { done: true })
      res.end()
    } catch (err) {
      console.error(`[chat:stream] ${err.message}`)
      let code = 'ai_unavailable'
      if (err instanceof AiTimeoutError) code = 'timeout'
      else if (err instanceof AiVisionUnsupportedError) code = 'vision_unsupported'
      sendSse(res, { error: code })
      res.end()
    }
    return
  }

  try {
    const result = await generateReply({ message, conversationId, language, image, ...userContext })
    const body = { reply: result.reply, conversation_id: result.conversationId }
    if (result.dentist) body.dentist = result.dentist
    if (result.sources?.length) body.sources = result.sources
    sendJson(res, 200, body, headers)
  } catch (err) {
    console.error(`[chat] ${err.message}`)
    if (err instanceof AiTimeoutError) {
      sendJson(res, 504, { error: 'AI provider timed out' }, headers)
    } else if (err instanceof AiVisionUnsupportedError) {
      sendJson(res, 400, { error: 'vision_unsupported' }, headers)
    } else {
      sendJson(res, 502, { error: 'AI service unavailable' }, headers)
    }
  }
}

async function handleWebRead(req, res, headers, body) {
  const url = typeof body?.url === 'string' ? body.url.trim() : ''
  if (!url) return sendError(res, headers, 400, 'url_required')
  if (url.length > MAX_URL_LENGTH) return sendError(res, headers, 400, 'url_too_long')

  try {
    const page = await readWebPage(url)
    sendJson(res, 200, { success: true, ...page }, headers)
  } catch (err) {
    console.error(`[web-read] ${err.message}`)
    sendJson(res, 422, { success: false, error: 'unreadable_page', message: err.message }, headers)
  }
}

async function handleAnalyzeImage(req, res, headers, body) {
  let image = null
  try {
    image = parseImage(body?.image)
  } catch {
    return sendError(res, headers, 400, 'invalid_image')
  }
  if (!image) return sendError(res, headers, 400, 'image_required')

  const question = typeof body?.question === 'string' ? body.question.slice(0, 2000) : ''
  const language = parseLang(body)

  try {
    const analysis = await analyzeFile({
      filename: 'image',
      mime: /^data:([a-z0-9./+-]+);base64,/.exec(image)?.[1] ?? 'image/jpeg',
      base64: image,
      question,
      language,
    })
    sendJson(res, 200, { success: true, analysis: analysis.analysis }, headers)
  } catch (err) {
    console.error(`[analyze-image] ${err.message}`)
    if (err instanceof AiTimeoutError) return sendJson(res, 504, { error: 'AI provider timed out' }, headers)
    if (err instanceof AiVisionUnsupportedError) return sendJson(res, 400, { error: 'vision_unsupported' }, headers)
    sendJson(res, 502, { error: 'AI service unavailable' }, headers)
  }
}

async function handleAnalyzeFile(req, res, headers, body) {
  const filename = typeof body?.filename === 'string' ? body.filename.slice(0, 200) : 'file'
  const mime = typeof body?.mime === 'string' ? body.mime.toLowerCase() : ''
  const base64 = typeof body?.base64 === 'string' ? body.base64 : ''
  const question = typeof body?.question === 'string' ? body.question.slice(0, 2000) : ''
  const language = parseLang(body)

  if (!base64) return sendError(res, headers, 400, 'file_required')
  if (base64.length > 12 * 1024 * 1024) return sendError(res, headers, 413, 'file_too_large')

  try {
    const result = await analyzeFile({ filename, mime, base64, question, language })
    sendJson(
      res,
      200,
      { success: true, analysis: result.analysis, extracted_text: result.text },
      headers
    )
  } catch (err) {
    console.error(`[analyze-file] ${err.message}`)
    if (err instanceof FileTooLargeError) return sendJson(res, 413, { error: 'file_too_large' }, headers)
    if (err instanceof UnsupportedFileError) return sendJson(res, 415, { error: 'unsupported_file' }, headers)
    if (err instanceof AiTimeoutError) return sendJson(res, 504, { error: 'AI provider timed out' }, headers)
    sendJson(res, 502, { error: 'AI service unavailable' }, headers)
  }
}

async function handleAiSearch(req, res, headers, body) {
  const query = typeof body?.query === 'string' ? body.query.trim() : ''
  if (!query) return sendError(res, headers, 400, 'query_required')
  const language = parseLang(body)

  try {
    const result = await aiSearch({ query, language })
    const payload = { success: true, ...result }
    sendJson(res, 200, payload, headers)
  } catch (err) {
    console.error(`[ai-search] ${err.message}`)
    if (err instanceof AiTimeoutError) return sendJson(res, 504, { error: 'AI provider timed out' }, headers)
    sendJson(res, 502, { error: 'AI service unavailable' }, headers)
  }
}

async function handleMedicalSummary(req, res, headers, body) {
  const text = typeof body?.text === 'string' ? body.text : ''
  if (!text.trim()) return sendError(res, headers, 400, 'text_required')
  const language = parseLang(body)

  try {
    const reply = await generateMedicalSummary({ text, language })
    sendJson(res, 200, { success: true, summary: reply }, headers)
  } catch (err) {
    console.error(`[medical-summary] ${err.message}`)
    if (err instanceof AiTimeoutError) return sendJson(res, 504, { error: 'AI provider timed out' }, headers)
    sendJson(res, 502, { error: 'AI service unavailable' }, headers)
  }
}

/* ------------------------------- Server --------------------------------- */

const server = createServer(async (req, res) => {
  const headers = corsHeaders(req)
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  const ip = clientIp(req)

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers)
    res.end()
    return
  }

  /* Health + telegram status */
  if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/api/health')) {
    sendJson(res, 200, { status: 'ok', uptime: Math.round(process.uptime()) }, headers)
    return
  }

  /* AI provider health/debug — server-side only, no secrets exposed. */
  if (req.method === 'GET' && url.pathname === '/api/health/ai') {
    const aiConfigured = Boolean(env('AI_API_KEY'))
    let host = ''
    try {
      host = new URL(env('AI_BASE_URL') || 'https://api.openai.com/v1').host
    } catch {
      // Malformed base URL — report as unknown host.
    }
    sendJson(
      res,
      200,
      {
        status: aiConfigured ? 'configured' : 'missing_api_key',
        model: aiConfigured ? env('AI_MODEL', 'gpt-4o-mini') : null,
        providerHost: host || null,
        searchProvider: searchProviderName(),
        telegram: {
          running: bot.running,
          username: bot.me?.username ?? null,
          tokenConfigured: Boolean(BOT_TOKEN),
        },
      },
      headers
    )
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/telegram/status') {
    sendJson(
      res,
      200,
      {
        status: bot.running ? 'running' : 'stopped',
        username: bot.me?.username ?? null,
        webAppUrl: WEBAPP_URL || null,
        webAppUrlConfigured: Boolean(WEBAPP_URL),
        tokenConfigured: Boolean(BOT_TOKEN),
      },
      headers
    )
    return
  }

  /* Legacy single-message AI endpoint (kept for compatibility) */
  if (req.method === 'POST' && url.pathname === '/api/ai') {
    if (rateLimited(ip, 'ai')) return sendJson(res, 429, { error: 'rate_limited' }, headers)
    const body = await readJson(req)
    const message = typeof body?.message === 'string' ? body.message.trim() : ''
    if (!message) return sendJson(res, 400, { error: 'Message is required' }, headers)
    if (message.length > 4000) return sendJson(res, 400, { error: 'Message is too long' }, headers)
    try {
      const result = await generateReply({ message })
      sendJson(res, 200, { reply: result.reply }, headers)
    } catch (err) {
      console.error(`[ai] ${err.message}`)
      sendJson(res, err instanceof AiTimeoutError ? 504 : 502, {
        error: err instanceof AiTimeoutError ? 'AI provider timed out' : 'AI service unavailable',
      }, headers)
    }
    return
  }

  /* Chat — the shared AI endpoint (website + Telegram) */
  if (req.method === 'POST' && (url.pathname === '/api/chat' || url.pathname === '/api/ai/chat')) {
    if (rateLimited(ip, 'ai')) return sendJson(res, 429, { error: 'rate_limited' }, headers)
    const body = await readJson(req)
    await handleChat(req, res, headers, body)
    return
  }

  if (req.method === 'GET' && (url.pathname === '/api/chat' || url.pathname === '/api/ai/chat')) {
    sendJson(res, 405, { error: 'Method Not Allowed. Use POST /api/chat' }, headers)
    return
  }

  /* AI: web page reading (SSRF-safe) */
  if (req.method === 'POST' && (url.pathname === '/api/ai/web-read' || url.pathname === '/api/ai/webpage')) {
    if (rateLimited(ip, 'ai')) return sendJson(res, 429, { error: 'rate_limited' }, headers)
    const body = await readJson(req)
    await handleWebRead(req, res, headers, body)
    return
  }

  /* AI: image analysis */
  if (req.method === 'POST' && (url.pathname === '/api/ai/analyze-image' || url.pathname === '/api/ai/vision')) {
    if (rateLimited(ip, 'ai')) return sendJson(res, 429, { error: 'rate_limited' }, headers)
    const body = await readJson(req)
    await handleAnalyzeImage(req, res, headers, body)
    return
  }

  /* AI: file analysis (PDF, text, images) */
  if (req.method === 'POST' && (url.pathname === '/api/ai/analyze-file' || url.pathname === '/api/ai/files')) {
    if (rateLimited(ip, 'ai')) return sendJson(res, 429, { error: 'rate_limited' }, headers)
    const body = await readJson(req)
    await handleAnalyzeFile(req, res, headers, body)
    return
  }

  /* AI: MedQueue search */
  if (req.method === 'POST' && url.pathname === '/api/ai/search') {
    if (rateLimited(ip, 'ai')) return sendJson(res, 429, { error: 'rate_limited' }, headers)
    const body = await readJson(req)
    await handleAiSearch(req, res, headers, body)
    return
  }

  /* AI: medical summary */
  if (req.method === 'POST' && url.pathname === '/api/ai/medical-summary') {
    if (rateLimited(ip, 'ai')) return sendJson(res, 429, { error: 'rate_limited' }, headers)
    const body = await readJson(req)
    await handleMedicalSummary(req, res, headers, body)
    return
  }

  /* ------------------------------ Auth -------------------------------- */

  if (req.method === 'POST' && url.pathname === '/api/auth/register') {
    const body = await readJson(req)
    if (!body || typeof body !== 'object') return sendAuthError(res, headers, 'missing_fields')
    await handleRegister(req, res, headers, body)
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    const body = await readJson(req)
    if (!body || typeof body !== 'object') return sendAuthError(res, headers, 'missing_fields')
    await handleLogin(req, res, headers, body)
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
    handleLogout(req, res, headers)
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/auth/me') {
    handleMe(req, res, headers)
    return
  }

  if (req.method === 'PUT' && url.pathname === '/api/auth/profile') {
    const body = await readJson(req)
    if (!body || typeof body !== 'object') return sendAuthError(res, headers, 'missing_fields')
    await handleProfileUpdate(req, res, headers, body)
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/change-password') {
    const body = await readJson(req)
    if (!body || typeof body !== 'object') return sendAuthError(res, headers, 'missing_fields')
    await handleChangePassword(req, res, headers, body)
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/forgot-password') {
    const body = await readJson(req)
    if (!body || typeof body !== 'object') return sendAuthError(res, headers, 'missing_fields')
    await handleForgotPassword(req, res, headers, body)
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/reset-password') {
    const body = await readJson(req)
    if (!body || typeof body !== 'object') return sendAuthError(res, headers, 'missing_fields')
    await handleResetPassword(req, res, headers, body)
    return
  }

  /* MedQueue reference data */
  if (req.method === 'GET' && url.pathname === '/api/specialties') {
    if (rateLimited(ip, 'data')) return sendJson(res, 429, { error: 'rate_limited' }, headers)
    sendJson(res, 200, { specialties: listSpecialties(url.searchParams.get('lang') ?? 'uz') }, headers)
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/districts') {
    if (rateLimited(ip, 'data')) return sendJson(res, 429, { error: 'rate_limited' }, headers)
    sendJson(res, 200, { districts: listDistricts(url.searchParams.get('lang') ?? 'uz') }, headers)
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/clinic-types') {
    if (rateLimited(ip, 'data')) return sendJson(res, 429, { error: 'rate_limited' }, headers)
    sendJson(res, 200, { clinicTypes: listClinicTypes(url.searchParams.get('lang') ?? 'uz') }, headers)
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/clinics') {
    if (rateLimited(ip, 'data')) return sendJson(res, 429, { error: 'rate_limited' }, headers)
    const lang = url.searchParams.get('lang') ?? 'uz'
    const district = url.searchParams.get('district') ?? ''
    const type = url.searchParams.get('type') ?? ''
    const specialty = url.searchParams.get('specialty') ?? ''
    const q = url.searchParams.get('q') ?? ''
    const sort = url.searchParams.get('sort') ?? 'default'

    let clinics = searchClinics(q, lang)
    if (district) clinics = clinics.filter((c) => c.districtId === district)
    if (type) clinics = clinics.filter((c) => c.type === type)
    if (specialty) clinics = clinics.filter((c) => c.specialties.some((s) => s.id === specialty))
    if (sort === 'queue') clinics = [...clinics].sort((a, b) => a.queueNow - b.queueNow)
    if (sort === 'name') clinics = [...clinics].sort((a, b) => a.name.localeCompare(b.name))

    sendJson(res, 200, { clinics }, headers)
    return
  }

  if (req.method === 'GET' && /^\/api\/clinics\/[^/]+$/.test(url.pathname)) {
    if (rateLimited(ip, 'data')) return sendJson(res, 429, { error: 'rate_limited' }, headers)
    const id = decodeURIComponent(url.pathname.split('/')[3])
    const clinic = getClinic(id, url.searchParams.get('lang') ?? 'uz')
    if (!clinic) return sendJson(res, 404, { error: 'not_found' }, headers)
    sendJson(res, 200, { clinic }, headers)
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/doctors') {
    if (rateLimited(ip, 'data')) return sendJson(res, 429, { error: 'rate_limited' }, headers)
    const lang = url.searchParams.get('lang') ?? 'uz'
    const specialty = url.searchParams.get('specialty') ?? ''
    const district = url.searchParams.get('district') ?? ''
    const clinicId = url.searchParams.get('clinic_id') ?? ''
    const q = url.searchParams.get('q') ?? ''
    const availableToday = url.searchParams.get('available_today') ?? ''
    const availableTomorrow = url.searchParams.get('available_tomorrow') ?? ''

    let doctors = searchDoctors(q, lang)
    if (specialty) doctors = doctors.filter((d) => d.specialtyId === specialty)
    if (district) doctors = doctors.filter((d) => d.districtId === district)
    if (clinicId) doctors = doctors.filter((d) => d.clinicId === clinicId)
    if (availableToday) doctors = doctors.filter((d) => d.availableToday === parseBool(availableToday))
    if (availableTomorrow) doctors = doctors.filter((d) => d.availableTomorrow === parseBool(availableTomorrow))

    sendJson(res, 200, { doctors }, headers)
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/doctors/dentists') {
    if (rateLimited(ip, 'data')) return sendJson(res, 429, { error: 'rate_limited' }, headers)
    const lang = url.searchParams.get('lang') ?? 'uz'
    const district = url.searchParams.get('district') ?? ''
    const ratingMin = Number(url.searchParams.get('rating_min') ?? '0')
    const availableToday = parseBool(url.searchParams.get('available_today'))
    const availableTomorrow = parseBool(url.searchParams.get('available_tomorrow'))
    const maxWait = url.searchParams.get('max_wait')
    const rank = url.searchParams.get('rank') ?? 'best'

    const result = searchDentists(
      {
        district,
        ratingMin: Number.isFinite(ratingMin) ? ratingMin : 0,
        availableToday,
        availableTomorrow,
        maxWaitMin: maxWait != null && Number.isFinite(Number(maxWait)) ? Number(maxWait) : Infinity,
        rank,
        limit: 8,
      },
      lang
    )
    sendJson(
      res,
      200,
      { dentists: result.dentists, rank: result.rank, note: dentistRankNote(lang, result.rank) },
      headers
    )
    return
  }

  if (req.method === 'GET' && /^\/api\/doctors\/[^/]+$/.test(url.pathname)) {
    if (rateLimited(ip, 'data')) return sendJson(res, 429, { error: 'rate_limited' }, headers)
    const id = decodeURIComponent(url.pathname.split('/')[3])
    const doctor = getDoctor(id, url.searchParams.get('lang') ?? 'uz')
    if (!doctor) return sendJson(res, 404, { error: 'not_found' }, headers)
    sendJson(res, 200, { doctor }, headers)
    return
  }

  /* Queue status + take queue (authenticated — identity comes from the session) */
  if (req.method === 'GET' && (url.pathname === '/api/queue' || url.pathname === '/api/queues')) {
    if (rateLimited(ip, 'data')) return sendJson(res, 429, { error: 'rate_limited' }, headers)
    const user = currentUser(req)
    if (!user) return sendUnauthorized(res, headers)
    const doctorId = url.searchParams.get('doctor_id') ?? ''
    const patientId = `user-${user.id}`
    if (!doctorId) return sendError(res, headers, 400, 'doctor_id_required')
    const status = getQueueStatus(doctorId, patientId, url.searchParams.get('lang') ?? 'uz')
    if (!status) return sendJson(res, 404, { error: 'not_found' }, headers)
    sendJson(res, 200, { queue: status }, headers)
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/queue/take') {
    if (rateLimited(ip, 'data')) return sendJson(res, 429, { error: 'rate_limited' }, headers)
    const user = currentUser(req)
    if (!user) return sendUnauthorized(res, headers)
    const body = await readJson(req)
    const doctorId = typeof body?.doctor_id === 'string' ? body.doctor_id : ''
    if (!doctorId) return sendError(res, headers, 400, 'doctor_id_required')
    const status = takeQueue(
      doctorId,
      patientIdForUser(user.id),
      parseLang(body),
      {
        date: typeof body?.date === 'string' ? body.date : 'today',
        time: typeof body?.time === 'string' ? body.time : 'now',
        source: 'website',
      }
    )
    if (!status) return sendJson(res, 404, { error: 'not_found' }, headers)
    sendJson(res, 200, { queue: status }, headers)
    return
  }

  /* Appointments REST — shared with the Telegram bot (source is analytics). */
  if (req.method === 'GET' && url.pathname === '/api/appointments/availability') {
    if (rateLimited(ip, 'data')) return sendJson(res, 429, { error: 'rate_limited' }, headers)
    const doctorId = url.searchParams.get('doctor_id') ?? ''
    if (!doctorId) return sendError(res, headers, 400, 'doctor_id_required')
    const date = url.searchParams.get('date') ?? 'today'
    const slots = getAvailableSlots(doctorId, date, url.searchParams.get('lang') ?? 'uz')
    if (!slots) return sendJson(res, 404, { error: 'not_found' }, headers)
    sendJson(res, 200, { availability: slots }, headers)
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/appointments') {
    if (rateLimited(ip, 'data')) return sendJson(res, 429, { error: 'rate_limited' }, headers)
    const user = currentUser(req)
    if (!user) return sendUnauthorized(res, headers)
    const body = await readJson(req)
    const doctorId = typeof body?.doctor_id === 'string' ? body.doctor_id : ''
    if (!doctorId) return sendError(res, headers, 400, 'doctor_id_required')
    const status = takeQueue(
      doctorId,
      patientIdForUser(user.id),
      parseLang(body),
      {
        date: typeof body?.date === 'string' && body.date ? body.date : 'today',
        time: typeof body?.time === 'string' && body.time ? body.time : 'now',
        source: 'website',
      }
    )
    if (!status) return sendJson(res, 404, { error: 'not_found' }, headers)
    sendJson(res, 201, { queue: status }, headers)
    return
  }

  if (req.method === 'PATCH' && /^\/api\/appointments\/[^/]+$/.test(url.pathname)) {
    if (rateLimited(ip, 'data')) return sendJson(res, 429, { error: 'rate_limited' }, headers)
    const user = currentUser(req)
    if (!user) return sendUnauthorized(res, headers)
    const body = await readJson(req)
    const status = typeof body?.status === 'string' ? body.status : ''
    const result = updateAppointmentStatus(decodeURIComponent(url.pathname.split('/')[3]), status)
    if (!result) return sendJson(res, 404, { error: 'not_found' }, headers)
    if (result.error) return sendJson(res, 400, { error: result.error }, headers)
    if (result.notification) bot.notifyPatient(result.appointment.patientId, result.notification)
    sendJson(res, 200, { appointment: result.appointment }, headers)
    return
  }

  if (req.method === 'DELETE' && /^\/api\/appointments\/[^/]+$/.test(url.pathname)) {
    if (rateLimited(ip, 'data')) return sendJson(res, 429, { error: 'rate_limited' }, headers)
    const user = currentUser(req)
    if (!user) return sendUnauthorized(res, headers)
    const id = decodeURIComponent(url.pathname.split('/')[3])
    const appointment = getAppointment(id)
    if (!appointment || !appointment.patientId || appointment.patientId !== patientIdForUser(user.id)) {
      return sendJson(res, 404, { error: 'not_found' }, headers)
    }
    const status = cancelQueue(appointment.doctorId ?? '', patientIdForUser(user.id))
    if (!status) return sendJson(res, 404, { error: 'not_found' }, headers)
    sendJson(res, 200, { queue: status }, headers)
    return
  }

  if (req.method === 'GET' && /^\/api\/appointments\/[^/]+$/.test(url.pathname)) {
    if (rateLimited(ip, 'data')) return sendJson(res, 429, { error: 'rate_limited' }, headers)
    const user = currentUser(req)
    if (!user) return sendUnauthorized(res, headers)
    const appointment = getAppointment(decodeURIComponent(url.pathname.split('/')[3]), url.searchParams.get('lang') ?? 'uz')
    if (!appointment || appointment.patientId !== patientIdForUser(user.id)) {
      return sendJson(res, 404, { error: 'not_found' }, headers)
    }
    sendJson(res, 200, { appointment }, headers)
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/queue/cancel') {
    if (rateLimited(ip, 'data')) return sendJson(res, 429, { error: 'rate_limited' }, headers)
    const user = currentUser(req)
    if (!user) return sendUnauthorized(res, headers)
    const body = await readJson(req)
    const doctorId = typeof body?.doctor_id === 'string' ? body.doctor_id : ''
    if (!doctorId) return sendError(res, headers, 400, 'doctor_id_required')
    const status = cancelQueue(doctorId, `user-${user.id}`, parseLang(body))
    if (!status) return sendJson(res, 404, { error: 'not_found' }, headers)
    sendJson(res, 200, { queue: status }, headers)
    return
  }

  /* Real-time queue updates (SSE) — authenticated session only */
  if (req.method === 'GET' && url.pathname === '/api/queue/stream') {
    if (rateLimited(ip, 'data')) return sendJson(res, 429, { error: 'rate_limited' }, headers)
    const user = currentUser(req)
    if (!user) return sendUnauthorized(res, headers)
    setupSseStream(req, res, headers, `user-${user.id}`)
    return
  }

  /* Patient data — identity always derived from the authenticated session */
  if (req.method === 'GET' && url.pathname === '/api/patients') {
    if (rateLimited(ip, 'data')) return sendJson(res, 429, { error: 'rate_limited' }, headers)
    const user = currentUser(req)
    if (!user) return sendUnauthorized(res, headers)
    sendJson(
      res,
      200,
      {
        patient: getDashboard(`user-${user.id}`, url.searchParams.get('lang') ?? 'uz').patient,
      },
      headers
    )
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/appointments') {
    if (rateLimited(ip, 'data')) return sendJson(res, 429, { error: 'rate_limited' }, headers)
    const user = currentUser(req)
    if (!user) return sendUnauthorized(res, headers)
    sendJson(
      res,
      200,
      { appointments: listAppointments(`user-${user.id}`, url.searchParams.get('lang') ?? 'uz') },
      headers
    )
    return
  }

  if (
    req.method === 'GET' &&
    (url.pathname === '/api/laboratory-results' ||
      url.pathname === '/api/laboratory' ||
      url.pathname === '/api/results')
  ) {
    if (rateLimited(ip, 'data')) return sendJson(res, 429, { error: 'rate_limited' }, headers)
    const user = currentUser(req)
    if (!user) return sendUnauthorized(res, headers)
    sendJson(
      res,
      200,
      { results: listLabResults(`user-${user.id}`, url.searchParams.get('lang') ?? 'uz') },
      headers
    )
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/medical-history') {
    if (rateLimited(ip, 'data')) return sendJson(res, 429, { error: 'rate_limited' }, headers)
    const user = currentUser(req)
    if (!user) return sendUnauthorized(res, headers)
    sendJson(
      res,
      200,
      { history: listMedicalHistory(`user-${user.id}`, url.searchParams.get('lang') ?? 'uz') },
      headers
    )
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/notifications') {
    if (rateLimited(ip, 'data')) return sendJson(res, 429, { error: 'rate_limited' }, headers)
    const user = currentUser(req)
    if (!user) return sendUnauthorized(res, headers)
    sendJson(
      res,
      200,
      { notifications: listNotifications(`user-${user.id}`, url.searchParams.get('lang') ?? 'uz') },
      headers
    )
    return
  }

  /* Personal dashboard — authenticated session only */
  if (req.method === 'GET' && url.pathname === '/api/dashboard') {
    if (rateLimited(ip, 'data')) return sendJson(res, 429, { error: 'rate_limited' }, headers)
    const user = currentUser(req)
    if (!user) return sendUnauthorized(res, headers)
    const stats = countTotalQueues()
    sendJson(
      res,
      200,
      { ...getDashboard(`user-${user.id}`, url.searchParams.get('lang') ?? 'uz'), cityStats: stats },
      headers
    )
    return
  }

  /* City-wide live stats (public — no personal data) */
  if (req.method === 'GET' && url.pathname === '/api/stats') {
    if (rateLimited(ip, 'data')) return sendJson(res, 429, { error: 'rate_limited' }, headers)
    const stats = countTotalQueues()
    sendJson(res, 200, { cityStats: stats }, headers)
    return
  }

  /* Telegram account linking (shared backend, website + bot) */
  if (req.method === 'POST' && url.pathname === '/api/telegram/link') {
    if (rateLimited(ip, 'data')) return sendJson(res, 429, { error: 'rate_limited' }, headers)
    const user = currentUser(req)
    if (!user) return sendUnauthorized(res, headers)
    const link = createTelegramLinkCode(user.id)
    sendJson(res, 200, { link }, headers)
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/telegram/unlink') {
    if (rateLimited(ip, 'data')) return sendJson(res, 429, { error: 'rate_limited' }, headers)
    const user = currentUser(req)
    if (!user) return sendUnauthorized(res, headers)
    unlinkTelegram(user.id)
    sendJson(res, 200, { ok: true }, headers)
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/telegram/status') {
    if (rateLimited(ip, 'data')) return sendJson(res, 429, { error: 'rate_limited' }, headers)
    const user = currentUser(req)
    if (!user) return sendUnauthorized(res, headers)
    const account = getTelegramByUserId(user.id)
    sendJson(res, 200, { account }, headers)
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/telegram/verify') {
    if (rateLimited(ip, 'data')) return sendJson(res, 429, { error: 'rate_limited' }, headers)
    const body = await readJson(req)
    const result = verifyTelegramLink(body?.code, body?.telegram_user_id, body?.telegram_username)
    if (!result.ok) return sendJson(res, 400, { error: result.code ?? 'invalid_code' }, headers)
    sendJson(res, 200, { account: result.account }, headers)
    return
  }

  /* Telegram webhook */
  if (req.method === 'POST' && url.pathname === '/api/telegram/webhook') {
    if (!BOT_TOKEN) {
      sendJson(res, 503, { error: 'TELEGRAM_BOT_TOKEN is not configured' }, headers)
      return
    }
    const body = await readJson(req)
    if (!body) {
      sendJson(res, 400, { error: 'Invalid JSON body' }, headers)
      return
    }
    try {
      await bot.handleUpdate(body)
      sendJson(res, 200, { ok: true }, headers)
    } catch (err) {
      console.error(`[telegram] webhook update error: ${err.message}`)
      sendJson(res, 500, { error: err.message }, headers)
    }
    return
  }

  sendJson(res, 404, { error: 'Not found' }, headers)
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[api] MedQueue Tashkent listening on http://0.0.0.0:${PORT}`)

  if (!BOT_TOKEN) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN not set — bot disabled.')
    console.warn('[telegram] Copy .env.example to .env and add your token from @BotFather.')
    return
  }

  bot.start().catch((err) => {
    console.error('[telegram] could not start bot:', err.message)
  })
})

function shutdown() {
  stopQueueTicker()
  bot.stop()
  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)