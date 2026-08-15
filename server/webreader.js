import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])
const MAX_PAGE_BYTES = 512 * 1024
const REQUEST_TIMEOUT_MS = 10000
const MAX_REDIRECTS = 3

const BLOCKED_IP_RANGES = [
  { name: 'loopback', test: (a) => a[0] === 127 },
  { name: 'private-10', test: (a) => a[0] === 10 },
  { name: 'private-172', test: (a) => a[0] === 172 && a[1] >= 16 && a[1] <= 31 },
  { name: 'private-192', test: (a) => a[0] === 192 && a[1] === 168 },
  { name: 'link-local-169', test: (a) => a[0] === 169 && a[1] === 254 },
  { name: 'reserved-0', test: (a) => a[0] === 0 },
  { name: 'reserved-100', test: (a) => a[0] === 100 && a[1] >= 64 && a[1] <= 127 },
  { name: 'broadcast', test: (a) => a[0] === 255 },
]

function ipIsBlocked(ip) {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true
  return BLOCKED_IP_RANGES.some((range) => range.test(parts))
}

/** Block IPv6 loopback / local ranges. */
function ipv6IsBlocked(ip) {
  const lower = ip.toLowerCase()
  if (lower === '::1' || lower.startsWith('::ffff:127.')) return true
  if (lower.startsWith('::ffff:10.') || lower.startsWith('::ffff:192.168.')) return true
  if (lower.startsWith('fd') || lower.startsWith('fc')) return true
  return false
}

/**
 * Resolve a hostname and verify the address is a public, routable IP.
 * Blocks SSRF targets: localhost, private ranges, link-local, reserved space.
 */
async function assertPublicHost(hostname) {
  const addresses = await lookup(hostname, { all: true })
  if (!addresses.length) throw new Error('Host could not be resolved')
  for (const entry of addresses) {
    const blocked =
      entry.family === 4 ? ipIsBlocked(entry.address) : ipv6IsBlocked(entry.address)
    if (blocked) {
      throw new Error('Address is not public (SSRF blocked)')
    }
  }
}

function validateUrl(raw) {
  let url
  try {
    url = new URL(raw)
  } catch {
    throw new Error('Invalid URL')
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new Error('Only HTTP and HTTPS URLs are allowed')
  }
  if (url.username || url.password) {
    throw new Error('Credentials in URL are not allowed')
  }
  if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost')) {
    throw new Error('Local hosts are not allowed')
  }
  const ip = isIP(url.hostname)
  if (ip === 4 && ipIsBlocked(url.hostname)) throw new Error('Private address blocked')
  if (ip === 6 && ipv6IsBlocked(url.hostname)) throw new Error('Private address blocked')
  return url
}

/**
 * Fetch a page with SSRF protection: public-IP-only DNS resolution,
 * redirect cap, size cap, timeout, text-only content extraction.
 *
 * @returns {Promise<{ title: string, content: string, source_url: string, size: number }>}
 */
export async function readWebPage(rawUrl) {
  let url = validateUrl(rawUrl)
  let redirects = 0

  while (true) {
    await assertPublicHost(url.hostname)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    let res
    try {
      res = await fetch(url, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'MedQueueTashkentBot/1.0 (+https://medqueue.uz; research assistant)',
          'Accept': 'text/html,text/plain;q=0.9,*/*;q=0.5',
        },
      })
    } catch (err) {
      throw err.name === 'AbortError'
        ? new Error('Request timed out')
        : new Error('Network error while fetching the page')
    } finally {
      clearTimeout(timer)
    }

    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      if (redirects >= MAX_REDIRECTS) throw new Error('Too many redirects')
      redirects += 1
      const next = new URL(res.headers.get('location'), url)
      if (!ALLOWED_PROTOCOLS.has(next.protocol)) throw new Error('Redirect to non-HTTP URL blocked')
      url = next
      continue
    }

    if (!res.ok) throw new Error(`Page responded with HTTP ${res.status}`)

    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html') && !contentType.includes('text/plain') && !contentType.includes('text/markdown')) {
      throw new Error('The page is not readable text (HTML/plain text expected)')
    }

    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.length > MAX_PAGE_BYTES) {
      throw new Error('Page is too large to read')
    }
    const html = buffer.toString('utf8')
    return { ...extractContent(html), source_url: url.href, size: buffer.length }
  }
}

/** Strip scripts/styles/nav noise and pull readable text from a page. */
export function extractContent(html) {
  let title = ''
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  if (titleMatch) title = decodeEntities(titleMatch[1]).replace(/\s+/g, ' ').trim().slice(0, 200)

  const raw = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(nav|header|footer|aside)[^>]*>[\s\S]*?<\/\1>/gi, ' ')

  const blocks = []
  const blockRegex = /<(h[1-6]|p|li|td|th|figcaption|blockquote|dt|dd)[^>]*>([\s\S]*?)<\/\1>/gi
  let match
  while ((match = blockRegex.exec(raw)) !== null) {
    const text = decodeEntities(match[2])
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (text.length > 1) blocks.push(text)
  }

  const seen = new Set()
  const unique = blocks.filter((block) => {
    if (seen.has(block)) return false
    seen.add(block)
    return true
  })

  let content = unique.slice(0, 250).join('\n')
  if (content.length > 24000) {
    content = content.slice(0, 24000).trimEnd() + '\n…'
  }
  return { title, content }
}

const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (full, entity) => {
    if (entity.startsWith('#')) {
      const code = entity.startsWith('#x') || entity.startsWith('#X')
        ? parseInt(entity.slice(2), 16)
        : parseInt(entity.slice(1), 10)
      if (!Number.isNaN(code)) {
        try {
          return String.fromCodePoint(code)
        } catch {
          return full
        }
      }
      return full
    }
    return ENTITIES[entity] ?? full
  })
}