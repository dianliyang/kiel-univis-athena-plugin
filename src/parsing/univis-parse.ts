import { decodeHtml, stripHtmlWithLineBreaks, stripTags } from '../utils/entities.js'
import {
  combineDefinitionSections,
  extractDefinitionContent,
  extractLectureLanguage,
  getCategoryPriority,
  getPrimaryKindLabel,
  isExerciseTitle,
  normalizeDateRangeLine,
  normalizeHeadingText,
  normalizeScheduleLine,
  parseAssignedLectureEntries,
  parseExamLines,
  parseTitleCode,
} from './univis-normalize.js'
import { UnivisCategory, UnivisDegreeNode, UnivisLectureDetail, UnivisLectureRow } from '../types/univis.js'

export function buildKielOverviewUrl({
  language = 'en',
  semester = '2026s',
  tdir = 'techn/infora/master',
  requestPath = '/form',
} = {}): string {
  return buildKielOverviewRequest({ language, semester, tdir, requestPath }).url
}

export function normalizeUnivisSemester(value = '2026s') {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '')
  const directMatch = normalized.match(/^(\d{4})([sw])$/)
  if (directMatch) {
    return `${directMatch[1]}${directMatch[2]}`
  }

  const winterMatch = normalized.match(/^(?:ws|wintersemester|winter)(\d{4})(?:\/\d{2})?$/)
  if (winterMatch) {
    return `${winterMatch[1]}w`
  }

  const summerMatch = normalized.match(/^(?:ss|sommersemester|summer)(\d{4})$/)
  if (summerMatch) {
    return `${summerMatch[1]}s`
  }

  return normalized || '2026s'
}

function normalizeUnivisRequestPath(value = '/form') {
  const trimmed = value.trim()
  if (!trimmed || trimmed === '/') {
    return '/form'
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

export function buildKielOverviewRequest({
  language = 'en',
  semester = '2026s',
  tdir = 'techn/infora/master',
  requestPath = '/form',
} = {}): { url: string; init: RequestInit } {
  const normalizedSemester = normalizeUnivisSemester(semester)
  const url = new URL(normalizeUnivisRequestPath(requestPath), 'https://univis.uni-kiel.de')
  const form = new URLSearchParams()
  form.set('__s', '1')
  form.set('dsc', 'anew/unihd')
  form.set('donedef', '1')
  if (language === 'en') {
    form.set('submitimg-English', 'anew/unihd-topnav:anew/unihd:lang_en')
    form.set('English.x', '13')
    form.set('English.y', '3')
  }
  form.set('search', 'lecture')
  form.set('submitimg-Search', 'anew/unihd-topnav:anew/unihd:search')
  form.set('semto', normalizedSemester)
  form.set('submitimg-Semester', 'anew/unihd-topnav:anew/unihd:setsem')
  form.set('setsem_jump', 'anew/tlecture')
  form.set('wildto', 'anew/lecformat')
  form.set('lecformat', 'anew/tlecture')
  form.set('submitimg-hinzufügen', 'anew/lecformat:anew/lecformat:addlecs')
  form.set('submitimg-löschen', 'anew/lecformat:anew/lecformat:remlecs')
  form.set('submitimg-einschränken', 'anew/lecformat:anew/lecformat:redlecs_nosearch')
  form.set('ref', 'tlecture')
  form.set('anonymous', '1')
  form.set('sem', normalizedSemester)
  form.set('tdir', tdir)
  form.set('__e', '620')

  return {
    url: url.toString(),
    init: {
      method: 'POST',
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': language === 'en' ? 'en-US,en;q=0.9' : 'de-DE,de;q=0.9,en;q=0.8',
        'cache-control': 'max-age=0',
        'content-type': 'application/x-www-form-urlencoded',
        origin: 'https://univis.uni-kiel.de',
        referer: 'https://univis.uni-kiel.de/form',
        'upgrade-insecure-requests': '1',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari/537.36',
      },
      body: form.toString(),
    },
  }
}

export function parseOverviewCategories(html: string, sourceBaseUrl: string): UnivisCategory[] {
  return Array.from(html.matchAll(/<li><a href="([^"]+)">([^<]+)<\/a><\/li>/gi), match => ({
    title: stripTags(match[2]),
    url: new URL(decodeHtml(match[1]), sourceBaseUrl).toString(),
  }))
}

