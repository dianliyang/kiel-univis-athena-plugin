import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

import { fetchKielUnivisCourses } from './fetcher.js'
import { CourseRecord, ScheduleRecord } from './types/athena.js'

const DEFAULT_LANGUAGE = 'en'
const DEFAULT_SEMESTER = '2026s'
const DEFAULT_TDIR = 'techn/infora/master'
const DEFAULT_REQUEST_PATH = '/formbot'

const UnivisQuerySchema = z.object({
  language: z.enum(['en', 'de']).default(DEFAULT_LANGUAGE).describe('Preferred UnivIS language.'),
  semester: z.string().default(DEFAULT_SEMESTER).describe('UnivIS semester identifier, for example 2026s or 2025w.'),
  tdir: z.string().default(DEFAULT_TDIR).describe('UnivIS tdir path, for example techn/infora/master.'),
  requestPath: z.string().default(DEFAULT_REQUEST_PATH).describe('Optional UnivIS request path. The host remains univis.uni-kiel.de.'),
})

const UnivisSearchSchema = UnivisQuerySchema.extend({
  query: z.string().min(1).describe('Course title, code, instructor, topic, or category text to search for.'),
})

type UnivisQueryInput = z.infer<typeof UnivisQuerySchema>
type UnivisSearchInput = z.infer<typeof UnivisSearchSchema>
type FetchLike = (url: string) => Promise<Response>

interface ToolHandlerOptions {
  fetchImpl?: FetchLike
}

interface CourseListResult {
  content: string
  courses: CourseRecord[]
  schedules: ScheduleRecord[]
  documents: Array<{ title: string; url: string }>
  warnings: string[]
}

function normalizeInput(input: Partial<UnivisQueryInput>): UnivisQueryInput {
  return {
    language: input.language ?? DEFAULT_LANGUAGE,
    semester: input.semester ?? DEFAULT_SEMESTER,
    tdir: input.tdir ?? DEFAULT_TDIR,
    requestPath: input.requestPath ?? DEFAULT_REQUEST_PATH,
  }
}

function getCourseSearchText(course: CourseRecord) {
  return [
    course.code,
    course.title,
    course.category,
    course.language,
    course.description,
    course.instructors.join(' '),
    course.topics.join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function formatCourseLine(course: CourseRecord, index: number) {
  const details = [
    course.code || null,
    course.language ? course.language.toUpperCase() : null,
    course.instructors.length > 0 ? course.instructors.join(', ') : null,
  ].filter(Boolean)
  const suffix = details.length > 0 ? ' - ' + details.join(' | ') : ''
  return String(index + 1) + '. ' + course.title + suffix
}

function formatCourseListContent({
  courses,
  schedules,
  warnings,
  semester,
  query,
}: {
  courses: CourseRecord[]
  schedules: ScheduleRecord[]
  warnings: string[]
  semester: string
  query?: string
}) {
  const heading = query
    ? 'Found ' + courses.length + ' Kiel UnivIS course(s) matching "' + query + '" for ' + semester + '.'
    : 'Found ' + courses.length + ' Kiel UnivIS course(s) for ' + semester + '.'
  const scheduleText = 'Retrieved ' + schedules.length + ' schedule item(s) for review. This result is informational only.'
  const lines = courses.slice(0, 40).map(formatCourseLine)
  const overflow = courses.length > lines.length
    ? ['...and ' + (courses.length - lines.length) + ' more course(s). Narrow the search to inspect more.']
    : []
  const warningLines = warnings.length > 0
    ? ['', 'Warnings: ' + warnings.length, ...warnings.map(warning => '- ' + warning)]
    : []

  return [heading, scheduleText, '', ...lines, ...overflow, ...warningLines].join('\n').trim()
}

async function retrieveCourses(
  input: Partial<UnivisQueryInput>,
  options: ToolHandlerOptions = {},
): Promise<CourseListResult> {
  const normalized = normalizeInput(input)
  const result = await fetchKielUnivisCourses({
    fetchImpl: options.fetchImpl ?? fetch,
    language: normalized.language,
    semester: normalized.semester,
    tdir: normalized.tdir,
    requestPath: normalized.requestPath,
  })
  const courses = result.courses ?? []
  const schedules = result.schedules ?? []
  const warnings = result.warnings ?? []

  return {
    content: formatCourseListContent({
      courses,
      schedules,
      warnings,
      semester: normalized.semester,
    }),
    courses,
    schedules,
    documents: result.documents ?? [],
    warnings,
  }
}

export const listKielUnivisCoursesTool = {
  name: 'list_kiel_univis_courses',
  title: 'List Kiel UnivIS Courses',
  description: 'List Kiel UnivIS courses, schedules, and exam information for review without importing data into Athena.',
  inputSchema: UnivisQuerySchema,
  async handler(input: Partial<UnivisQueryInput>, options: ToolHandlerOptions = {}) {
    return retrieveCourses(input, options)
  },
}

export const searchKielUnivisCoursesTool = {
  name: 'search_kiel_univis_courses',
  title: 'Search Kiel UnivIS Courses',
  description: 'Search Kiel UnivIS courses by title, code, instructor, topic, language, or category without importing data into Athena.',
  inputSchema: UnivisSearchSchema,
  async handler(input: UnivisSearchInput, options: ToolHandlerOptions = {}) {
    const normalized = normalizeInput(input)
    const result = await retrieveCourses(normalized, options)
    const query = input.query.trim().toLowerCase()
    const courses = result.courses.filter(course => getCourseSearchText(course).includes(query))
    const courseIds = new Set(courses.map(course => course.id))
    const schedules = result.schedules.filter(schedule => schedule.entityId && courseIds.has(schedule.entityId))

    return {
      content: formatCourseListContent({
        courses,
        schedules,
        warnings: result.warnings,
        semester: normalized.semester,
        query: input.query,
      }),
      courses,
      schedules,
      warnings: result.warnings,
    }
  },
}

function toMcpToolResult(result: CourseListResult) {
  return {
    content: [{ type: 'text' as const, text: result.content }],
    structuredContent: {
      courses: result.courses,
      schedules: result.schedules,
      documents: result.documents,
      warnings: result.warnings,
    },
  }
}

export function createKielUnivisMcpServer() {
  const server = new McpServer(
    {
      name: 'kiel-univis-courses',
      version: '0.1.8',
    },
    {
      capabilities: {
        tools: { listChanged: true },
      },
    },
  )

  server.registerTool(
    listKielUnivisCoursesTool.name,
    {
      title: listKielUnivisCoursesTool.title,
      description: listKielUnivisCoursesTool.description,
      inputSchema: listKielUnivisCoursesTool.inputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false },
    },
    async input => toMcpToolResult(await listKielUnivisCoursesTool.handler(input)),
  )

  server.registerTool(
    searchKielUnivisCoursesTool.name,
    {
      title: searchKielUnivisCoursesTool.title,
      description: searchKielUnivisCoursesTool.description,
      inputSchema: searchKielUnivisCoursesTool.inputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false },
    },
    async input => toMcpToolResult(await searchKielUnivisCoursesTool.handler(input)),
  )

  return server
}

export async function runKielUnivisMcpServer() {
  const server = createKielUnivisMcpServer()
  await server.connect(new StdioServerTransport())
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  runKielUnivisMcpServer().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
