import { env } from './env.js'

/**
 * MedQueue web-search provider abstraction.
 *
 * All search keys live in .env and never reach the browser. The provider is
 * selected with SEARCH_PROVIDER (duckduckgo | tavily | brave | serpapi).
 * duckduckgo needs no API key and is the default; the others read their own
 * env var. Switching providers later only means changing one env value.
 */

const SEARCH_TIMEOUT_MS = 9000
const MAX_RESULTS = 6

export class SearchUnavailableError extends Error {}

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code)
      return Number.isFinite(n) && n > 0 ? String.fromCodePoint(Math.min(n, 0x10ffff)) : ''
    })
}

function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
}

function normalizeResults(results) {
  const seen = new Set()
  const out = []
  for (const item of results) {
    if (!item || typeof item !== 'object') continue
    const title = stripTags(String(item.title ?? '')).slice(0, 200)
    const url = String(item.url ?? item.link ?? '')
    const snippet = stripTags(String(item.snippet ?? item.content ?? item.description ?? '')).slice(0, 400)
    if (!title || !url) continue
    let parsed
    try {
      parsed = new URL(url)
    } catch {
      continue
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) continue
    if (seen.has(url)) continue
    seen.add(url)
    out.push({ title, url, snippet })
    if (out.length >= MAX_RESULTS) break
  }
  return out
}

async function fetchWithTimeout(url, options = {}, timeoutMs = SEARCH_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (err) {
    if (err.name === 'AbortError') throw new SearchUnavailableError('Search request timed out')
    throw new SearchUnavailableError(`Search request failed: ${err.message}`)
  } finally {
    clearTimeout(timer)
  }
}

/* -------------------------- Provider: DuckDuckGo ------------------------- */

async function searchDuckDuckGo(query) {
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`
  const res = await fetchWithTimeout(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; MedQueueTashkentBot/1.0)',
      'Accept': 'text/html,application/xhtml+xml',
    },
  })
  if (!res.ok) throw new SearchUnavailableError(`DuckDuckGo responded with HTTP ${res.status}`)
  const html = await res.text()

  const links = []
  const linkRegex = /<a rel="nofollow" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  let match
  while ((match = linkRegex.exec(html)) !== null) {
    let href = decodeEntities(match[1].trim())
    const title = stripTags(match[2])
    if (!href || !title) continue
    if (!/^https?:\/\//i.test(href)) {
      const uddg = /[?&]uddg=([^&]+)/i.exec(href)
      if (!uddg) continue
      try {
        href = decodeURIComponent(uddg[1])
      } catch {
        continue
      }
    }
    links.push({ title, url: href })
  }

  const snippets = []
  const snippetRegex = /<td class='result-snippet'>([\s\S]*?)<\/td>/gi
  while ((match = snippetRegex.exec(html)) !== null) {
    snippets.push(stripTags(match[1]))
  }

  const results = links.map((item, index) => ({
    ...item,
    snippet: snippets[index] ?? '',
  }))

  const normalized = normalizeResults(results)
  if (!normalized.length) {
    throw new SearchUnavailableError('DuckDuckGo returned no usable results')
  }
  return normalized
}

/* ---------------------------- Provider: Tavily --------------------------- */

async function searchTavily(query) {
  const apiKey = env('TAVILY_API_KEY')
  if (!apiKey) throw new SearchUnavailableError('TAVILY_API_KEY is not configured')
  const res = await fetchWithTimeout('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, query, max_results: MAX_RESULTS, search_depth: 'basic' }),
  })
  if (!res.ok) throw new SearchUnavailableError(`Tavily responded with HTTP ${res.status}`)
  const data = await res.json().catch(() => null)
  if (!data?.results) throw new SearchUnavailableError('Tavily returned no results')
  return normalizeResults(data.results.map((r) => ({ title: r.title, url: r.url, snippet: r.content })))
}

/* ---------------------------- Provider: Brave ---------------------------- */

async function searchBrave(query) {
  const apiKey = env('BRAVE_API_KEY')
  if (!apiKey) throw new SearchUnavailableError('BRAVE_API_KEY is not configured')
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${MAX_RESULTS}`
  const res = await fetchWithTimeout(url, {
    headers: { 'X-Subscription-Token': apiKey, 'Accept': 'application/json' },
  })
  if (!res.ok) throw new SearchUnavailableError(`Brave responded with HTTP ${res.status}`)
  const data = await res.json().catch(() => null)
  const results = data?.web?.results ?? []
  if (!results.length) throw new SearchUnavailableError('Brave returned no results')
  return normalizeResults(results.map((r) => ({ title: r.title, url: r.url, snippet: r.description })))
}

/* ---------------------------- Provider: SerpAPI --------------------------- */

async function searchSerpapi(query) {
  const apiKey = env('SERPAPI_API_KEY')
  if (!apiKey) throw new SearchUnavailableError('SERPAPI_API_KEY is not configured')
  const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${encodeURIComponent(apiKey)}`
  const res = await fetchWithTimeout(url, { headers: { 'Accept': 'application/json' } })
  if (!res.ok) throw new SearchUnavailableError(`SerpAPI responded with HTTP ${res.status}`)
  const data = await res.json().catch(() => null)
  const results = data?.organic_results ?? []
  if (!results.length) throw new SearchUnavailableError('SerpAPI returned no results')
  return normalizeResults(results.map((r) => ({ title: r.title, url: r.link, snippet: r.snippet })))
}

/* ------------------------- Provider: Wikipedia --------------------------- */
/* Free no-key fallback used when the configured provider is unreachable or
   blocked (some networks block scraper endpoints like DuckDuckGo lite). */

async function searchWikipedia(query) {
  const url =
    'https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=' +
    encodeURIComponent(query) +
    `&srlimit=${MAX_RESULTS}&format=json&origin=*`
  const res = await fetchWithTimeout(url, { headers: { 'Accept': 'application/json' } })
  if (!res.ok) throw new SearchUnavailableError(`Wikipedia responded with HTTP ${res.status}`)
  const data = await res.json().catch(() => null)
  const results = data?.query?.search ?? []
  if (!results.length) throw new SearchUnavailableError('Wikipedia returned no results')
  return normalizeResults(
    results.map((r) => ({
      title: r.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(r.title).replace(/ /g, '_'))}`,
      snippet: r.snippet,
    }))
  )
}

/**
 * Search the web through the configured provider, falling back to the
 * keyless Wikipedia API when the provider is unreachable or blocked.
 *
 * @param {string} query
 * @returns {Promise<Array<{ title: string, url: string, snippet: string }>>}
 * @throws {SearchUnavailableError} when every provider is unavailable.
 */
export async function searchWeb(query) {
  const name = (env('SEARCH_PROVIDER') || 'duckduckgo').toLowerCase()
  try {
    if (name === 'tavily') return await searchTavily(query)
    if (name === 'brave') return await searchBrave(query)
    if (name === 'serpapi') return await searchSerpapi(query)
    return await searchDuckDuckGo(query)
  } catch (err) {
    if (err instanceof SearchUnavailableError) {
      try {
        return await searchWikipedia(query)
      } catch (fallbackErr) {
        throw new SearchUnavailableError(
          `Primary (${name}) and fallback (wikipedia) both failed: ${fallbackErr.message}`
        )
      }
    }
    throw err
  }
}

/** Name of the configured provider (used in server-side debug output). */
export function searchProviderName() {
  return (env('SEARCH_PROVIDER') || 'duckduckgo').toLowerCase()
}