import { fetchKielUnivisCourses } from './lib.mjs'

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
      key: 'requestPath',
      label: 'Request Path',
      type: 'text',
      defaultValue: '/formbot',
      placeholder: '/formbot',
      description: 'Override the UnivIS request path while keeping the host fixed to univis.uni-kiel.de.',
    },
  ],
  async pull(context) {
    const config = (await context.getConfig()) ?? {}
    const result = await fetchKielUnivisCourses({
      fetchImpl: async (input) => {
        const response = await context.fetch({
          url: String(input),
          method: 'GET',
        })
        return {
          headers: {
            get(name) {
              return response.headers[String(name).toLowerCase()] ?? null
            },
          },
          async text() {
            return response.bodyText
          },
        }
      },
      language: typeof config.language === 'string' ? config.language : 'en',
      semester: typeof config.semester === 'string' ? config.semester : '2026s',
      requestPath:
        typeof config.requestPath === 'string' && config.requestPath.trim().length > 0
          ? config.requestPath
          : '/formbot',
    })

    return {
      protocolVersion: 'v1',
      ...result,
      warnings: result.warnings ?? [],
    }
  },

  async push(_context, payload) {
    const warnings = [
      'Kiel UnivIS push is metadata-only. Remote UnivIS data was not modified.',
    ]

    if ((payload.sessions?.length ?? 0) > 0) {
      warnings.push(
        `Ignored ${payload.sessions.length} session record(s) because the plugin does not write sessions.`,
      )
    }

    return {
      protocolVersion: 'v1',
      summary: {
        courses: payload.courses?.length ?? 0,
        schedules: payload.schedules?.length ?? 0,
        sessions: 0,
      },
      warnings,
    }
  },
}
