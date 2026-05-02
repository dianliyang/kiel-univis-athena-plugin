const HTML_ENTITY_MAP = {
  amp: '&',
  quot: '"',
  apos: '\'',
  lt: '<',
  gt: '>',
  nbsp: ' ',
  auml: 'ä',
  ouml: 'ö',
  uuml: 'ü',
  Auml: 'Ä',
  Ouml: 'Ö',
  Uuml: 'Ü',
  szlig: 'ß',
}

export function decodeHtmlEntities(value) {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi,
    (match, entity) => {
      if (entity.startsWith('#x') || entity.startsWith('#X')) {
        return String.fromCodePoint(Number.parseInt(entity.slice(2), 16))
      }

      if (entity.startsWith('#')) {
        return String.fromCodePoint(Number.parseInt(entity.slice(1), 10))
      }

      return HTML_ENTITY_MAP[entity] ?? match
    },
  )
}

export function decodeHtml(value) {
  return decodeHtmlEntities(value).replace(/\s+/g, ' ').trim()
}

export function stripTags(value) {
  return decodeHtml(value.replace(/<[^>]+>/g, ' '))
}

export function stripHtmlWithLineBreaks(value) {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<p[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .trim()
}

export function stripHtmlWithLineBreaksPreservingLinks(
  value,
  baseUrl = null,
) {
  const markdownLinkedHtml = value.replace(
    /<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
    (_match, href, label) => {
      const resolvedHref = baseUrl
        ? new URL(decodeHtml(href), baseUrl).toString()
        : decodeHtml(href)
      return `[${stripTags(label)}](${resolvedHref})`
    },
  )

  return stripHtmlWithLineBreaks(markdownLinkedHtml)
}

export function extractUrls(text) {
  const urls = new Set()

  for (const match of text.matchAll(/\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/g)) {
    urls.add(match[1])
  }

  for (const match of text.matchAll(/https?:\/\/[^\s<>"')]+/g)) {
    urls.add(match[0])
  }

  return [...urls]
}

export async function readHtmlResponse(response) {
  if (typeof response?.arrayBuffer !== 'function') {
    return response.text()
  }

  const buffer = await response.arrayBuffer()
  const contentType = response?.headers?.get?.('content-type') ?? ''
  const charset = contentType
    .match(/charset=([^;]+)/i)?.[1]
    ?.trim()
    ?.toLowerCase()

  if (
    charset === 'iso-8859-1'
    || charset === 'latin1'
    || charset === 'latin-1'
    || charset === 'windows-1252'
  ) {
    return new TextDecoder('latin1').decode(buffer)
  }

  const utf8Text = new TextDecoder('utf-8').decode(buffer)
  if (utf8Text.includes('�')) {
    return new TextDecoder('latin1').decode(buffer)
  }

  return utf8Text
}
