import { analyzeFile, generateReply } from './ai.js'
import {
  getDashboard,
  listAppointments,
  listLabResults,
  searchClinics,
  searchDoctors,
  takeQueue,
} from './data.js'

const TELEGRAM_API = 'https://api.telegram.org'
const LONG_POLL_TIMEOUT_SECONDS = 25
const POLL_RETRY_DELAY_MS = 5000
const URL_REGEX = /https?:\/\/[^\s<>"']+/i

const MAX_REPLY_CHARS = 3500

/**
 * Minimal Telegram bot client built on the native fetch API.
 * Talks to the Telegram Bot API directly — no extra dependencies.
 *
 * The bot uses the SAME shared AI service as the website (server/ai.js),
 * plus direct MedQueue data lookups for queue/clinic/lab commands.
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
        { command: 'start', description: 'MedQueue AI bilan tanishing' },
        { command: 'ai', description: 'AI savol-javob rejimi' },
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

    if (message.text === '/start') {
      await this.handleStart(message)
      return
    }
    if (message.text === '/ai') {
      await this.handleAi(message)
      return
    }
    if (message.text === '/queue') {
      await this.handleQueue(message)
      return
    }
    if (message.text === '/clinics') {
      await this.handleClinics(message)
      return
    }
    if (message.text === '/doctors') {
      await this.handleDoctors(message)
      return
    }
    if (message.text === '/laboratory' || message.text === '/lab') {
      await this.handleLab(message)
      return
    }
    if (message.text === '/myappointments' || message.text === '/appointments') {
      await this.handleAppointments(message)
      return
    }
    if (message.text === '/help') {
      await this.handleHelp(message)
      return
    }
    if (message.text.startsWith('/')) return

    await this.handleChatMessage(message)
  }

  async sendText(chatId, text, replyMarkup = null) {
    const params = { chat_id: chatId, text: text.slice(0, MAX_REPLY_CHARS) }
    if (replyMarkup) params.reply_markup = JSON.stringify(replyMarkup)
    await this.callApi('sendMessage', params)
  }

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
        '/start — bot bilan tanishing\n' +
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

  /** Handle dentist "Qabulga yozilish" buttons (same shared queue flow). */
  async handleCallbackQuery(query) {
    const chatId = query.message?.chat?.id
    const data = typeof query.data === 'string' ? query.data : ''
    if (!chatId || !data.startsWith('takeq:')) return

    const doctorId = data.slice(6)
    await this.callApi('answerCallbackQuery', {
      callback_query_id: query.id,
      text: 'Navbat olinmoqda...',
    })

    try {
      const queue = takeQueue(doctorId, 'demo-patient', 'uz')
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
    } catch (err) {
      this.log(`[telegram] take queue error: ${err.message}`)
      await this.sendText(chatId, 'Navbat olishda xatolik yuz berdi. Qayta urinib ko\'ring.')
    }
  }

  async handleQueue(message) {
    const chatId = message.chat.id
    await this.callApi('sendChatAction', { chat_id: chatId, action: 'typing' })
    const dashboard = getDashboard('demo-patient', 'uz')
    if (!dashboard.activeQueue.length) {
      await this.sendText(
        chatId,
        'Sizda hozircha faol navbat yo\'q.\n\n' +
          'Navbat olish uchun /clinics yoki /doctors buyrug\'idan foydalaning.'
      )
      return
    }
    const lines = dashboard.activeQueue.map(
      (q) =>
        `• ${q.doctor} — ${q.specialty}, ${q.clinic}\n` +
        `  Raqamingiz: ${q.yourNumber} · Hozir xizmat ko'rsatilmoqda: ${q.letter}-${q.current}\n` +
        `  Oldinda: ${q.peopleAhead} kishi · Taxminan ${q.waitMin} daqiqa`
    )
    await this.sendText(chatId, `📋 Navbat holati:\n\n${lines.join('\n\n')}`)
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
    const results = listLabResults('demo-patient', 'uz')
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
    const appointments = listAppointments('demo-patient', 'uz').filter(
      (a) => a.status === 'upcoming' || a.status === 'queue'
    )
    if (!appointments.length) {
      await this.sendText(chatId, 'Yaqin qabullar yo\'q.')
      return
    }
    const lines = appointments.map(
      (a) => `• ${a.doctor} — ${a.specialty}, ${a.clinic}\n  ${a.date === 'today' ? 'Bugun' : 'Ertaga'} ${a.time}`
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

  /** Reply to /start with a welcome message and website/Mini App buttons. */
  async handleStart(message) {
    await this.sendText(
      message.chat.id,
      'Salom! 👋 Bu MedQueue Tashkent boti — Toshkent shifoxonalari, poliklinikalari va ' +
        'xususiy klinikalarida elektron navbat va qabul tizimi.\n\n' +
        'Nima qila olasiz:\n' +
        '• /ai — MedQueue AI bilan suhbat\n' +
        '• /queue — navbat holati\n' +
        '• /clinics — klinikalar\n' +
        '• /doctors — shifokorlar\n' +
        '• /laboratory — laboratoriya natijalari\n' +
        '• /myappointments — qabullarim\n' +
        '• /help — yordam\n\n' +
        'Yoki shunchaki yozing — MedQueue AI javob beradi:\n' +
        '«Chilonzorda terapevt bormi?», «Navbatim nechanchi?», «Kardiolog top»\n\n' +
        'Rasm va PDF fayllarni ham yuborishingiz mumkin.\n\n' +
        'Til: O\'zbekcha / Русский / English',
      this.buildStartKeyboard()
    )
  }
}

export { URL_REGEX }