export function parseDegreeNode(html: string, sourceBaseUrl: string): UnivisDegreeNode {
  const title = stripTags(html.match(/<h2>([\s\S]*?)<\/h2>/i)?.[1] ?? '').trim() || null
  const documents = Array.from(
    html.matchAll(/<a\s+href="([^"]+\.pdf[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi),
    match => ({
      title: stripTags(match[2]).trim(),
      url: new URL(decodeHtml(match[1]), sourceBaseUrl).toString(),
    }),
  ).filter(document => document.title)

  return {
    title,
    documents,
    categories: parseOverviewCategories(html, sourceBaseUrl),
  }
}

export function parseCategoryLectureRows(
  html: string,
  { categoryTitle, sourceBaseUrl = 'https://univis.uni-kiel.de' }: { categoryTitle: string; sourceBaseUrl?: string }
): UnivisLectureRow[] {
  return Array.from(html.matchAll(
    /<h4>\s*<a href="([^"]+)">([\s\S]*?)<\/a>\s*<\/h4>\s*<small>([\s\S]*?)<\/small>/gi,
  ), (match) => {
    const titleData = parseTitleCode(match[2])
    return {
      code: titleData.code,
      title: titleData.title,
      rawTitle: stripTags(match[2]),
      detailUrl: new URL(decodeHtml(match[1]), sourceBaseUrl).toString(),
      summary: stripHtmlWithLineBreaks(match[3]),
      categoryTitle,
    }
  })
    .filter(
      lecture =>
        lecture.code
        && !isExerciseTitle(lecture.rawTitle),
    )
}

export function mergeLectureSummaries(lectures: UnivisLectureRow[]): UnivisLectureRow[] {
  const merged = new Map<string, UnivisLectureRow>()

  for (const lecture of lectures) {
    if (!lecture.code) continue
    const key = lecture.code.toLowerCase()
    const existing = merged.get(key)
    if (!existing) {
      merged.set(key, {
        ...lecture,
        allCategories: [lecture.categoryTitle],
      })
      continue
    }

    const allCategories = new Set([
      ...existing.allCategories!,
      lecture.categoryTitle,
    ])
    const preferred
      = getCategoryPriority(lecture.categoryTitle)
        < getCategoryPriority(existing.categoryTitle)
        ? lecture
        : existing

    merged.set(key, {
      ...preferred,
      allCategories: [...allCategories],
    })
  }

  return [...merged.values()].sort((left, right) =>
    (left.code || '').localeCompare(right.code || ''),
  )
}

function parseLectureHeading(headingText: string) {
  const headingWithLeadingCode = headingText.match(
    /^([A-Z0-9-]+):\s*(.+?)\s+\(\1\)\s+\((\d+)\)$/i,
  )
  const headingWithTrailingCode = headingText.match(
    /^(.+?)\s+\(([A-Z0-9-]+)\)\s+\((\d+)\)$/i,
  )
  const headingTitleOnlyWithKindAndNumber = headingText.match(
    /^(Exercise|Practical Exercise|Tutorial):\s*(.+?)\s+\((\d+)\)$/i,
  )
  const headingTitleOnlyWithNumber = headingText.match(/^(.+?)\s+\((\d+)\)$/)
  const headingSimple = headingText.match(/^([A-Z0-9-]+):\s*(.+)$/i)

  if (
    !headingWithLeadingCode
    && !headingWithTrailingCode
    && !headingTitleOnlyWithKindAndNumber
    && !headingTitleOnlyWithNumber
    && !headingSimple
  ) {
    throw new Error('Could not parse lecture detail heading.')
  }

  return {
    code:
      headingWithLeadingCode?.[1]
      ?? headingWithTrailingCode?.[2]
      ?? (headingTitleOnlyWithKindAndNumber || headingTitleOnlyWithNumber
        ? null
        : headingSimple?.[1]),
    title:
      headingWithLeadingCode?.[2]
      ?? headingWithTrailingCode?.[1]
      ?? headingTitleOnlyWithKindAndNumber?.[2]
      ?? headingTitleOnlyWithNumber?.[1]
      ?? headingSimple?.[2],
    number:
      headingWithLeadingCode?.[3]
      ?? headingWithTrailingCode?.[3]
      ?? headingTitleOnlyWithKindAndNumber?.[3]
      ?? headingTitleOnlyWithNumber?.[2]
      ?? null,
  }
}

