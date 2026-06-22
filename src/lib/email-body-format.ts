import React from 'react'

const MD_LINK_RE = /\[([^\]\n]+)\]\(([^)\s]+)\)/g
const MD_BOLD_RE = /\*\*([^*\n]+)\*\*/g

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

type InlineMatch = { index: number; kind: 'link' | 'bold'; match: RegExpExecArray }

function nextInlineMatch(text: string): InlineMatch | null {
  MD_LINK_RE.lastIndex = 0
  MD_BOLD_RE.lastIndex = 0
  const linkMatch = MD_LINK_RE.exec(text)
  const boldMatch = MD_BOLD_RE.exec(text)
  let best: InlineMatch | null = null

  if (linkMatch?.index !== undefined) {
    best = { index: linkMatch.index, kind: 'link', match: linkMatch }
  }
  if (boldMatch?.index !== undefined) {
    if (!best || boldMatch.index < best.index) {
      best = { index: boldMatch.index, kind: 'bold', match: boldMatch }
    }
  }
  return best
}

/** Split plain template text into React nodes: links, bold, plain text. */
export function renderInlineMarkdown(text: string, keyPrefix = 'md'): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    const found = nextInlineMatch(remaining)
    if (!found) {
      parts.push(remaining)
      break
    }
    if (found.index > 0) parts.push(remaining.slice(0, found.index))

    if (found.kind === 'link') {
      const label = found.match[1]
      const url = found.match[2]
      parts.push(
        React.createElement(
          'a',
          {
            key: `${keyPrefix}-${key++}`,
            href: url,
            target: '_blank',
            rel: 'noopener noreferrer',
            style: { color: '#2563eb', textDecoration: 'underline' },
          },
          ...renderInlineMarkdown(label, `${keyPrefix}-l${key}`),
        ),
      )
    } else {
      parts.push(
        React.createElement(
          'strong',
          { key: `${keyPrefix}-${key++}` },
          ...renderInlineMarkdown(found.match[1], `${keyPrefix}-b${key}`),
        ),
      )
    }
    remaining = remaining.slice(found.index + found.match[0].length)
  }
  return parts
}

/** @deprecated use renderInlineMarkdown */
export function renderMarkdownLinks(text: string): React.ReactNode[] {
  return renderInlineMarkdown(text)
}

/** Render placeholders then inline markdown for template preview. */
export function renderEmailBodyPreview(
  text: string,
  dummyValues: Record<string, { value: string; color: string }>,
): React.ReactNode[] {
  const withPlaceholders: React.ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    let earliest = -1
    let earliestTag = ''
    for (const tag of Object.keys(dummyValues)) {
      const idx = remaining.indexOf(tag)
      if (idx !== -1 && (earliest === -1 || idx < earliest)) {
        earliest = idx
        earliestTag = tag
      }
    }

    if (earliest === -1) {
      withPlaceholders.push(...renderInlineMarkdown(remaining, `md-${key++}`))
      break
    }

    if (earliest > 0) {
      withPlaceholders.push(...renderInlineMarkdown(remaining.slice(0, earliest), `md-${key++}`))
    }

    const d = dummyValues[earliestTag]
    withPlaceholders.push(
      React.createElement(
        'span',
        {
          key: key++,
          style: {
            background: d.color + '18',
            color: d.color,
            fontWeight: 700,
            borderRadius: 4,
            padding: '0 3px',
            fontSize: '0.95em',
          },
        },
        d.value,
      ),
    )
    remaining = remaining.slice(earliest + earliestTag.length)
  }

  return withPlaceholders
}

export function insertMarkdownLink(
  el: HTMLTextAreaElement | null,
  current: string,
  label: string,
  url: string,
  setValue: (next: string) => void,
) {
  const link = `[${label}](${url})`
  if (!el) {
    setValue(current + link)
    return
  }
  const start = el.selectionStart ?? current.length
  const end = el.selectionEnd ?? current.length
  const next = current.slice(0, start) + link + current.slice(end)
  setValue(next)
  requestAnimationFrame(() => {
    el.selectionStart = start + link.length
    el.selectionEnd = start + link.length
    el.focus()
  })
}

export function insertMarkdownBold(
  el: HTMLTextAreaElement | null,
  current: string,
  setValue: (next: string) => void,
) {
  const start = el?.selectionStart ?? current.length
  const end = el?.selectionEnd ?? current.length
  const selected = current.slice(start, end)
  const wrap = selected ? `**${selected}**` : '****'
  const next = current.slice(0, start) + wrap + current.slice(end)
  setValue(next)
  if (!el) return
  requestAnimationFrame(() => {
    const cursor = selected ? start + wrap.length : start + 2
    el.selectionStart = cursor
    el.selectionEnd = cursor
    el.focus()
  })
}

export function getSelectedText(el: HTMLTextAreaElement | null, current: string): string {
  if (!el) return ''
  const start = el.selectionStart ?? 0
  const end = el.selectionEnd ?? 0
  if (start === end) return ''
  return current.slice(start, end)
}

/** Convert inline markdown (links, bold) in a plain segment → HTML. */
export function inlineMarkdownToHtml(text: string): string {
  const parts: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    const found = nextInlineMatch(remaining)
    if (!found) {
      parts.push(escapeHtml(remaining).replace(/\n/g, '<br>'))
      break
    }
    if (found.index > 0) {
      parts.push(escapeHtml(remaining.slice(0, found.index)).replace(/\n/g, '<br>'))
    }
    if (found.kind === 'link') {
      parts.push(
        `<a href="${escapeHtml(found.match[2])}" style="color:#2563eb;text-decoration:underline;">`
        + `${inlineMarkdownToHtml(found.match[1])}</a>`,
      )
    } else {
      parts.push(`<b>${inlineMarkdownToHtml(found.match[1])}</b>`)
    }
    remaining = remaining.slice(found.index + found.match[0].length)
  }
  return parts.join('')
}

/** Convert template plain text → HTML for Graph API send. */
export function plainBodyToHtmlForSend(plainBody: string): string {
  return inlineMarkdownToHtml(plainBody || '')
}
