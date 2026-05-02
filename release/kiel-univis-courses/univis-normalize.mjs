import {
  decodeHtml,
  stripHtmlWithLineBreaks,
  stripHtmlWithLineBreaksPreservingLinks,
  stripTags,
} from './entities.mjs'
import {
  normalizeDayMonthYear,
  normalizeTimeOnly,
  parseWeekdayLabel,
} from './time.mjs'

export const THEORETICAL_CATEGORY = 'Theoretical Computer Science'
export const ELECTIVE_CATEGORY = 'Compulsory elective modules in Computer Science'
export const COURSE_CATEGORY_TITLES = new Set([
  THEORETICAL_CATEGORY,
  ELECTIVE_CATEGORY,
])

export function getCategoryPriority(categoryTitle) {
  if (categoryTitle === THEORETICAL_CATEGORY) {
    return 0
  }
  if (categoryTitle === ELECTIVE_CATEGORY) {
    return 1
  }
  return 99
}

export function parseTitleCode(value) {
  const clean = stripTags(value).replace(/^\W+/, '')
  const match = clean.match(/^([A-Z0-9-]+):\s*(.+)$/i)
  if (match) {
    return {
      code: match[1],
      title: match[2].trim(),
    }
  }

  return {
    code: null,
    title: clean,
  }
}

export function isExerciseTitle(value) {
  return /^(Exercise:|Practical Exercise:|Übung zu:|Tutorial:)/i.test(
    stripTags(value),
  )
}

export function mapKindToCategory(kindLabel) {
  const normalized = kindLabel?.trim().toLowerCase()

  switch (normalized) {
    case 'lecture':
      return 'academic.lecture'
    case 'seminar':
      return 'academic.seminar'
    case 'tutorial':
      return 'academic.tutorial'
    case 'exercise':
      return 'academic.exercise'
    case 'practical exercise':
    case 'lab':
    case 'laboratory':
      return 'academic.lab'
    case 'study':
      return 'academic.study'
    case 'reading':
      return 'academic.reading'
    case 'project':
      return 'academic.project'
    case 'meeting':
      return 'academic.meeting'
    case 'review':
      return 'academic.review'
    case 'exam':
      return 'academic.exam'
    default:
      return 'academic.course'
  }
}

export function getSessionTypeForKind(kindLabel) {
  if (/^Practical Exercise$/i.test(kindLabel)) {
    return 'lab'
  }
  if (/^Exercise$/i.test(kindLabel)) {
    return 'tutorial'
  }
  if (/^Lecture$/i.test(kindLabel)) {
    return 'lecture'
  }
  return 'course'
}

export function normalizeHeadingText(value) {
  return value.replace(/\s*\[Import\]\s*$/i, '').trim()
}

export function getExamDisplayLabel(label) {
  const ordinal = label.match(
    /^(\d+(?:st|nd|rd|th))\s+examination date\b/i,
  )?.[1]
  return ordinal ? `${ordinal} Exam` : label
}

export function getPrimaryKindLabel(detailBlockHtml, headingText) {
  const detailKind = stripTags(detailBlockHtml).match(
    /^(Lecture|Exercise|Practical Exercise|Tutorial)\b/i,
  )?.[1]
  const headingKind = normalizeHeadingText(headingText).match(
    /^(Exercise|Practical Exercise|Tutorial):/i,
  )?.[1]
  const rawKind = detailKind ?? headingKind ?? 'Lecture'

  if (/^Practical Exercise$/i.test(rawKind)) {
    return 'Practical Exercise'
  }
  if (/^Exercise$|^Tutorial$/i.test(rawKind)) {
    return 'Exercise'
  }
  return 'Lecture'
}

export function normalizeLectureLanguage(value) {
  const normalized = value?.trim().toLowerCase()

  switch (normalized) {
    case 'english':
      return 'en'
    case 'german':
      return 'de'
    default:
      return normalized || null
  }
}

export function extractLectureLanguage(detailLines) {
  for (const line of detailLines) {
    const match = line.match(/language of lecture is\s+(.+)$/i)
    if (match) {
      return normalizeLectureLanguage(match[1])
    }
  }

  return null
}

export function normalizeScheduleLine(rawLine) {
  const line = stripTags(rawLine)
    .replace(/\s*:\s*/, ': ')
    .trim()
  if (!line) {
    return []
  }

  if (/^time and place/i.test(line)) {
    const details = line.replace(/^time and place\s*:\s*/i, '')
    if (/^tbd$/i.test(details)) {
      return [
        {
          dayOfWeek: null,
          startTime: null,
          endTime: null,
          location: 'TBD',
          displayTime: 'TBD',
        },
      ]
    }

    if (details.includes(';')) {
      return details
        .split(/\s*;\s*/g)
        .filter(Boolean)
        .flatMap(part => normalizeScheduleLine(`Time and place: ${part}`))
    }

    const dayMatch = details.match(/^([A-Z]{3})\s+(.+)$/i)
    const timeRanges = [
      ...details.matchAll(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/g),
    ]
    if (timeRanges.length > 0) {
      const weekdayPrefix = details.slice(0, timeRanges[0].index ?? 0)
      const weekdayLabels = Array.from(weekdayPrefix.matchAll(/\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\b/gi), match => parseWeekdayLabel(match[1]))
        .filter(dayOfWeek => dayOfWeek !== null)
      const locationStartIndex
        = (timeRanges.at(-1)?.index ?? 0) + timeRanges.at(-1)?.[0].length
      const location
        = details.slice(locationStartIndex).replace(/^,\s*/, '').trim() || 'TBD'

      if (weekdayLabels.length === 1 || dayMatch) {
        const dayOfWeek = weekdayLabels[0] ?? parseWeekdayLabel(dayMatch?.[1])
        return timeRanges.map(match => ({
          dayOfWeek,
          startTime: normalizeTimeOnly(match[1]),
          endTime: normalizeTimeOnly(match[2]),
          location,
          displayTime: `${normalizeTimeOnly(match[1])} - ${normalizeTimeOnly(match[2])}`,
        }))
      }

      if (weekdayLabels.length > 1 && timeRanges.length === 1) {
        return weekdayLabels.map(dayOfWeek => ({
          dayOfWeek,
          startTime: normalizeTimeOnly(timeRanges[0][1]),
          endTime: normalizeTimeOnly(timeRanges[0][2]),
          location,
          displayTime: `${normalizeTimeOnly(timeRanges[0][1])} - ${normalizeTimeOnly(timeRanges[0][2])}`,
        }))
      }
    }
  }

  return [
    {
      dayOfWeek: null,
      startTime: null,
      endTime: null,
      location: 'TBD',
      displayTime: 'TBD',
    },
  ]
}