function buildNormalizedSchedule(kindLabel: string, schedule: any, dateRange: any) {
  return {
    kindLabel,
    dayOfWeek: schedule.dayOfWeek,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    displayTime: schedule.displayTime,
    location: schedule.location || 'TBD',
    startDate: dateRange?.startDate ?? null,
    endDate: dateRange?.endDate ?? null,
  }
}

export function parseLectureDetailHtml(
  html: string,
  {
    categoryTitle,
    allCategories = [categoryTitle],
    detailUrl = null,
    sourceBaseUrl = 'https://univis.uni-kiel.de',
  }: { categoryTitle: string; allCategories?: string[]; detailUrl?: string | null; sourceBaseUrl?: string }
): UnivisLectureDetail {
  const headingMatch = html.match(/<h3>([\s\S]*?)<\/h3>/i)
  const headingText = normalizeHeadingText(stripTags(headingMatch?.[1] ?? ''))
  const heading = parseLectureHeading(headingText)
  const detailBlockHtml = extractDefinitionContent(html, 'Details') ?? ''
  const detailLines = stripHtmlWithLineBreaks(detailBlockHtml)
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
  const lecturers = [
    ...new Set(
      Array.from(html.matchAll(/dsc=anew\/tel_view[^"]*">([^<]+)<\/a>/gi), match => stripTags(match[1]))
        .filter(Boolean),
    ),
  ]
  const description = combineDefinitionSections(
    html,
    [
      'Prerequisites / Organisational information',
      'Contents',
      'Recommended literature',
    ],
    sourceBaseUrl,
  )
  const departmentBlockMatch = html.match(
    /<dt><b>Department:<\/b>\s*<a[^>]*>([\s\S]*?)<\/a><\/dt>/i,
  )
  const primaryKindLabel = getPrimaryKindLabel(detailBlockHtml, headingText)
  const primaryScheduleLine = detailLines.find(line =>
    /^time and place/i.test(line),
  )
  const primarySchedules = primaryScheduleLine
    ? normalizeScheduleLine(primaryScheduleLine)
    : []
  const primaryDateRange
    = detailLines.map(normalizeDateRangeLine).find(Boolean) ?? null
  const assignedBlockHtml
    = extractDefinitionContent(html, 'Assigned lectures') ?? ''
  const assignedLectures = assignedBlockHtml
    ? parseAssignedLectureEntries(
        assignedBlockHtml,
        primaryDateRange,
        sourceBaseUrl,
      )
    : []
  const exams = parseExamLines(detailLines)
  const creditMatch = stripTags(detailBlockHtml).match(
    /ECTS credits:\s*(\d+)/i,
  )
  const language = extractLectureLanguage(detailLines)
  const normalizedPrimarySchedules = primarySchedules.map(schedule =>
    buildNormalizedSchedule(primaryKindLabel, schedule, primaryDateRange),
  )

  return {
    code: heading.code ? stripTags(heading.code) : null,
    title: heading.title ? stripTags(heading.title) : null,
    number: heading.number,
    categoryTitle,
    allCategories,
    department:
      stripTags(departmentBlockMatch?.[1] ?? '')
      || 'Department of Computer Science',
    credit: creditMatch ? Number.parseInt(creditMatch[1], 10) : null,
    language,
    description,
    url: detailUrl,
    instructors: lecturers,
    primarySchedules: normalizedPrimarySchedules,
    assignedLectures,
    schedules: [
      ...normalizedPrimarySchedules,
      ...assignedLectures.flatMap(lecture => lecture.schedules),
    ] as any,
    exams,
  }
}
