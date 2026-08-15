import { env } from './env.js'
import { inflateSync } from 'node:zlib'
import {
  countTotalQueues,
  dentistRankNote,
  getDashboard,
  listAppointments,
  listLabResults,
  matchDistrictIds,
  searchClinics,
  searchDentists,
  searchDoctors,
  DEMO_PATIENT,
} from './data.js'
import { readWebPage } from './webreader.js'
import { SearchUnavailableError, searchWeb } from './search.js'

const MAX_HISTORY_TURNS = 10
const AI_TIMEOUT_MS = 45000

const SYSTEM_PROMPT =
  'You are MedQueue AI, the official AI assistant of MedQueue Tashkent — the ' +
  'digital medical queue and e-health ecosystem for Tashkent hospitals, ' +
  'polyclinics and private clinics. ' +
  'You are helpful, concise and friendly.\n\n' +
  'You have THREE modes:\n' +
  '1) GENERAL MODE — answer normal questions (coding, translations, ' +
  'explanations, everyday help) like a regular AI assistant. Do not restrict ' +
  'yourself to medicine.\n' +
  '2) MEDQUEUE MODE — when a request is about clinics, doctors, specialties, ' +
  'queues, appointments or laboratory results, answer using ONLY the MedQueue ' +
  'data provided in the context block. Never invent clinics, doctors, queue ' +
  'numbers, waiting times or medical results. If the data is missing or ' +
  'unavailable, say clearly that it is not available.\n' +
  '3) INTERNET MODE — when internet search results are provided in the ' +
  'context, use them for current information (clinic opening hours, real ' +
  'doctors, medications, news, events). Clearly mark this information as ' +
  'internet information, do not mix it with MedQueue internal data, and ' +
  'reference the source links from the WEB SOURCES block at the end of your ' +
  'answer when they support what you say.\n\n' +
  'MEDICAL SAFETY:\n' +
  '- You are NOT a doctor. Never give definitive diagnoses, never prescribe ' +
  'medication, never tell users to stop prescribed medication, never claim ' +
  'certainty about serious medical conditions.\n' +
  '- You may explain medical terminology, summarize information the user ' +
  'provides, explain laboratory values in general terms and explain what a ' +
  'doctor/clinic service means.\n' +
  '- Distinguish information, possible interpretation and an actual medical ' +
  'diagnosis. For potentially serious symptoms, recommend seeking professional ' +
  'medical care.\n' +
  '- For emergencies, recommend contacting local emergency services or going ' +
  'to the nearest emergency department.\n' +
  '- Keep answers reasonably short unless detail is asked for.'

const LANGUAGE_NAMES = { uz: 'Uzbek', ru: 'Russian', en: 'English' }

/** Heuristic language detection from the user's own message. */
function detectLanguage(message) {
  const hasCyrillic = /[\u0400-\u04FF]/.test(message)
  if (hasCyrillic) return 'ru'
  const latinRatio =
    message.replace(/[^a-zA-Z]/g, '').length / Math.max(1, message.length)
  const englishWords =
    /(\bthe\b|\bfor\b|\band\b|\bwith\b|\bplease\b|\bqueue\b|\bdoctor\b|\bclinic\b|\bappointment\b|\bsearch\b|\bfind\b|\bhow\b|\bwhat\b|\bwhere\b)/i
  if (latinRatio > 0.5 && englishWords.test(message)) return 'en'
  return null
}

/**
 * Error types for the AI service. Consumers map these to clean user-facing
 * messages — raw provider details never leave the server.
 */
export class AiUnavailableError extends Error {}
export class AiTimeoutError extends Error {}
export class AiVisionUnsupportedError extends Error {}

/** In-memory conversation store. Keyed by conversation_id, bounded in size. */
const conversations = new Map()

function getHistory(conversationId) {
  if (!conversationId) return []
  let history = conversations.get(conversationId)
  if (!history) {
    history = []
    conversations.set(conversationId, history)
  }
  return history
}

/** Forget a conversation (memory only — no Redis, no database). */
export function clearConversation(conversationId) {
  if (conversationId) conversations.delete(conversationId)
}

function getApiConfig() {
  const apiKey = env('AI_API_KEY')
  if (!apiKey) {
    console.error('AI request failed: status: 0 message: AI_API_KEY is not configured')
    throw new AiUnavailableError('AI_API_KEY is not configured')
  }
  return {
    apiKey,
    baseUrl: (env('AI_BASE_URL') || 'https://api.openai.com/v1').replace(/\/+$/, ''),
    model: env('AI_MODEL', 'gpt-4o-mini'),
  }
}

