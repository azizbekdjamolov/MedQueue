import { analyzeFile, generateReply } from './ai.js'
import {
  cancelQueue,
  getAvailableSlots,
  getDashboard,
  getTelegramChatIdByUserId,
  getUserIdByTelegram,
  listAppointments,
  listLabResults,
  listMedicalHistory,
  listNotifications,
  patientIdForUser,
  searchClinics,
  searchDentists,
  searchDoctors,
  takeQueue,
  verifyTelegramLink,
} from './data.js'
import { findUserById } from './auth.js'

const TELEGRAM_API = 'https://api.telegram.org'
const LONG_POLL_TIMEOUT_SECONDS = 25
const POLL_RETRY_DELAY_MS = 5000
const URL_REGEX = /https?:\/\/[^\s<>"']+/i

const MAX_REPLY_CHARS = 3500

const MENU = {
  clinics: '🏥 Klinika topish',
  doctors: '👨‍⚕️ Shifokor topish',
  dentists: '🦷 Stomatolog topish',
  book: '📅 Navbat olish',
  myQueue: '🎫 Mening navbatim',
  cancel: '❌ Navbatni bekor qilish',
  profile: '👤 Profil',
  history: '📜 Tibbiy tarix',
  lab: '🧪 Laboratoriya natijalari',
  notifications: '🔔 Bildirishnomalar',
  ai: '🤖 AI yordamchi',
}

const MENU_VALUES = new Set(Object.values(MENU))
const LINK_CODE_RE = /^MQ-\d{6}$/i

/**
 * Minimal Telegram bot client built on the native fetch API.
 * Talks to the Telegram Bot API directly — no extra dependencies.
 *
 * The bot is a CLIENT of the SAME shared backend as the website
 * (server/data.js): one database, one business logic. Personal data is only
 * accessible after the user links their Telegram account to a website
 * account with a one-time code (MQ-XXXXXX).
 */
export class TelegramBot {
  /**
   * @param {object} config
   * @param {string} config.token Bot token from TELEGRAM_BOT_TOKEN (env only).
   * @param {string} config.webAppUrl Public website URL used for buttons.
   * @param {(message: string) => void} [config.logger]
   */
  constructor({ token, webAppUrl, logger }) {
    this.token = token
    this.webAppUrl = webAppUrl
    this.log = logger ?? console.log
    this.offset = 0
    this.running = false
    this.pollTimer = null
    this.me = null
    this.bookingFlow = new Map() // chatId -> { step, doctorId, date, slots }
  }

  get apiBase() {
    return `${TELEGRAM_API}/bot${this.token}`
  }

  /**
   * Call a Telegram Bot API method. The bot token never leaves the server.
   */
  async callApi(method, params = {}, timeoutMs = 12000) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(`${this.apiBase}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: controller.signal,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        throw new Error(`Telegram API ${method} failed: ${res.status} ${JSON.stringify(data)}`)
      }
      return data.result
    } finally {
      clearTimeout(timer)
    }
  }

  /** Connect the bot (verifies the token via getMe) and start long polling. */
  async start() {
    this.me = await this.callApi('getMe')
    this.running = true
    this.log(`[telegram] bot @${this.me.username} connected, polling for updates`)
    this.log(
      `[telegram] webapp url: ${this.webAppUrl ? this.webAppUrl : '(not configured — buttons hidden)'}`
    )
    await this.callApi('setMyCommands', {
      commands: [
        { command: 'start', description: 'MedQueue AI bilan tanishing / ulash' },
        { command: 'ai', description: 'AI savol-javob rejimi' },
        { command: 'menu', description: 'Asosiy menyu' },
        { command: 'queue', description: 'Navbat holatini ko\'rish' },
        { command: 'clinics', description: 'Klinikalar ro\'yxati' },
        { command: 'doctors', description: 'Shifokorlar ro\'yxati' },
        { command: 'laboratory', description: 'Laboratoriya natijalari' },
        { command: 'myappointments', description: 'Qabullarim' },
        { command: 'help', description: 'Yordam' },
      ],
    }).catch((err) => this.log(`[telegram] setMyCommands failed: ${err.message}`))
    this.schedulePoll()
  }

  stop() {
    this.running = false
    if (this.pollTimer) clearTimeout(this.pollTimer)
  }

  schedulePoll(delayMs = 0) {
    if (!this.running) return
    this.pollTimer = setTimeout(() => {
      let failed = false
      this.pollOnce()
        .catch((err) => {
          failed = true
          this.log(`[telegram] poll error: ${err.message}`)
        })
        .finally(() => this.schedulePoll(failed ? POLL_RETRY_DELAY_MS : 0))
    }, delayMs)
  }

  async pollOnce() {
    const updates = await this.callApi(
      'getUpdates',
      {
        timeout: LONG_POLL_TIMEOUT_SECONDS,
        offset: this.offset,
        allowed_updates: ['message', 'callback_query'],
      },
      40000
    )
    for (const update of updates) {
      this.offset = update.update_id + 1
      await this.handleUpdate(update).catch((err) =>
        this.log(`[telegram] update ${update.update_id} error: ${err.message}`)
      )
    }
  }

  /**
   * Process a single Telegram update. Also called by the webhook endpoint,
   * so the bot works with both long polling and webhooks.
   */
  async handleUpdate(update) {
    if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query)
      return
    }
    const message = update.message
    if (!message) return

    if (message.photo && message.photo.length > 0) {
      await this.handlePhoto(message)
      return
    }
    if (message.document) {
      await this.handleDocument(message)
      return
    }
    if (typeof message.text !== 'string') return
    const text = message.text.trim()

    if (LINK_CODE_RE.test(text)) {
      await this.handleLinkCode(message, text.toUpperCase())
      return
    }

    if (this.bookingFlow.has(message.chat.id)) {
      await this.handleBookingStep(message)
      return
    }

    if (text === '/start') {
      await this.handleStart(message)
      return
    }
    if (text === '/menu') {
      await this.showMenu(message.chat.id)
      return
    }
    if (text === '/ai') {
      await this.handleAi(message)
      return
    }
    if (text === '/queue') {
      await this.handleQueue(message)
      return
    }
    if (text === '/clinics' || text === MENU.clinics) {
      await this.handleClinics(message)
      return
    }
    if (text === '/doctors' || text === MENU.doctors) {
      await this.handleDoctors(message)
      return
    }
    if (text === '/laboratory' || text === '/lab' || text === MENU.lab) {
      await this.handleLab(message)
      return
    }
    if (text === '/myappointments' || text === '/appointments') {
      await this.handleAppointments(message)
      return
    }
    if (text === '/help') {
      await this.handleHelp(message)
      return
    }
    if (text.startsWith('/')) return

    if (MENU_VALUES.has(text)) {
      await this.handleMenuAction(message, text)
      return
    }

    await this.handleChatMessage(message)
  }

  async sendText(chatId, text, replyMarkup = null) {
    const params = { chat_id: chatId, text: text.slice(0, MAX_REPLY_CHARS) }
    if (replyMarkup) params.reply_markup = JSON.stringify(replyMarkup)
    await this.callApi('sendMessage', params)
  }

  buildMenuKeyboard() {
    return {
      keyboard: [
        [MENU.clinics, MENU.doctors, MENU.dentists],
        [MENU.book, MENU.myQueue, MENU.cancel],
        [MENU.profile, MENU.history, MENU.lab],
        [MENU.notifications, MENU.ai],
      ],
      resize_keyboard: true,
    }
  }

  async showMenu(chatId, intro = null) {
    if (intro) {
      await this.sendText(chatId, intro, this.buildMenuKeyboard())
    } else {
      await this.sendText(chatId, '📋 Asosiy menyu:', this.buildMenuKeyboard())
    }
  }

  /* ------------------------- Account linking ------------------------- */

  /** Linked website user id for this Telegram chat, or null. */
  linkedUserId(chatId) {
    return getUserIdByTelegram(chatId)
  }

  /** Ask to link before touching any personal data. */
  async requireLink(chatId) {
    await this.sendText(
      chatId,
      '🔐 Avval Telegram hisobingizni MedQueue sayti bilan ulang.\n\n' +
        '1️⃣ Saytda "Profil" → "Telegram bilan ulash" bo\'limini oching\n' +
        '2️⃣ Ko\'rsatilgan kodni (masalan MQ-123456) shu yerga yozib yuboring'
    )
    return null
  }

  async handleLinkCode(message, code) {
    const chatId = message.chat.id
    const username = message.from?.username ?? ''
    const result = verifyTelegramLink(code, chatId, username)
    if (!result.ok) {
      await this.sendText(
        chatId,
        '❌ Kod noto\'g\'ri yoki muddati o\'tgan. Saytdan yangi kod oling va qayta urinib ko\'ring.'
      )
      return
    }
    await this.showMenu(
      chatId,
      `✅ Hisobingiz ulandi!\n\n👤 @${username || result.account.telegramUserId}\n🔗 MedQueue akkaunt bilan bog\'landi.\n\nEndi navbat olish, qabullarni ko\'rish va bildirishnomalarni olish mumkin.`
    )
  }

  /* ------------------------- Menu actions ---------------------------- */

  async handleMenuAction(message, text) {
    switch (text) {
      case MENU.dentists:
        await this.handleDentists(message)
        break
      case MENU.book:
        await this.startBooking(message)
        break
      case MENU.myQueue:
        await this.handleQueue(message)
        break
      case MENU.cancel:
        await this.handleCancelFlow(message)
        break
      case MENU.profile:
        await this.handleProfile(message)
        break
      case MENU.history:
        await this.handleHistory(message)
        break
      case MENU.notifications:
        await this.handleNotifications(message)
        break
      case MENU.ai:
        await this.handleAi(message)
        break
      default:
        await this.handleChatMessage(message)
    }
  }

  async handleDentists(message) {
    const chatId = message.chat.id
    await this.callApi('sendChatAction', { chat_id: chatId, action: 'typing' })
    const result = searchDentists({ limit: 5 }, 'uz')
    if (!result.dentists.length) {
      await this.sendText(chatId, 'Stomatologlar topilmadi.')
      return
    }
    const lines = result.dentists.map(
      (d, i) =>
        `${i + 1}. ${d.name} — ⭐ ${d.rating.toFixed(1)} (${d.reviews} sharh)\n` +
        `   ${d.clinic} (${d.district}) · ${d.experience} yil tajriba\n` +
        `   Bugun: ${d.availableToday ? 'qabul bor' : 'yo\'q'} · Navbat: ${d.queueAhead} kishi (~${d.avgWaitMin} daqiqa)`
    )
    const keyboard = {
      inline_keyboard: result.dentists.slice(0, 5).map((d) => [
        { text: `🦷 ${d.name} — Qabulga yozilish`, callback_data: `takeq:${d.id}` },
      ]),
    }
    await this.sendText(chatId, '🦷 Eng yaxshi stomatologlar (MedQueue ma\'lumotlari):\n\n' + lines.join('\n\n'), keyboard)
  }

  /* ------------------------ Booking flow (bot) ------------------------ */

  async startBooking(message) {
    const chatId = message.chat.id
    if (!this.linkedUserId(chatId)) {
      await this.requireLink(chatId)
      return
    }
    const doctors = searchDoctors('', 'uz').slice(0, 8)
    this.bookingFlow.set(chatId, { step: 'doctor' })
    const keyboard = {
      inline_keyboard: doctors.map((d) => [
        { text: `${d.name} — ${d.specialty}`, callback_data: `bookd:${d.id}` },
      ]),
    }
    await this.sendText(
      chatId,
      '📅 Navbat olish — shifokorni tanlang:\n\n' + doctors.map((d) => `${d.name} · ${d.specialty} · ${d.clinic}`).join('\n'),
      keyboard
    )
  }

  async handleBookingStep(message) {
    const chatId = message.chat.id
    const flow = this.bookingFlow.get(chatId)
    if (flow.step === 'doctor') {
      // Free text: interpret as a doctor search
      const doctors = searchDoctors(message.text, 'uz').slice(0, 8)
      if (!doctors.length) {
        await this.sendText(chatId, 'Bunday shifokor topilmadi. Qayta urinib ko\'ring yoki "❌" deb menyuga qayting.')
        return
      }
      const keyboard = {
        inline_keyboard: doctors.map((d) => [
          { text: `${d.name} — ${d.specialty}`, callback_data: `bookd:${d.id}` },
        ]),
      }
      await this.sendText(chatId, 'Shifokor topildi — tanlang:', keyboard)
    }
  }

  async handleBookingDoctor(chatId, doctorId) {
    const doctor = searchDoctors('', 'uz').find((d) => d.id === doctorId)
    if (!doctor) {
      this.bookingFlow.delete(chatId)
      await this.sendText(chatId, 'Shifokor topilmadi.')
      return
    }
    this.bookingFlow.set(chatId, { step: 'date', doctorId })
    const keyboard = {
      inline_keyboard: [
        [
          { text: '📅 Bugun', callback_data: 'bookdate:today' },
          { text: '📅 Ertaga', callback_data: 'bookdate:tomorrow' },
        ],
      ],
    }
    await this.sendText(chatId, `👨‍⚕️ ${doctor.name} — ${doctor.clinic}\n\nQaysi kun?`, keyboard)
  }

  async handleBookingDate(chatId, date) {
    const flow = this.bookingFlow.get(chatId)
    if (!flow) return
    const availability = getAvailableSlots(flow.doctorId, date, 'uz')
    if (!availability) {
      this.bookingFlow.delete(chatId)
      await this.sendText(chatId, 'Xatolik yuz berdi. Qayta urinib ko\'ring.')
      return
    }
    if (!availability.slots.length) {
      await this.sendText(chatId, 'Kechirasiz, bu kunga bo\'sh vaqt qolmadi. Boshqa kunni tanlang.')
      return
    }
    flow.step = 'time'
    flow.date = date
    flow.slots = availability.slots
    this.bookingFlow.set(chatId, flow)
    const rows = []
    for (let i = 0; i < availability.slots.length; i += 3) {
      rows.push(
        availability.slots.slice(i, i + 3).map((s) => ({
          text: `🕐 ${s}`,
          callback_data: `booktime:${s}`,
        }))
      )
    }
    await this.sendText(chatId, `📅 ${date === 'today' ? 'Bugun' : 'Ertaga'} — bo\'sh vaqtlar:\n\n${availability.clinic}`, {
      inline_keyboard: rows,
    })
  }

  async handleBookingTime(chatId, time) {
    const flow = this.bookingFlow.get(chatId)
    if (!flow) return
    const doctor = searchDoctors('', 'uz').find((d) => d.id === flow.doctorId)
    const userId = this.linkedUserId(chatId)
    this.bookingFlow.delete(chatId)
    if (!userId) {
      await this.requireLink(chatId)
      return
    }
    const queue = takeQueue(flow.doctorId, patientIdForUser(userId), 'uz', {
      date: flow.date,
      time,
      source: 'telegram',
    })
    if (!queue) {
      await this.sendText(chatId, 'Navbat olishda xatolik yuz berdi.')
      return
    }
    await this.sendText(
      chatId,
      `✅ Navbat olindi!\n\n` +
        `🏥 ${queue.clinic}\n` +
        `👨‍⚕️ ${queue.doctor} (${queue.specialty})\n` +
        `📅 ${flow.date === 'today' ? 'Bugun' : 'Ertaga'}\n` +
        `🕝 ${time}\n` +
        `🔢 Navbat: ${queue.queueNumber ?? queue.yourNumber}\n` +
        `✅ Holat: Tasdiqlangan\n\n` +
        `🎫 Sizning navbatingiz\n👥 Oldinda: ${queue.peopleAhead} kishi · Taxminan ${queue.waitMin} daqiqa`
    )
  }

  /* --------------------------- Notifications -------------------------- */

  /**
   * Push a localized notification to the user's linked Telegram chat.
   * Used for appointment status changes and queue lifecycle events from
   * the shared backend ticker.
   */
  async notifyPatient(patientId, body) {
    if (!body) return
    const userId = String(patientId ?? '').startsWith('user-')
      ? String(patientId).slice(5)
      : null
    if (!userId) return
    const chatId = getTelegramChatIdByUserId(userId)
    if (!chatId || !this.me) return
    try {
      await this.sendText(chatId, `🔔 ${body.uz}`)
    } catch (err) {
      this.log(`[telegram] notification error: ${err.message}`)
    }
  }

  /** Push queue lifecycle events (approaching/called/completed) to users. */
  async notifyEvents(events) {
    if (!Array.isArray(events)) return
    for (const event of events) {
      await this.notifyPatient(event.patientId, event.body)
    }
  }

  /* --------------------------- Command flow --------------------------- */

  /**
   * Answer a regular text message with the shared AI service — the same one
   * the website uses (server/ai.js). Context is kept per Telegram chat via a
   * stable conversation_id, so the AI remembers earlier turns. URLs are read
   * server-side by the same web-reader the website uses.
   */
  async handleChatMessage(message) {
    const conversationId = `telegram:${message.chat.id}`
    await this.callApi('sendChatAction', {
      chat_id: message.chat.id,
      action: 'typing',
    })
    try {
      const { reply, dentist, sources } = await generateReply({
        message: message.text,
        conversationId,
      })
      let finalReply = reply
      if (sources?.length) {
        finalReply +=
          '\n\n📎 Manbalar / Sources:\n' +
          sources.slice(0, 4).map((s) => `• ${s.title}\n  ${s.url}`).join('\n')
      }
      const keyboard = dentist?.dentists?.length
        ? {
            inline_keyboard: dentist.dentists.slice(0, 4).map((d) => [
              {
                text: `🦷 ${d.name} — Qabulga yozilish`,
                callback_data: `takeq:${d.id}`,
              },
            ]),
          }
        : null
      await this.sendText(message.chat.id, finalReply, keyboard)
    } catch (err) {
      this.log(`[telegram] AI reply error: ${err.message}`)
      await this.sendText(
        message.chat.id,
        'Kechirasiz, AI xizmati hozircha mavjud emas. Birozdan so\'ng qayta urinib ko\'ring.\n\n' +
          'Sorry, the AI service is temporarily unavailable. Please try again in a moment.'
      )
    }
  }

  /**
   * Download a Telegram file by file_id, then analyze it with the SAME
   * vision/file service the website uses (server/ai.js). Friendly fallback
   * when the configured model has no vision support.
   */
  async downloadFile(fileId) {
    const file = await this.callApi('getFile', { file_id: fileId })
    const fileUrl = `${TELEGRAM_API}/file/bot${this.token}/${file.file_path}`
    const res = await fetch(fileUrl)
    if (!res.ok) throw new Error(`Telegram file download failed: ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    return buffer
  }

  async handlePhoto(message) {
    const chatId = message.chat.id
    const caption = message.caption ?? ''
    await this.callApi('sendChatAction', { chat_id: chatId, action: 'typing' })
    try {
      const photo = message.photo[message.photo.length - 1]
      const buffer = await this.downloadFile(photo.file_id)
      const result = await analyzeFile({
        filename: 'photo.jpg',
        mime: 'image/jpeg',
        base64: buffer.toString('base64'),
        question: caption,
        language: 'uz',
      })
      const disclaimer =
        '\n\n⚠️ Bu AI tahlili diagnostika emas. Aniq xulosa uchun shifokor bilan maslahatlashing.'
      await this.sendText(chatId, result.analysis + disclaimer)
    } catch (err) {
      this.log(`[telegram] photo analysis error: ${err.message}`)
      await this.sendText(
        chatId,
        'Rasmni tahlil qilib bo\'lmadi. Joriy AI modeli rasm tahlilini qo\'llab-quvvatlamasligi mumkin — matnli xabarlarni yuborishda davom eting.'
      )
    }
  }

  async handleDocument(message) {
    const chatId = message.chat.id
    const document = message.document
    const caption = message.caption ?? ''
    if (document.file_size > 8 * 1024 * 1024) {
      await this.sendText(chatId, 'Fayl hajmi 8 MB dan oshmasligi kerak.')
      return
    }
    await this.callApi('sendChatAction', { chat_id: chatId, action: 'typing' })
    try {
      const buffer = await this.downloadFile(document.file_id)
      const result = await analyzeFile({
        filename: document.file_name ?? 'document',
        mime: document.mime_type ?? '',
        base64: buffer.toString('base64'),
        question: caption,
        language: 'uz',
      })
      await this.sendText(chatId, result.analysis)
    } catch (err) {
      this.log(`[telegram] document analysis error: ${err.message}`)
      await this.sendText(
        chatId,
        'Faylni tahlil qilib bo\'lmadi. PDF, matn yoki rasm formatlarini yuborib ko\'ring.'
      )
    }
  }

  /** Explain the AI chat mode — every regular message already goes to AI. */
  async handleAi(message) {
    await this.sendText(
      message.chat.id,
      '🧠 MedQueue AI rejimi.\n\n' +
        'Shunchaki xabar yozing — AI javob beradi. Masalan:\n' +
        '• «Chilonzorda terapevt bormi?»\n' +
        '• «Yaqin stomatolog top»\n' +
        '• «Python\'da for loop tushuntir»\n' +
        '• «Bu rasmni tahlil qil» (rasm yuboring)\n\n' +
        'Suhbat xotirada saqlanadi — keyingi savollar kontekstni eslaydi.'
    )
  }

  /** Full command reference. */
  async handleHelp(message) {
    await this.sendText(
      message.chat.id,
      '📖 MedQueue Tashkent bot — yordam.\n\n' +
        '/start — ulash / boshlash\n' +
        '/menu — asosiy menyu\n' +
        '/ai — AI savol-javob rejimi\n' +
        '/clinics — klinikalar ro\'yxati\n' +
        '/doctors — shifokorlar ro\'yxati\n' +
        '/queue — navbat holati\n' +
        '/laboratory — laboratoriya natijalari\n' +
        '/myappointments — qabullarim\n' +
        '/help — bu ro\'yxat\n\n' +
        'Rasm yoki PDF yuboring — AI tahlil qiladi.'
    )
  }

  /** Handle inline buttons (take queue / cancel / booking flow). */
  async handleCallbackQuery(query) {
    const chatId = query.message?.chat?.id
    const data = typeof query.data === 'string' ? query.data : ''
    if (!chatId) return

    if (data.startsWith('takeq:')) {
      const doctorId = data.slice(6)
      await this.callApi('answerCallbackQuery', {
        callback_query_id: query.id,
        text: 'Navbat olinmoqda...',
      })
      const userId = this.linkedUserId(chatId)
      if (!userId) {
        await this.requireLink(chatId)
        return
      }
      const queue = takeQueue(doctorId, patientIdForUser(userId), 'uz', {
        date: 'today',
        time: 'now',
        source: 'telegram',
      })
      if (!queue) {
        await this.sendText(chatId, 'Shifokor topilmadi. /doctors bilan qayta urinib ko\'ring.')
        return
      }
      await this.sendText(
        chatId,
        `✅ Navbat olindi!\n\n` +
          `Shifokor: ${queue.doctor} (${queue.specialty})\n` +
          `Klinika: ${queue.clinic}\n` +
          `Sizning raqamingiz: ${queue.yourNumber}\n` +
          `Hozir xizmat ko'rsatilmoqda: ${queue.letter}-${queue.current}\n` +
          `Oldinda: ${queue.peopleAhead} kishi · Taxminan ${queue.waitMin} daqiqa`
      )
      return
    }

    if (data.startsWith('cancelq:')) {
      const doctorId = data.slice(8)
      await this.callApi('answerCallbackQuery', {
        callback_query_id: query.id,
        text: 'Bekor qilinmoqda...',
      })
      const userId = this.linkedUserId(chatId)
      if (!userId) {
        await this.requireLink(chatId)
        return
      }
      const status = cancelQueue(doctorId, patientIdForUser(userId), 'uz')
      if (!status) {
        await this.sendText(chatId, 'Navbat topilmadi.')
        return
      }
      await this.sendText(chatId, `❌ Navbat bekor qilindi.\n\n${status.doctor} — ${status.clinic}`)
      return
    }

    if (data.startsWith('bookd:')) {
      await this.callApi('answerCallbackQuery', { callback_query_id: query.id })
      await this.handleBookingDoctor(chatId, data.slice(6))
      return
    }
    if (data.startsWith('bookdate:')) {
      await this.callApi('answerCallbackQuery', { callback_query_id: query.id })
      await this.handleBookingDate(chatId, data.slice(9))
      return
    }
    if (data.startsWith('booktime:')) {
      await this.callApi('answerCallbackQuery', { callback_query_id: query.id })
      await this.handleBookingTime(chatId, data.slice(9))
      return
    }
  }

  async handleQueue(message) {
    const chatId = message.chat.id
    const userId = this.linkedUserId(chatId)
    if (!userId) {
      await this.requireLink(message)
      return
    }
    await this.callApi('sendChatAction', { chat_id: chatId, action: 'typing' })
    const dashboard = getDashboard(patientIdForUser(userId), 'uz')
    if (!dashboard.activeQueue.length) {
      await this.sendText(
        chatId,
        'Sizda hozircha faol navbat yo\'q.\n\n' +
          'Navbat olish uchun 📅 "Navbat olish" menyusi yoki /clinics, /doctors buyruqlaridan foydalaning.'
      )
      return
    }
    const lines = dashboard.activeQueue.map(
      (q) =>
        `🎫 Sizning navbatingiz\n\n` +
        `🏥 ${q.clinic}\n` +
        `👨‍⚕️ ${q.doctor} — ${q.specialty}\n` +
        `🔢 Navbat: ${q.yourNumber}\n` +
        `⏳ Hozir xizmat ko'rsatilmoqda: ${q.letter}-${q.current}\n` +
        `👥 Oldinda: ${q.peopleAhead} kishi · Taxminan ${q.waitMin} daqiqa`
    )
    const keyboard = {
      inline_keyboard: dashboard.activeQueue.map((q) => [
        { text: `❌ ${q.doctor} — bekor qilish`, callback_data: `cancelq:${q.doctorId}` },
      ]),
    }
    await this.sendText(chatId, lines.join('\n\n'), keyboard)
  }

  async handleCancelFlow(message) {
    const chatId = message.chat.id
    const userId = this.linkedUserId(chatId)
    if (!userId) {
      await this.requireLink(message)
      return
    }
    const dashboard = getDashboard(patientIdForUser(userId), 'uz')
    if (!dashboard.activeQueue.length) {
      await this.sendText(chatId, 'Bekor qiladigan faol navbatingiz yo\'q.')
      return
    }
    const keyboard = {
      inline_keyboard: dashboard.activeQueue.map((q) => [
        { text: `❌ ${q.doctor} — ${q.clinic}`, callback_data: `cancelq:${q.doctorId}` },
      ]),
    }
    await this.sendText(chatId, 'Bekor qilmoqchi bo\'lgan navbatingizni tanlang:', keyboard)
  }

  async handleProfile(message) {
    const chatId = message.chat.id
    const userId = this.linkedUserId(chatId)
    if (!userId) {
      await this.requireLink(message)
      return
    }
    const user = findUserById(userId)
    if (!user) {
      await this.sendText(chatId, 'MedQueue profili topilmadi. Qayta ulanish uchun /start bosing.')
      return
    }
    await this.sendText(
      chatId,
      `👤 Profil\n\n` +
        `Ism: ${user.full_name}\n` +
        `Email: ${user.email}\n` +
        `Telefon: ${user.phone}\n` +
        `Telegram: @${message.from?.username ?? '—'}\n` +
        `🔗 MedQueue bilan ulangan ✅`
    )
  }

  async handleHistory(message) {
    const chatId = message.chat.id
    const userId = this.linkedUserId(chatId)
    if (!userId) {
      await this.requireLink(message)
      return
    }
    const history = listMedicalHistory(patientIdForUser(userId), 'uz')
    if (!history.length) {
      await this.sendText(chatId, 'Tibbiy tarix yozuvlari yo\'q.')
      return
    }
    const lines = history.map(
      (h) => `• ${h.title} (${h.date})\n  ${h.summary || ''}`.trimEnd()
    )
    await this.sendText(chatId, `📜 Tibbiy tarix:\n\n${lines.join('\n\n')}`)
  }

  async handleNotifications(message) {
    const chatId = message.chat.id
    const userId = this.linkedUserId(chatId)
    if (!userId) {
      await this.requireLink(message)
      return
    }
    const notifications = listNotifications(patientIdForUser(userId), 'uz')
    if (!notifications.length) {
      await this.sendText(chatId, 'Bildirishnomalar yo\'q.')
      return
    }
    const lines = notifications.slice(0, 10).map((n) => `🔔 ${n.title}\n  ${n.body}`)
    await this.sendText(chatId, `Bildirishnomalar:\n\n${lines.join('\n\n')}`)
  }

  async handleClinics(message) {
    const chatId = message.chat.id
    const clinics = searchClinics('', 'uz').slice(0, 10)
    const lines = clinics.map(
      (c) => `• ${c.name} (${c.typeName}, ${c.district})\n  Navbat: ${c.queueNow} kishi`
    )
    await this.sendText(
      chatId,
      '🏥 Toshkent klinikalari (qisqacha):\n\n' + lines.join('\n') +
        '\n\nBatafsil qidiruv uchun MedQueue AI\'ga yozing, masalan: "Chilonzorda terapevt bormi?"'
    )
  }

  async handleDoctors(message) {
    const chatId = message.chat.id
    const doctors = searchDoctors('', 'uz').slice(0, 10)
    const lines = doctors.map(
      (d) => `• ${d.name} — ${d.specialty}, ${d.clinic}\n  Oldinda: ${d.queueAhead} kishi · ${d.avgWaitMin} daqiqa`
    )
    await this.sendText(
      chatId,
      '👨‍⚕️ Shifokorlar (qisqacha):\n\n' + lines.join('\n') +
        '\n\nNavbat olish uchun AI\'ga yozing, masalan: "Yunusobodda kardiologga navbat olaman"'
    )
  }

  async handleLab(message) {
    const chatId = message.chat.id
    const userId = this.linkedUserId(chatId)
    if (!userId) {
      await this.requireLink(message)
      return
    }
    const results = listLabResults(patientIdForUser(userId), 'uz')
    if (!results.length) {
      await this.sendText(chatId, 'Laboratoriya natijalari topilmadi.')
      return
    }
    const lines = results.map(
      (r) =>
        `• ${r.title} — ${r.status === 'ready' ? '✅ tayyor' : '⏳ kutilmoqda'}` +
        (r.summary ? `\n  ${r.summary}` : '')
    )
    await this.sendText(chatId, `🧪 Laboratoriya natijalari:\n\n${lines.join('\n\n')}`)
  }

  async handleAppointments(message) {
    const chatId = message.chat.id
    const userId = this.linkedUserId(chatId)
    if (!userId) {
      await this.requireLink(message)
      return
    }
    const appointments = listAppointments(patientIdForUser(userId), 'uz').filter(
      (a) => a.status === 'upcoming' || a.status === 'queue'
    )
    if (!appointments.length) {
      await this.sendText(chatId, 'Yaqin qabullar yo\'q.')
      return
    }
    const lines = appointments.map(
      (a) => `• ${a.doctor} — ${a.specialty}, ${a.clinic}\n  ${a.date === 'today' ? 'Bugun' : 'Ertaga'} ${a.time}${a.queueNumber ? ` · ${a.queueNumber}` : ''}`
    )
    await this.sendText(chatId, `📅 Qabullarim:\n\n${lines.join('\n\n')}`)
  }

  /**
   * Build the inline keyboard for /start.
   * - Website button: always shown when TELEGRAM_WEBAPP_URL is set.
   * - Mini App button: only for https URLs (Telegram requires HTTPS for
   *   web_app buttons), so the bot never sends an invalid button.
   */
  buildStartKeyboard() {
    const buttons = []
    if (this.webAppUrl) {
      buttons.push({ text: 'Open MedQueue Website', url: this.webAppUrl })
    }
    if (this.webAppUrl?.startsWith('https://')) {
      buttons.push({ text: 'Open in Mini App', web_app: { url: this.webAppUrl } })
    }
    return { inline_keyboard: buttons.length ? [buttons] : [] }
  }

  /** Reply to /start: link flow for new users, menu for linked ones. */
  async handleStart(message) {
    const chatId = message.chat.id
    if (this.linkedUserId(chatId)) {
      await this.showMenu(
        chatId,
        'Salom! 👋 MedQueue hisobingiz ulangan.\n\nNima qila olasiz:\n' +
          '🦷 Stomatolog topish\n' +
          '📅 Navbat olish\n' +
          '🎫 Mening navbatim\n' +
          '❌ Navbatni bekor qilish\n' +
          '🧪 Laboratoriya natijalari\n' +
          '🤖 AI yordamchi\n\n' +
          'Yoki shunchaki yozing — MedQueue AI javob beradi.'
      )
      return
    }
    await this.sendText(
      chatId,
      'Salom! 👋 Bu MedQueue Tashkent boti — Toshkent shifoxonalari, poliklinikalari va ' +
        'xususiy klinikalarida elektron navbat va qabul tizimi.\n\n' +
        '🔐 Sizning ma\'lumotlaringiz MedQueue sayti bilan bir xil bazadan olinadi. ' +
        'Ulanish uchun:\n\n' +
        '1️⃣ Saytda ro\'yxatdan o\'ting va Profilga kiring\n' +
        '2️⃣ "Telegram bilan ulash" tugmasini bosing\n' +
        '3️⃣ Ko\'rsatilgan kodni (masalan MQ-123456) shu yerga yuboring\n\n' +
        'Yoki menyudan bevosita foydalaning:',
      { ...this.buildMenuKeyboard(), ...this.buildStartKeyboard() }
    )
  }
}

export { URL_REGEX }
