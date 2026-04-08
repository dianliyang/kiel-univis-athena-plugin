import { decodeHtml, stripHtmlWithLineBreaks, stripTags } from './entities.mjs'
import {
  combineDefinitionSections,
  COURSE_CATEGORY_TITLES,
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
} from './univis-normalize.mjs'

export function buildKielOverviewUrl({
  language = 'en',
  semester = '2026s',
} = {}) {
  const dsc = `dsc=anew/tlecture&tdir=techn/infora/master&lang=${language}&ref=tlecture&sem=${semester}`
  return `https://univis.uni-kiel.de/formbot/${encodeURIComponent(dsc).replace(/%/g, '_')}`
}

export function parseOverviewCategories(html, sourceBaseUrl) {
  return Array.from(html.matchAll(/<li><a href="([^"]+)">([^<]+)<\/a><\/li>/gi), match => ({
    title: stripTags(match[2]),
    url: new URL(decodeHtml(match[1]), sourceBaseUrl).toString(),
  }))
}

export function parseCategoryLectureRows(
  html,
  { categoryTitle, sourceBaseUrl = 'https://univis.uni-kiel.de' } = {},
) {
  return Array.from(html.matchAll(
    /<h4>\s*<a href="([^"]+)">([\s\S]*?)<\/a><\/h4>\s*<small>([\s\S]*?)<\/small>/gi,
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
        && COURSE_CATEGORY_TITLES.has(lecture.categoryTitle)
        && !isExerciseTitle(lecture.rawTitle),
    )
}

export function mergeLectureSummaries(lectures) {
  const merged = new Map()

  for (const lecture of lectures) {
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
      ...existing.allCategories,
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
    left.code.localeCompare(right.code),
  )
}

function parseLectureHeading(headingText) {
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

function buildNormalizedSchedule(kindLabel, schedule, dateRange) {
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
  html,
  {
    categoryTitle,
    allCategories = [categoryTitle],
    detailUrl = null,
    sourceBaseUrl = 'https://univis.uni-kiel.de',
  } = {},
) {
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
    ],
    exams,
  }
}
