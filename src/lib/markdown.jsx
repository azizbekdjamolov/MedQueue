import { Fragment } from 'react'

/**
 * Tiny dependency-free Markdown renderer for AI messages.
 * Supports: headings, bold, italic, strikethrough, inline code, fenced code
 * blocks (with language label), links, ordered/unordered lists, blockquotes,
 * horizontal rules and paragraphs. Renders React elements — no HTML is ever
 * injected, so messages cannot smuggle markup into the page.
 */

const CODE_BLOCK = /```([\w-]*)\n?([\s\S]*?)```|~~~([\w-]*)\n?([\s\S]*?)~~~/g

function safeUrl(raw) {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  try {
    const url = new URL(trimmed)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

let inlineKey = 0

/** Inline formatting: bold / italic / strike / code / links. */
function renderInline(text) {
  const nodes = []
  const tokens = []
  const regex =
    /(\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|\*([\s\S]+?)\*|_([\s\S]+?)_|~~([\s\S]+?)~~|`([^`\n]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/g
  let last = 0
  let match
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) tokens.push({ type: 'text', text: text.slice(last, match.index) })
    const [, , bold, boldAlt, ital, italAlt, strike, code, linkText, linkUrl] = match
    if (bold != null || boldAlt != null) {
      tokens.push({ type: 'strong', text: bold ?? boldAlt })
    } else if (ital != null || italAlt != null) {
      tokens.push({ type: 'em', text: ital ?? italAlt })
    } else if (strike != null) {
      tokens.push({ type: 'del', text: strike })
    } else if (code != null) {
      tokens.push({ type: 'code', text: code })
    } else if (linkText != null && linkUrl != null) {
      tokens.push({ type: 'link', text: linkText, url: linkUrl })
    }
    last = regex.lastIndex
  }
  if (last < text.length) tokens.push({ type: 'text', text: text.slice(last) })

  for (const token of tokens) {
    const key = `i${inlineKey++}`
    switch (token.type) {
      case 'strong':
        nodes.push(<strong key={key}>{renderInline(token.text)}</strong>)
        break
      case 'em':
        nodes.push(<em key={key}>{renderInline(token.text)}</em>)
        break
      case 'del':
        nodes.push(<del key={key}>{renderInline(token.text)}</del>)
        break
      case 'code':
        nodes.push(<code key={key}>{token.text}</code>)
        break
      case 'link': {
        const url = safeUrl(token.url)
        nodes.push(
          url ? (
            <a key={key} href={url} target="_blank" rel="noopener noreferrer">
              {token.text}
            </a>
          ) : (
            <span key={key}>{token.text}</span>
          )
        )
        break
      }
      default:
        nodes.push(<Fragment key={key}>{token.text}</Fragment>)
    }
  }
  return nodes
}

/** Split a block's content into lines and render each with inline markup. */
function blockKey() {
  return `b${inlineKey++}`
}

/**
 * Render markdown text as React elements.
 *
 * @param {string} text
 * @returns {Array<React.ReactNode>}
 */
export function renderMarkdown(text) {
  const blocks = []
  const source = String(text ?? '')
  let lastIndex = 0
  let match

  const pushTextBlock = (raw, isCode, lang) => {
    const trimmed = raw.replace(/\n{3,}/g, '\n\n').trim()
    if (!trimmed) return
    if (isCode) {
      blocks.push({ kind: 'code', lang: lang ?? '', content: trimmed })
      return
    }
    for (const paragraph of trimmed.split(/\n{2,}/)) {
      const lines = paragraph.split('\n')
      if (lines.every((l) => /^\s*([-*+]|\d+[.)])\s+/.test(l))) {
        blocks.push({ kind: 'list', ordered: /^\s*\d+[.)]\s+/.test(lines[0]), items: lines })
      } else if (lines.every((l) => /^\s*&gt;\s?/.test(l))) {
        blocks.push({ kind: 'quote', lines })
      } else if (/^\s*(#{1,6})\s+/.test(paragraph)) {
        const level = /^\s*(#{1,6})\s+/.exec(paragraph)[1].length
        blocks.push({ kind: 'heading', level, text: paragraph.replace(/^\s*#{1,6}\s+/, '').trim() })
      } else if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(paragraph)) {
        blocks.push({ kind: 'hr' })
      } else {
        blocks.push({ kind: 'p', lines })
      }
    }
  }

  CODE_BLOCK.lastIndex = 0
  while ((match = CODE_BLOCK.exec(source)) !== null) {
    if (match.index > lastIndex) pushTextBlock(source.slice(lastIndex, match.index), false)
    const lang = match[1] || match[3] || ''
    const content = match[2] ?? match[4] ?? ''
    pushTextBlock(content, true, lang.trim())
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < source.length) pushTextBlock(source.slice(lastIndex), false)

  return blocks.map((block) => {
    switch (block.kind) {
      case 'code':
        return (
          <pre key={blockKey()} className="mq-code-block">
            {block.lang && <span className="mq-code-lang">{block.lang}</span>}
            <code>{block.content}</code>
          </pre>
        )
      case 'heading': {
        const Tag = `h${Math.min(6, Math.max(1, block.level))}`
        return <Tag key={blockKey()}>{renderInline(block.text)}</Tag>
      }
      case 'hr':
        return <hr key={blockKey()} />
      case 'quote':
        return (
          <blockquote key={blockKey()}>
            {block.lines.map((line, i) => (
              <p key={i}>{renderInline(line.replace(/^\s*&gt;\s?/, ''))}</p>
            ))}
          </blockquote>
        )
      case 'list': {
        const Tag = block.ordered ? 'ol' : 'ul'
        return (
          <Tag key={blockKey()}>
            {block.items.map((line, i) => {
              const itemText = line.replace(/^\s*([-*+]|\d+[.)])\s+/, '')
              return <li key={i}>{renderInline(itemText)}</li>
            })}
          </Tag>
        )
      }
      default:
        return (
          <p key={blockKey()}>
            {block.lines.map((line, i) => (
              <Fragment key={i}>
                {renderInline(line)}
                {i < block.lines.length - 1 ? '\n' : null}
              </Fragment>
            ))}
          </p>
        )
    }
  })
}