function buildSystemMessages({ language, context, userName }) {
  const languageHint =
    language && LANGUAGE_NAMES[language]
      ? ` The user interface language is ${LANGUAGE_NAMES[language]} — reply in ${LANGUAGE_NAMES[language]}.`
      : ''
  const userHint = userName
    ? ` The authenticated user's name is ${userName}. When they ask about "my" appointments, queue or results, use only their own MedQueue data from the context block. Never ask for or reveal another person's data.`
    : ''
  const messages = [{ role: 'system', content: SYSTEM_PROMPT + languageHint + userHint }]
  if (context) {
    messages.push({
      role: 'system',
      content:
        'MedQueue live data (use ONLY this data for MedQueue questions; ' +
        'do not invent anything; if something is not listed here, say it is ' +
        'unavailable):\n\n' +
        context,
    })
  }
  return messages
}

const SPECIALTY_WORDS =
  /terapevt|kardiolog|pediatr|dermatolog|nevrolog|ginekolog|oftalmolog|stomatolog|xirurg|urolog|endokrinolog|\blor\b|терапевт|кардиолог|педиатр|дерматолог|невролог|гинеколог|офтальмолог|стоматолог|хирург|уролог|эндокринолог|\bлор\b|therapist|cardiologist|pediatrician|dermatologist|neurologist|gynecologist|ophthalmologist|dentist|surgeon|urologist|endocrinologist|\bent\b/i

const CLINIC_WORDS =
  /klinik|poliklinik|kasalxona|shifoxona|клиник|поликлиник|больниц|clinic|hospital/i

const DOCTOR_WORDS =
  /shifokor|vrach|doktor|врач|доктор|doctor|специалист|mutaxassis/i

const DISTRICT_WORDS =
  /chilonzor|yunusobod|yakkasaroy|sergeli|mirobod|shayxontohur|olmazor|uchtepa|yashnobod|bektemir|mirzo ulug'?bek|чиланзар|юнусабад|яккасарай|сергели|мирабад|шайхантахур|алмазар|учтепа|яшнабад|бектемир/i

const QUEUE_WORDS =
  /navbat|navbatim|navbatga|очеред|queue|raqam|nechanchi|qancha.*(oldinda|qolgan)|people ahead|how many.*ahead/i

const LAB_WORDS =
  /analiz|laborator|tahlil|natij|натиж|результат|анализ|лаборатор|lab result|result|qon tahlili|blood test/i

const APPOINTMENT_WORDS =
  /qabul|qabulga|yozil|запис|прием|приём|appointment|book|bron/i

const WAIT_WORDS =
  /kutish|kutaman|kutish vaqti|ожида|сколько.*ждать|wait|how long/i

