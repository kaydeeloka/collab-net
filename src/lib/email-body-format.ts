import React from 'react'

const MD_LINK_RE = /\[([^\]\n]+)\]\(([^)\s]+)\)/g

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Split plain template text into React nodes: plain text + markdown links. */
export function renderMarkdownLinks(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    MD_LINK_RE.lastIndex = 0
    const m = MD_LINK_RE.exec(remaining)
    if (!m || m.index === undefined) {
      parts.push(remaining)
      break
    }
    if (m.index > 0) parts.push(remaining.slice(0, m.index))
    parts.push(
      React.createElement(
        'a',
        {
          key: key++,
          href: m[2],
          target: '_blank',
          rel: 'noopener noreferrer',
          style: { color: '#2563eb', textDecoration: 'underline' },
        },
        m[1],
      ),
    )
    remaining = remaining.slice(m.index + m[0].length)
  }
  return parts
}

/** Render placeholders then markdown links for template preview. */
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
      withPlaceholders.push(...renderMarkdownLinks(remaining).map((node, i) =>
        React.isValidElement(node) ? React.cloneElement(node, { key: `md-${key++}-${i}` }) : node,
      ))
      break
    }

    if (earliest > 0) {
      withPlaceholders.push(
        ...renderMarkdownLinks(remaining.slice(0, earliest)).map((node, i) =>
          React.isValidElement(node) ? React.cloneElement(node, { key: `md-${key++}-${i}` }) : node,
        ),
      )
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

export function getSelectedText(el: HTMLTextAreaElement | null, current: string): string {
  if (!el) return ''
  const start = el.selectionStart ?? 0
  const end = el.selectionEnd ?? 0
  if (start === end) return ''
  return current.slice(start, end)
}

/** Convert template plain text (markdown links) → HTML for Graph API send. */
export function plainBodyToHtmlForSend(plainBody: string): string {
  const text = plainBody || ''
  if (!text) return ''
  const parts: string[] = []
  let last = 0
  let m: RegExpExecArray | null
  const re = new RegExp(MD_LINK_RE.source, 'g')
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push(escapeHtml(text.slice(last, m.index)).replace(/\n/g, '<br>'))
    }
    parts.push(
      `<a href="${escapeHtml(m[2])}" style="color:#2563eb;text-decoration:underline;">${escapeHtml(m[1])}</a>`,
    )
    last = m.index + m[0].length
  }
  if (last < text.length) {
    parts.push(escapeHtml(text.slice(last)).replace(/\n/g, '<br>'))
  }
  return parts.join('')
}