export function normalizeDateRangeLine(rawLine) {
  const line = stripTags(rawLine).trim()
  const match = line.match(
    /^from\s+(\d{1,2}\.\d{1,2}\.\d{4})\s+to\s+(\d{1,2}\.\d{1,2}\.\d{4})$/i,
  )
  if (!match) {
    return null
  }

  return {
    startDate: normalizeDayMonthYear(match[1]),
    endDate: normalizeDayMonthYear(match[2]),
  }
}

export function extractDefinitionContent(html, label) {
  const match = html.match(
    new RegExp(
      `<dt><b>${label}<\\/b><\\/dt>\\s*<dd>([\\s\\S]*?)(?=<dt><b>|<\\/dl>|$)`,
      'i',
    ),
  )
  return match ? match[1] : null
}

export function combineDefinitionSections(html, labels, sourceBaseUrl = null) {
  const sections = labels
    .map(label => ({
      label,
      content: stripHtmlWithLineBreaksPreservingLinks(
        extractDefinitionContent(html, label) ?? '',
        sourceBaseUrl,
      ),
    }))
    .filter(section => section.content)

  return sections.length > 0
    ? sections
        .map(section => `### ${section.label}\n\n${section.content}`)
        .join('\n\n')
    : null
}

export function parseExamLines(detailLines) {
  return detailLines
    .map(line =>
      line.match(
        /^(\d+(?:st|nd|rd|th)\s+examination date[^:]*):\s*(\d{1,2}\.\d{1,2}\.\d{4})(?:,\s*(\d{1,2}:\d{2})(?:\s*-\s*(\d{1,2}:\d{2}))?)?$/i,
      ),
    )
    .filter(Boolean)
    .map(match => ({
      label: decodeHtml(match[1]),
      date: normalizeDayMonthYear(match[2]),
      startTime: normalizeTimeOnly(match[3]),
      endTime: normalizeTimeOnly(match[4] ?? match[3]),
    }))
    .filter(exam => !!exam.date)
}

export function parseAssignedLectureEntries(
  blockHtml,
  fallbackDateRange,
  sourceBaseUrl = 'https://univis.uni-kiel.de',
) {
  return Array.from(blockHtml.matchAll(/<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/gi), (match) => {
    const headerText = stripTags(match[1])
    const detailUrlMatch = match[1].match(/<a[^>]*href="([^"]+)"/i)
    const bodyLines = stripHtmlWithLineBreaks(match[2])
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
    const headerTitleMatch = headerText.match(/:\s*(.+?)\s*\(\d+\)\s*$/)
    const headerCodeMatch = headerText.match(/^([A-Z]+):/)
    const kindLabel = /^Practical Exercise:/i.test(
      headerTitleMatch?.[1] ?? '',
    )
      ? 'Practical Exercise'
      : /^Exercise:|^Übung zu:|^Tutorial:/i.test(headerTitleMatch?.[1] ?? '')
        ? 'Exercise'
        : headerCodeMatch?.[1] === 'V'
          ? 'Lecture'
          : 'Course'
    const scheduleLine = bodyLines.find(line =>
      /^time and place/i.test(line),
    )
    const parsedSchedules = normalizeScheduleLine(scheduleLine ?? 'TBD')
    const parsedRange
      = bodyLines.map(normalizeDateRangeLine).find(Boolean)
        ?? fallbackDateRange

    return {
      kindLabel,
      detailUrl: detailUrlMatch?.[1]
        ? new URL(decodeHtml(detailUrlMatch[1]), sourceBaseUrl).toString()
        : null,
      schedules: parsedSchedules
        .map(parsedSchedule => ({
          kindLabel,
          dayOfWeek: parsedSchedule.dayOfWeek,
          startTime: parsedSchedule.startTime,
          endTime: parsedSchedule.endTime,
          displayTime: parsedSchedule.displayTime,
          location: parsedSchedule.location || 'TBD',
          startDate: parsedRange?.startDate ?? null,
          endDate: parsedRange?.endDate ?? null,
        }))
        .filter(schedule => !!schedule.startDate && !!schedule.endDate),
    }
  })
    .filter(item => item.kindLabel !== 'Course')
}