const URL_REGEX = /https?:\/\/[^\s<>"']+/i

function hasAny(regex, text) {
  return regex.test(text)
}

function formatClinics(clinics) {
  return clinics
    .map(
      (c, i) =>
        `${i + 1}. ${c.name} (${c.typeName}, ${c.district}) — ${c.address}, tel ${c.phone}, ` +
        `ish vaqti ${c.workHours}, navbat ${c.queueNow} kishi, taxminiy kutish ${c.avgQueueMin} daqiqa. ` +
        `Mutaxassisliklar: ${c.specialties.map((s) => s.name).join(', ')}`
    )
    .join('\n')
}

function formatDoctors(doctors) {
  return doctors
    .map(
      (d, i) =>
        `${i + 1}. ${d.name} — ${d.specialty}, ${d.clinic} (${d.district}), tajriba ${d.experience} yil, ` +
        `reyting ${d.rating.toFixed(1)} (${d.reviews} sharh), tillar: ${d.languages.join(', ')}. ` +
        `Bugun: ${d.availableToday ? 'qabul bor' : 'yoq'}, Ertaga: ${d.availableTomorrow ? 'qabul bor' : 'yoq'}. ` +
        `Navbatda oldinda: ${d.queueAhead} kishi (taxminan ${d.avgWaitMin} daqiqa).`
    )
    .join('\n')
}

/* ------------------------- Dentist discovery ------------------------- */

const DENTIST_WORDS =
  /stomatolog|tish shifokor|tish doktori?|tish shifokori|dentist|dental|стоматолог|дантист|зубн/i

const SUPERLATIVE_WORDS =
  /eng zo'?r|eng yaxshi|eng yuqori|eng kuchli|\btop\b|best|highest|yuqori reyting|самый|лучш|топ/i

const TASHKENT_WORDS = /toshkent|tashkent|ташкент/i

const TODAY_WORDS = /bugun|today|сегодня/i

const TOMORROW_WORDS = /ertaga|tomorrow|завтра/i

const NOW_FREE_WORDS = /hozir(?:da|gi)?\s*bo'?sh|free\s*(?:right\s*)?now|сейчас\s+(?:свободен|свободна|есть\s+окно)/i

/**
 * search_dentists tool inputs parsed from natural language.
 * Supported: location (district), available_today, rank, rating_min,
 * max_wait_minutes. Anything missing is simply left unfiltered.
 */
function parseRatingMin(message) {
  const patterns = [
    /reyting(?:i|li|dan)?\s*(\d(?:[.,]\d)?)\s*dan\s*(?:yuqori|baland|ko'?p|past\s*emas)/i,
    /(\d(?:[.,]\d)?)\s*(?:dan|va)\s*(?:yuqori|baland)\s*reyting/i,
    /рейтинг(?:ом|а)?\s*(?:не\s*ниже|от|выше)\s*(\d(?:[.,]\d)?)/i,
    /rating\s*(?:of|above|at\s*least|>=?\s*)\s*(\d(?:[.,]\d)?)/i,
  ]
  for (const re of patterns) {
    const match = re.exec(message)
    if (match) {
      const value = Number(match[1].replace(',', '.'))
      if (Number.isFinite(value) && value > 0 && value <= 5) return value
    }
  }
  return 0
}

function parseMaxWaitMin(message) {
  const unit = /(?:daqiqa|daq\.?|min(?:ute)?s?|минут(?:а|ы|у)?)/i
  const number = /(\d{1,3})/
  const patterns = [
    new RegExp(`${number.source}\\s*${unit.source}\\s*dan\\s*(?:kam|o'?sh|ortiq)\\s*(?:kutish|navbat|wait)`, 'i'),
    new RegExp(`(?:kutish|navbat|wait(?:ing)?|ожидан(?:ие|ия)?)\\s*(?:vaqti|время)?\\s*(?:dan\\s*)?${number.source}\\s*${unit.source}`, 'i'),
  ]
  for (const re of patterns) {
    const match = re.exec(message)
    if (match) {
      const group = match[1] && /^\d+$/.test(match[1]) ? match[1] : match[2]
      const value = Number(group)
      if (Number.isFinite(value) && value > 0) return value
    }
  }
  return Infinity
}

function detectDentistRequest(message, language) {
  if (!hasAny(DENTIST_WORDS, message)) return null

  const districts = matchDistrictIds(message)
  const wantToday = TODAY_WORDS.test(message) || NOW_FREE_WORDS.test(message)
  const wantTomorrow = TOMORROW_WORDS.test(message)
  const superlative = SUPERLATIVE_WORDS.test(message)
  const mentionsTashkent = TASHKENT_WORDS.test(message)

  let rank = 'best'
  if (/reyting|rating|рейтинг/i.test(message)) rank = 'rating'
  else if (/tajriba|experience|опыт/i.test(message)) rank = 'experience'
  else if (/kutish|wait|ожидан/i.test(message)) rank = 'wait'
  else if (/bo'?sh|free|свобод|hozir/i.test(message)) rank = 'availability'

  return {
    districts,
    wantToday,
    wantTomorrow,
    rank,
    ratingMin: parseRatingMin(message),
    maxWaitMin: parseMaxWaitMin(message),
    askLocation:
      !superlative && !wantToday && !wantTomorrow && districts.length === 0 && !mentionsTashkent,
    language,
  }
}

/** Build the truthful dentist context block from real MedQueue data. */
function buildDentistContext(request) {
  const { language } = request
  if (request.askLocation) {
    return (
      "Foydalanuvchi stomatolog so'radi, lekin hudud yoki aniq talab ko'rsatmadi. " +
      'Javobingizda avval qaysi hududdan stomatolog kerakligini so\'rang va variantlarni taklif qiling: ' +
      'Yunusobod, Chilonzor, Mirzo Ulug\'bek, Shayxontohur, Sergeli yoki "Toshkent bo\'ylab". ' +
      "Qisqa va do'stona so'rang, keyin natijalarni ko'rsating."
    )
  }

  const result = searchDentists(
    {
      district: request.districts[0] ?? '',
      availableToday: request.wantToday,
      availableTomorrow: request.wantTomorrow,
      rank: request.rank,
      ratingMin: request.ratingMin,
      maxWaitMin: request.maxWaitMin,
      limit: 5,
    },
    language
  )

  if (result.dentists.length === 0) {
    return (
      "Foydalanuvchi stomatolog so'radi. MedQueue ma'lumotlarida mos natija topilmadi — " +
      'bu haqda ochiq ayting va hududni o\'zgartirib yoki filtrlarni yumshatib qayta qidirishni taklif qiling.'
    )
  }

  return (
    dentistRankNote(language, result.rank) +
    '\n\nStomatologlar (faqat shu ma\'lumotlarni ishlating):\n' +
    formatDoctors(result.dentists)
  )
}

/**
 * Structured dentist discovery for a user message. Returns null when the
 * message is not about dentists. Used by the chat handlers so the website
 * can render doctor cards and Telegram can attach queue buttons — the same
 * shared service, no duplicated logic.
 */
export function findDentistsForMessage(message, language) {
  const request = detectDentistRequest(message, language)
  if (!request) return null
  if (request.askLocation) return { askLocation: true, rank: request.rank }

  const result = searchDentists(
    {
      district: request.districts[0] ?? '',
      availableToday: request.wantToday,
      availableTomorrow: request.wantTomorrow,
      rank: request.rank,
      ratingMin: request.ratingMin,
      maxWaitMin: request.maxWaitMin,
      limit: 5,
    },
    language
  )
  return {
    dentists: result.dentists,
    rank: result.rank,
    note: dentistRankNote(language, result.rank),
    total: result.total,
  }
}

/**
 * Detect whether a message needs MedQueue live data and, if so, build a
 * truthful context block from the store. Returns null for general questions.
 */
function buildMedQueueContext(message, language, patientId = DEMO_PATIENT.id) {
  const text = message.toLowerCase()
  const dentistRequest = detectDentistRequest(message, language)

  const wantsClinic =
    !dentistRequest &&
    (hasAny(CLINIC_WORDS, text) || hasAny(DISTRICT_WORDS, text) || hasAny(SPECIALTY_WORDS, text))
  const wantsDoctor =
    !dentistRequest && (hasAny(DOCTOR_WORDS, text) || hasAny(SPECIALTY_WORDS, text))
  const wantsQueue = hasAny(QUEUE_WORDS, text) || hasAny(WAIT_WORDS, text)
  const wantsLab = hasAny(LAB_WORDS, text)
  const wantsAppointment = hasAny(APPOINTMENT_WORDS, text)

  const blocks = []

  if (dentistRequest) {
    blocks.push(buildDentistContext(dentistRequest))
  }

  if (wantsLab || wantsAppointment || wantsQueue) {
    const isUser = patientId.startsWith('user-')
    const dashboard = getDashboard(patientId, language)
    if (dashboard.activeQueue.length) {
      blocks.push(
        `${isUser ? 'Foydalanuvchi' : 'DEMO'} navbati:\n` +
          dashboard.activeQueue
            .map(
              (q) =>
                `- ${q.doctor} (${q.specialty}), ${q.clinic}: raqamingiz ${q.yourNumber}, hozir xizmat ko'rsatilmoqda: ${q.letter}-${q.current}, oldinda ${q.peopleAhead} kishi, taxminan ${q.waitMin} daqiqa.`
            )
            .join('\n')
      )
    } else {
      blocks.push(
        isUser
          ? "Foydalanuvchining faol navbati yo'q. Boshqa shifokorlar navbatlari haqida so'ralganda, umumiy ma'lumotni bering."
          : 'DEMO foydalanuvchining faol navbati yo\'q. Boshqa shifokorlar navbatlari haqida so\'ralganda, umumiy ma\'lumotni bering.'
      )
    }
    if (wantsLab) {
      const labs = listLabResults(patientId, language)
      blocks.push(
        'Laboratoriya natijalari:\n' +
          (labs.length
            ? labs
                .map(
                  (r) =>
                    `- ${r.title} (${r.status === 'ready' ? 'tayyor' : 'kutilmoqda'}): ${r.summary ?? 'natija hali tayyor emas'}`
                )
                .join('\n')
            : '- Natijalar topilmadi.')
      )
    }
    if (wantsAppointment) {
      const apps = listAppointments(patientId, language)
      blocks.push(
        'Qabullar:\n' +
          (apps.length
            ? apps
                .filter((a) => a.status === 'upcoming' || a.status === 'queue')
                .map(
                  (a) =>
                    `- ${a.doctor} (${a.specialty}), ${a.clinic} — ${a.date === 'today' ? 'bugun' : 'ertaga'} ${a.time}, holat: ${a.status}`
                )
                .join('\n') + ' (o\'tgan qabullar ham bor)'
            : '- Qabullar topilmadi.')
      )
    }
  }

  if (wantsClinic) {
    const clinics = searchClinics(message, language)
    if (clinics.length) {
      blocks.push('Klinikalar (qidiruv natijasi):\n' + formatClinics(clinics.slice(0, 8)))
    } else {
      blocks.push('Qidiruv bo\'yicha klinika topilmadi — bu haqda ochiq ayting.')
    }
  }

  if (wantsDoctor) {
    const doctors = searchDoctors(message, language)
    if (doctors.length) {
      blocks.push('Shifokorlar (qidiruv natijasi):\n' + formatDoctors(doctors.slice(0, 8)))
    } else {
      blocks.push('Qidiruv bo\'yicha shifokor topilmadi — bu haqda ochiq ayting.')
    }
  }

  if (wantsQueue && !wantsLab && !wantsAppointment) {
    const stats = countTotalQueues()
    blocks.push(
      `Umumiy holat: Toshkent bo'ylab hozir navbatda ${stats.total} kishi, bugun ${stats.servedToday} kishiga xizmat ko'rsatildi.`
    )
  }

  return blocks.length ? blocks.join('\n\n') : null
}

/** Read a user-provided URL (server-side, SSRF-safe) and append its content. */
async function buildWebContext(message) {
  const urlMatch = URL_REGEX.exec(message)
  if (!urlMatch) return null
  try {
    const page = await readWebPage(urlMatch[0])
    return (
      `Foydalanuvchi sahifani o'qishni so'radi: ${page.source_url}\n` +
      `Sahifa sarlavhasi: ${page.title || '(sarlavha yo\'q)'}\n` +
      `Sahifa matni:\n${page.content}`
    )
  } catch (err) {
    return `Sahifani o'qib bo'lmadi: ${err.message}. Buni foydalanuvchiga tushunarli tarzda ayting.`
  }
}

/* --------------------------- Web search routing -------------------------- */

const WEB_SEARCH_INTENT =
  /internetda\s+qidir|web(?:da|da)\s+qidir|qidirib\s+(?:top|ber)|googleda|google(?:da)?\s+qidir|yandexda\s+qidir|internet\s+qidiruv|поищи\s+в\s+интернете|найди\s+в\s+интернете|найти\s+в\s+интернете|поиск\s+в\s+интернете|search\s+(?:the\s+)?(?:internet|web|online)|look\s+(?:it\s+)?up\s+online|current\s+(?:info|news|price|weather|data|situation)|latest\s+(?:news|info|update)/i

const TIME_SENSITIVE_WORDS =
  /bugun\s+(?:qaysi\s+klinika|ochiq|yopiq)|hozir\s+(?:ochiq|ishlayapti|qanday)|so'?nggi\s+(?:ma'lumot|yangilik|narx)|202[4-9]|актуальн|сейчас\s+(?:работает|открыт|закрыт)|сегодня\s+(?:открыт|закрыт)|(?:open|close)(?:d)?\s+today|today\s+(?:open|closed)|recent\s+(?:updates?|news)|news\s+about|yangi\s+(?:dori|ma'lumot|klinika)/i

const DRUG_WORDS =
  /dori(?:\s+haqida|\s+darmon)?|preparat|medikament|лекарств|препарат|medication|medicine\s+(?:info|side\s+effects|dosage|interactions)/i

const GENERAL_KNOWLEDGE_FALLBACK =
  /qanday\s+ishlaydi|nima\s+(?:degani|uchun)|что\s+такое|как\s+работает|how\s+(?:does|do|to)|what\s+is/i

const EXPLICIT_SKIP_SEARCH =
  /navbatim|raqamim|my\s+queue|моя\s+очередь|men\s+navbatda/i

/**
 * Decide whether the message needs a live internet search. Returns the search
 * query when yes, otherwise null. The heuristic favors explicit search
 * intent, time-sensitive medical/news topics, drug information and cases
 * where a clinic/doctor request found nothing in the MedQueue store.
 */
function needsWebSearch(message, localDataFound) {
  const text = message.trim()
  if (text.length < 8 || EXPLICIT_SKIP_SEARCH.test(text)) return null
  if (WEB_SEARCH_INTENT.test(text)) return text
  if (TIME_SENSITIVE_WORDS.test(text) || DRUG_WORDS.test(text)) return text
  if (hasAny(DOCTOR_WORDS, text) && !localDataFound) return text
  if (hasAny(CLINIC_WORDS, text) && !localDataFound) return text
  if (GENERAL_KNOWLEDGE_FALLBACK.test(text) && /klinika|clinic|shifokor|doctor|stomatolog|dentist/i.test(text)) {
    return text
  }
  return null
}

/**
 * Run an internet search when the question requires current information.
 * Failures are logged and swallowed — the chat keeps working without search
 * results, so a broken search provider never breaks the AI.
 *
 * @returns {Promise<{ context: string|null, sources: Array<{title:string,url:string,snippet:string}> }>}
 */
async function buildWebSearchContext(message, language, localDataFound) {
  const query = needsWebSearch(message, localDataFound)
  if (!query) return { context: null, sources: [] }
  try {
    const results = await searchWeb(query)
    if (!results.length) return { context: null, sources: [] }
    const lines = results
      .map(
        (r, i) =>
          `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${(r.snippet || '').slice(0, 300)}`
      )
      .join('\n\n')
    const langHint = language && LANGUAGE_NAMES[language] ? LANGUAGE_NAMES[language] : 'Uzbek'
    return {
      context:
        `INTERNET QIDIRUV NATIJALARI (WEB SEARCH RESULTS) — bu MedQueue ichki ma'lumotlari emas, ` +
        `internetdan olingan joriy ma'lumot. Foydalanuvchi tili: ${langHint}. ` +
        `Agar bu natijalar savolga mos bo'lsa, ularni ishlating va manba sifatida URL'larni keltiring.\n\n` +
        `Search query: ${query}\n\n` +
        lines +
        `\n\nWEB SOURCES (foydalanuvchiga ko'rsatiladigan manbalar):\n` +
        results.map((r) => `- ${r.title}: ${r.url}`).join('\n'),
      sources: results,
    }
  } catch (err) {
    if (err instanceof SearchUnavailableError) {
      console.error(`[ai] web search unavailable: ${err.message}`)
    } else {
      console.error(`[ai] web search failed: ${err.message}`)
    }
    return { context: null, sources: [] }
  }
}

function pushHistory(history, role, content) {
  history.push({ role, content })
  while (history.length > MAX_HISTORY_TURNS * 2) history.shift()
}

/**
 * Shared AI entry point. Used by BOTH the website /api/chat endpoint and the
 * Telegram bot — one AI service, one conversation memory, no duplicate logic.
 *
 * @param {object} params
 * @param {string} params.message
 * @param {string|null} [params.conversationId]
 * @param {string} [params.language] - UI language code ('uz'|'ru'|'en').
 * @param {string} [params.image] - Data URL of a downscaled image, if attached.
 * @param {string|null} [params.patientId] - Authenticated patient id, if any.
 * @param {string|null} [params.userName] - Authenticated user's full name.
 * @returns {Promise<{ reply: string, conversationId: string|null, dentist: object|null, sources: Array }>}
 */
export async function generateReply({ message, conversationId, language, image, patientId = null, userName = null }) {
  const { apiKey, baseUrl, model } = getApiConfig()
  const detected = detectLanguage(message) ?? language
  const resolvedLanguage = language ?? detected ?? 'uz'

  const history = getHistory(conversationId)
  const webContext = await buildWebContext(message)
  const medContext = buildMedQueueContext(message, resolvedLanguage, patientId ?? DEMO_PATIENT.id)
  const webSearch = await buildWebSearchContext(message, resolvedLanguage, Boolean(medContext))
  const context = [webContext, medContext, webSearch.context].filter(Boolean).join('\n\n')

  const userContent = image
    ? [
        { type: 'text', text: message || 'Describe this image.' },
        { type: 'image_url', image_url: { url: image } },
      ]
    : message
  pushHistory(history, 'user', userContent)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)

  let res
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [...buildSystemMessages({ language: resolvedLanguage, context, userName }), ...history],
        temperature: 0.7,
        stream: false,
      }),
      signal: controller.signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') throw new AiTimeoutError('AI request timed out')
    console.error(`AI request failed: status: 0 message: ${err.message}`)
    throw new AiUnavailableError(err.message)
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error(`AI request failed: status: ${res.status} message: ${detail.slice(0, 200)}`)

    if (image && res.status === 400) {
      history[history.length - 1] = {
        role: 'user',
        content: message || '[image]',
      }
      throw new AiVisionUnsupportedError('The AI model does not support image analysis')
    }

    if (res.status === 401) {
      console.error('AI provider rejected the API key (401) — check AI_API_KEY in .env')
    }

    throw new AiUnavailableError(
      `AI provider responded with ${res.status} ${detail.slice(0, 200)}`
    )
  }

  const data = await res.json().catch(() => null)
  const reply = data?.choices?.[0]?.message?.content
  if (typeof reply !== 'string' || !reply.trim()) {
    throw new AiUnavailableError('AI provider returned an empty response')
  }

  pushHistory(history, 'assistant', reply)

  const dentistResult = findDentistsForMessage(message, resolvedLanguage)
  const base = { reply, conversationId, sources: webSearch.sources }
  if (dentistResult) return { ...base, dentist: dentistResult }
  return base
}

