import { fetchKielUnivisCourses } from './fetcher.js'
import { PluginContext, PluginToolResult } from './types/athena.js'

function getStringOption(
  input: Record<string, unknown> | undefined,
  config: Record<string, unknown>,
  key: string,
  fallback: string,
) {
  const inputValue = input?.[key]
  if (typeof inputValue === 'string' && inputValue.trim().length > 0) {
    return inputValue.trim()
  }

  const configValue = config[key]
  if (typeof configValue === 'string' && configValue.trim().length > 0) {
    return configValue.trim()
  }

  return fallback
}

async function retrieveKielUnivisCourses(
  context: PluginContext,
  input?: Record<string, unknown>,
): Promise<PluginToolResult> {
  const config = (await context.getConfig()) ?? {}
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
    language: getStringOption(input, config, 'language', 'en'),
    semester: getStringOption(input, config, 'semester', '2026s'),
    tdir: getStringOption(input, config, 'tdir', 'techn/infora/master'),
    requestPath: getStringOption(input, config, 'requestPath', '/formbot'),
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
  config: [
    {
      key: 'language',
      label: 'Language',
      type: 'select',
      defaultValue: 'en',
      options: [
        { value: 'en', label: 'English' },
        { value: 'de', label: 'Deutsch' },
      ],
    },
    {
      key: 'semester',
      label: 'Semester',
      type: 'select',
      defaultValue: '2026s',
      options: [
        { value: '2026s', label: '2026 Summer' },
        { value: '2026w', label: '2026 Winter' },
        { value: '2025s', label: '2025 Summer' },
        { value: '2025w', label: '2025 Winter' },
      ],
    },
    {
      key: 'tdir',
      label: 'UnivIS Directory',
      type: 'text',
      defaultValue: 'techn/infora/master',
      placeholder: 'techn/infora/master',
      description: 'UnivIS tdir path to retrieve.',
    },
    {
      key: 'requestPath',
      label: 'Request Path',
      type: 'text',
      defaultValue: '/formbot',
      placeholder: '/formbot',
      description: 'Override the UnivIS request path while keeping the host fixed to univis.uni-kiel.de.',
    },
  ],

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
