export function decodeHtml(html: string): string {
  if (!html) return ''
  return html.replace(/&([^;]+);/g, (match, entity) => {
    const entities: Record<string, string> = {
      amp: '&',
      lt: '<',
      gt: '>',
      quot: '"',
      apos: "'",
      nbsp: ' ',
    }
    if (entity in entities) {
      return entities[entity]
    }
    if (entity.startsWith('#x')) {
      return String.fromCharCode(parseInt(entity.slice(2), 16))
    }
    if (entity.startsWith('#')) {
      return String.fromCharCode(parseInt(entity.slice(1), 10))
    }
    return match
  })
}

export function stripTags(html: string): string {
  if (!html) return ''
  return html.replace(/<[^>]*>?/gm, '')
}

export function stripHtmlWithLineBreaks(html: string): string {
  if (!html) return ''
  return decodeHtml(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<li[^>]*>/gi, '\n- ')
      .replace(/<\/li>/gi, '')
      .replace(/<[^>]*>?/gm, '')
  ).trim()
}

export function stripHtmlWithLineBreaksPreservingLinks(
  html: string,
  sourceBaseUrl: string | null = null,
): string {
  if (!html) return ''
  let processed = html
    .replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (match, href, text) => {
      try {
        const url = sourceBaseUrl ? new URL(href, sourceBaseUrl).toString() : href
        return `[${stripTags(text)}](${url})`
      } catch {
        return text
      }
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/li>/gi, '')
    .replace(/<[^>]*>?/gm, '')

  return decodeHtml(processed).trim()
}

export async function readHtmlResponse(response: { text: () => Promise<string> }): Promise<string> {
  return await response.text()
}

export function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s)\]]+/g)
  return matches ? [...new Set(matches)] : []
}