/**
 * Streaming variant of generateReply. Yields content deltas via `onDelta`
 * and stores the completed turn in conversation history.
 */
export async function streamGenerateReply({ message, conversationId, language, image, patientId = null, userName = null }, onDelta) {
  const { apiKey, baseUrl, model } = getApiConfig()
  const detected = detectLanguage(message) ?? language
  const resolvedLanguage = language ?? detected ?? 'uz'

  const history = getHistory(conversationId)
  const webContext = await buildWebContext(message)
  const medContext = buildMedQueueContext(message, resolvedLanguage, patientId ?? DEMO_PATIENT.id)
  const webSearch = await buildWebSearchContext(message, resolvedLanguage, Boolean(medContext))
  const context = [webContext, medContext, webSearch.context].filter(Boolean).join('\n\n')

  const userContent = image
    ? [
        { type: 'text', text: message || 'Describe this image.' },
        { type: 'image_url', image_url: { url: image } },
      ]
    : message
  pushHistory(history, 'user', userContent)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)

  let res
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [...buildSystemMessages({ language: resolvedLanguage, context, userName }), ...history],
        temperature: 0.7,
        stream: true,
        stream_options: { include_usage: false },
      }),
      signal: controller.signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') throw new AiTimeoutError('AI stream timed out')
    console.error(`AI stream failed: status: 0 message: ${err.message}`)
    throw new AiUnavailableError(err.message)
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error(`AI stream failed: status: ${res.status} message: ${detail.slice(0, 200)}`)
    if (image && res.status === 400) {
      history[history.length - 1] = { role: 'user', content: message || '[image]' }
      throw new AiVisionUnsupportedError('The AI model does not support image analysis')
    }
    if (res.status === 401) {
      console.error('AI provider rejected the API key (401) — check AI_API_KEY in .env')
    }
    throw new AiUnavailableError(
      `AI provider responded with ${res.status} ${detail.slice(0, 200)}`
    )
  }

  let reply = ''
  try {
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
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
        if (payload === '[DONE]') continue
        try {
          const chunk = JSON.parse(payload)
          const delta = chunk?.choices?.[0]?.delta?.content
          if (typeof delta === 'string' && delta) {
            reply += delta
            if (onDelta) onDelta(delta)
          }
        } catch {
          // Ignore malformed keep-alive chunks.
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') throw new AiTimeoutError('AI stream timed out')
    throw new AiUnavailableError(err.message)
  }

  if (!reply.trim()) {
    throw new AiUnavailableError('AI provider returned an empty stream')
  }

  pushHistory(history, 'assistant', reply)

  const dentistResult = findDentistsForMessage(message, resolvedLanguage)
  const base = { reply, conversationId, sources: webSearch.sources }
  if (dentistResult) return { ...base, dentist: dentistResult }
  return base
}

