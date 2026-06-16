import { fetchKielUnivisCourses } from './fetcher.js'
import { PluginContext, PluginToolResult } from './types/athena.js'

async function retrieveKielUnivisCourses(
  context: PluginContext,
  input?: Record<string, unknown>,
): Promise<PluginToolResult> {
  const result = await fetchKielUnivisCourses({
    fetchImpl: async (requestUrl, init) => {
      const response = await context.fetch({
        url: String(requestUrl),
        method: String(init?.method ?? 'GET'),
        headers: init?.headers && !Array.isArray(init.headers)
          ? init.headers as Record<string, string>
          : undefined,
        body: typeof init?.body === 'string' ? init.body : undefined,
      })
      return {
        headers: {
          get(name: string) {
            return response.headers[String(name).toLowerCase()] ?? null
          },
        },
        async text() {
          return response.bodyText
        },
      }
    },
    language: typeof input?.language === 'string' && input.language.trim() ? input.language.trim() : 'en',
    semester: typeof input?.semester === 'string' && input.semester.trim() ? input.semester.trim() : '2026s',
    tdir: typeof input?.tdir === 'string' && input.tdir.trim() ? input.tdir.trim() : 'techn/infora/master',
    requestPath: typeof input?.requestPath === 'string' && input.requestPath.trim() ? input.requestPath.trim() : '/formbot',
  })
  const warnings = result.warnings ?? []
  const courseCount = result.courses?.length ?? 0
  const scheduleCount = result.schedules?.length ?? 0
  const warningText = warnings.length > 0
    ? ` ${warnings.length} warning(s) were returned.`
    : ''

  return {
    content: `Retrieved ${courseCount} Kiel UnivIS course(s) and ${scheduleCount} schedule(s) for review.${warningText}`,
    data: {
      courses: result.courses ?? [],
      schedules: result.schedules ?? [],
      documents: result.documents ?? [],
      warnings,
    },
    warnings,
  }
}

export default {
  tools: [
    {
      name: 'retrieve_kiel_univis_courses',
      description: 'Retrieve Kiel University courses, schedules, and exam dates from UnivIS for review.',
      parameters: {
        type: 'object',
        properties: {
          language: {
            type: 'string',
            enum: ['en', 'de'],
            description: 'Preferred UnivIS language for this retrieval.',
          },
          semester: {
            type: 'string',
            enum: ['2026s', '2026w', '2025s', '2025w'],
            description: 'UnivIS semester identifier to import.',
          },
          requestPath: {
            type: 'string',
            description: 'Optional UnivIS request path. The host remains univis.uni-kiel.de.',
          },
          tdir: {
            type: 'string',
            description: 'Optional UnivIS tdir path, for example techn/infora/master.',
          },
        },
        additionalProperties: false,
      },
      execute: retrieveKielUnivisCourses,
    },
  ],
}