/* ------------------------------------------------------------------ */
/* File & image understanding                                          */
/* ------------------------------------------------------------------ */

const MAX_FILE_BYTES = 8 * 1024 * 1024

const TEXT_MIMES = new Set([
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
  'application/xml',
])

export class FileTooLargeError extends Error {}
export class UnsupportedFileError extends Error {}

/** Best-effort PDF text extraction (FlateDecode + ASCIIHexDecode streams). */
export function extractPdfText(buffer) {
  const text = buffer.toString('latin1')
  const parts = []
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g
  let match

  while ((match = streamRegex.exec(text)) !== null) {
    const raw = match[1]
    if (!raw) continue
    let data = null
    const hasFlate = /FlateDecode/.test(text.slice(Math.max(0, match.index - 400), match.index))
    const hasHex = /ASCIIHexDecode/.test(text.slice(Math.max(0, match.index - 400), match.index))

    if (hasHex) {
      const hex = raw.replace(/[^0-9a-fA-F]/g, '')
      if (hex.length > 1) data = Buffer.from(hex.slice(0, -1), 'hex')
    }
    if (!data && hasFlate) {
      try {
        data = inflateSync(Buffer.from(raw, 'latin1'))
      } catch {
        data = null
      }
    }
    if (!data) continue

    const content = data.toString('utf8')
    const textRuns = []
    const tjRegex = /\(((?:\\.|[^\\()])*)\)\s*Tj|\[((?:\\.|[^\\()\]]|\[[^\]]*\])*)\]\s*TJ/g
    let run
    while ((run = tjRegex.exec(content)) !== null) {
      if (run[1] != null) {
        textRuns.push(unescapePdfString(run[1]))
      } else if (run[2] != null) {
        const itemRegex = /\(((?:\\.|[^\\()])*)\)/g
        let item
        while ((item = itemRegex.exec(run[2])) !== null) {
          textRuns.push(unescapePdfString(item[1]))
        }
      }
    }
    if (textRuns.length) parts.push(textRuns.join(''))
  }

  return parts.join(' ').replace(/[ \t]+/g, ' ').trim().slice(0, 20000)
}

function unescapePdfString(str) {
  return str
    .replace(/\\([nrtbf()\\])/g, (_, ch) => {
      const map = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' }
      return map[ch] ?? ch
    })
    .replace(/\\(\d{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\\r?\n/g, '')
}

function decodeBase64(base64) {
  const clean = String(base64).replace(/^data:[^;]+;base64,/, '')
  return Buffer.from(clean, 'base64')
}

/** Extract readable text from an uploaded file (PDF, text, csv, json…). */
export function extractFileText({ mime, base64, buffer }) {
  const data = buffer ?? (base64 ? decodeBase64(base64) : null)
  if (!data) throw new UnsupportedFileError('Empty file')
  if (data.length > MAX_FILE_BYTES) throw new FileTooLargeError('File is too large')

  if (mime === 'application/pdf' || (mime === '' && data.slice(0, 4).toString('latin1') === '%PDF')) {
    const text = extractPdfText(data)
    if (!text.trim()) {
      throw new UnsupportedFileError('Could not extract text from this PDF (scanned PDFs need an OCR model)')
    }
    return text
  }
  if (TEXT_MIMES.has(mime) || mime.startsWith('text/')) {
    return data.toString('utf8').slice(0, 20000)
  }
  if (mime.startsWith('image/')) {
    return `data:${mime};base64,${data.toString('base64')}`
  }
  throw new UnsupportedFileError('Unsupported file format')
}

async function runAnalysis({ systemExtra, userParts, language }) {
  const { apiKey, baseUrl, model } = getApiConfig()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
  let res
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              SYSTEM_PROMPT +
              '\n\n' +
              (systemExtra ?? '') +
              (language && LANGUAGE_NAMES[language]
                ? ` Reply in ${LANGUAGE_NAMES[language]}.`
                : ''),
          },
          { role: 'user', content: userParts },
        ],
        temperature: 0.4,
        stream: false,
      }),
      signal: controller.signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') throw new AiTimeoutError('AI request timed out')
    console.error(`AI analysis failed: status: 0 message: ${err.message}`)
    throw new AiUnavailableError(err.message)
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error(`AI analysis failed: status: ${res.status} message: ${detail.slice(0, 200)}`)
    if (res.status === 400 && userParts.some((p) => p.type === 'image_url')) {
      throw new AiVisionUnsupportedError('The AI model does not support image analysis')
    }
    throw new AiUnavailableError(`AI provider responded with ${res.status} ${detail.slice(0, 200)}`)
  }

  const data = await res.json().catch(() => null)
  const reply = data?.choices?.[0]?.message?.content
  if (typeof reply !== 'string' || !reply.trim()) {
    throw new AiUnavailableError('AI provider returned an empty response')
  }
  return reply
}

/**
 * Analyze an uploaded file (image / PDF / text) with the shared AI service.
 *
 * @param {object} params
 * @param {string} params.filename
 * @param {string} params.mime
 * @param {string} [params.base64]
 * @param {string} [params.question] - Optional user question about the file.
 * @param {string} [params.language]
 * @returns {Promise<{ text: string, analysis: string }>}
 */
export async function analyzeFile({ filename: _filename, mime, base64, question, language }) {
  const detected = detectLanguage(question ?? '') ?? language ?? 'uz'
  const extracted = extractFileText({ mime, base64 })

  if (extracted.startsWith('data:image/')) {
    const analysis = await runAnalysis({
      systemExtra:
        'The user uploaded an image (possibly a laboratory result, medical ' +
        'document or screenshot). Describe what you see and answer their ' +
        'question. Explain laboratory values in general terms only.',
      userParts: [
        {
          type: 'text',
          text: question || 'What is in this image? Explain it briefly.',
        },
        { type: 'image_url', image_url: { url: extracted } },
      ],
      language: detected,
    })
    return { text: null, analysis }
  }

  const analysis = await runAnalysis({
    systemExtra:
      'The user uploaded a text file (PDF, document, laboratory result, ' +
      'medical document). Summarize it and answer their question using ONLY ' +
      'the file content. If the file looks like a medical document, add a ' +
      'note that this is not a diagnosis and recommend professional medical ' +
      'advice where relevant.',
    userParts: [
      {
        type: 'text',
        text:
          (question ? `Question: ${question}\n\n` : 'Summarize this document.\n\n') +
          `File content:\n${extracted}`,
      },
    ],
    language: detected,
  })
  return { text: extracted, analysis }
}

/**
 * AI search: combine keyword search over the MedQueue store with a natural
 * language answer. When the store has no matches the query is routed to the
 * live web search provider, so "real-world" lookups still return something.
 */
export async function aiSearch({ query, language }) {
  const detected = language ?? detectLanguage(query) ?? 'uz'
  const clinics = searchClinics(query, detected).slice(0, 6)
  const doctors = searchDoctors(query, detected).slice(0, 8)
  const raw = { clinics, doctors }

  let webResults = []
  if (!clinics.length && !doctors.length) {
    try {
      webResults = await searchWeb(query)
    } catch (err) {
      console.error(`[ai-search] web search unavailable: ${err.message}`)
    }
  }
  raw.web = webResults

  if (!clinics.length && !doctors.length && !webResults.length) {
    return { raw, reply: null, sources: [] }
  }

  const webBlock = webResults.length
    ? `\n\nInternetdan topilgan natijalar (MedQueue ichki ma'lumotlari emas):\n` +
      webResults
        .map(
          (r, i) =>
            `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${(r.snippet || '').slice(0, 300)}`
        )
        .join('\n') +
      `\n\nWEB SOURCES:\n` +
      webResults.map((r) => `- ${r.title}: ${r.url}`).join('\n')
    : ''

  const reply = await runAnalysis({
    systemExtra:
      'You are the MedQueue Tashkent search assistant. Present the search ' +
      'results to the user in a short, structured, friendly answer. Use ONLY ' +
      'the provided data. Do not invent doctors or clinics. Internet results ' +
      'must be labeled as internet information with source links.',
    userParts: [
      {
        type: 'text',
        text:
          `Query: ${query}\n\nClinics found:\n${formatClinics(clinics)}\n\n` +
          `Doctors found:\n${formatDoctors(doctors)}` +
          webBlock,
      },
    ],
    language: detected,
  })

  return { raw, reply, sources: webResults }
}

/**
 * Generate a safe medical summary from provided text (document, lab values).
 * Framed as information, never as a diagnosis.
 */
export async function generateMedicalSummary({ text, language }) {
  const detected = language ?? detectLanguage(text) ?? 'uz'
  const reply = await runAnalysis({
    systemExtra:
      'Summarize the provided medical information in simple, understandable ' +
      'language. Explain values in general terms. Clearly state that this is ' +
      'a summary of provided information, NOT a diagnosis, and recommend ' +
      'consulting a doctor when anything is unclear or concerning.',
    userParts: [
      {
        type: 'text',
        text: `Medical information to summarize:\n${String(text).slice(0, 20000)}`,
      },
    ],
    language: detected,
  })
  return reply
}