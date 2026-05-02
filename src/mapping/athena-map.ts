import { extractUrls } from '../utils/entities.js'
import {
  findFirstOccurrenceDate,
  KIEL_SOURCE_TIMEZONE,
  parseDateOnly,
} from '../utils/time.js'
import {
  getExamDisplayLabel,
  getSessionTypeForKind,
  mapKindToCategory,
} from '../parsing/univis-normalize.js'
import { CourseRecord, ScheduleRecord, PluginPullResult } from '../types/athena.js'
import { UnivisLectureDetail } from '../types/univis.js'

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildCourseId(university: string, detail: UnivisLectureDetail) {
  const stableKey = detail.code ?? detail.number ?? detail.title ?? 'unknown'
  return `course-${slugify(university)}-${slugify(stableKey)}`
}

function getScheduleSortRank(schedule: ScheduleRecord) {
  const sessionType = schedule.metadata?.sessionType
  if (sessionType === 'review') {
    return 0
  }

  return schedule.allDay ? 2 : 1
}

function parseKielSemester(semester: string | null) {
  if (!semester) {
    return null
  }

  const match = semester.match(/^(\d{4})([sw])$/i)
  if (!match) {
    return { label: semester }
  }

  const year = Number.parseInt(match[1], 10)
  const isSummer = match[2].toLowerCase() === 's'
  const term = isSummer ? 'Summer' : 'Winter'

  return {
    term,
    year,
    label: `${term} ${year}`,
  }
}

export function buildKielCourseImport(
  lectureDetails: UnivisLectureDetail[],
  { university = 'Kiel University (CAU)', latestTerm = null }: { university?: string; latestTerm?: string | null } = {},
): PluginPullResult {
  const nowIso = new Date().toISOString()
  const courses: CourseRecord[] = []
  const schedules: ScheduleRecord[] = []
  const sessions: any[] = []

  const latestSemester = parseKielSemester(latestTerm)

  for (const detail of lectureDetails) {
    const description = detail.description || null
    const resourceUrls = description ? extractUrls(description) : []
    const courseId = buildCourseId(university, detail)

    courses.push({
      id: courseId,
      university,
      domain: null,
      category: detail.categoryTitle ?? null,
      language: detail.language ?? null,
      source: 'external-import',
      code: detail.code || '',
      title: detail.title || 'Untitled Course',
      department: detail.department ?? 'Department of Computer Science',
      level: 'master',
      credit: detail.credit,
      instructors: detail.instructors,
      latestSemester,
      description,
      url: detail.url,
      topics: [],
      resources: resourceUrls.map(url => ({ label: url, value: url })),
      metadata: null,
      state: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    })

    for (const [index, schedule] of detail.schedules.entries()) {
      if (!schedule.startDate || !schedule.endDate) {
        continue
      }

      const firstDate
        = schedule.dayOfWeek === null
          ? schedule.startDate
          : findFirstOccurrenceDate(schedule.startDate, schedule.dayOfWeek)
      if (!firstDate) {
        continue
      }

      const normalizedLocation = schedule.location?.trim() || 'TBD'
      const hasConcreteTime = !!schedule.startTime && !!schedule.endTime
      const normalizedStartAt = hasConcreteTime ? schedule.startTime! : '00:00'
      const normalizedEndAt = hasConcreteTime ? schedule.endTime! : '23:59'

      schedules.push({
        id: `schedule-${slugify(`${courseId}-${schedule.kindLabel}-${index}`)}`,
        entityType: 'course',
        entityId: courseId,
        title: detail.title || 'Untitled Course',
        dayOfWeek:
          schedule.dayOfWeek
          ?? new Date(`${firstDate}T00:00:00.000Z`).getUTCDay(),
        allDay: !hasConcreteTime,
        startAt: normalizedStartAt,
        endAt: normalizedEndAt,
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        recurrenceUntil: schedule.endDate,
        timezone: KIEL_SOURCE_TIMEZONE,
        location: normalizedLocation,
        category: mapKindToCategory(schedule.kindLabel),
        notes: null,
        metadata: {
          sessionType: getSessionTypeForKind(schedule.kindLabel),
        },
        createdAt: nowIso,
        updatedAt: nowIso,
      })
    }

    for (const [index, exam] of detail.exams.entries()) {
      const examDisplayLabel = getExamDisplayLabel(exam.label)
      const allDay = !exam.startTime || !exam.endTime
      const normalizedStartAt = allDay ? '00:00' : exam.startTime!
      const normalizedEndAt = allDay ? '23:59' : exam.endTime!

      const dateParts = parseDateOnly(exam.date)
      if (!dateParts) {
        continue
      }

      const dayOfWeek = new Date(
        Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day),
      ).getUTCDay()

      schedules.push({
        id: `schedule-${slugify(`${courseId}-${exam.label}-${index}`)}`,
        entityType: 'course',
        entityId: courseId,
        title: `${detail.title} · ${examDisplayLabel}`,
        dayOfWeek,
        allDay,
        startAt: normalizedStartAt,
        endAt: normalizedEndAt,
        startDate: exam.date,
        endDate: exam.date,
        recurrenceUntil: exam.date,
        timezone: KIEL_SOURCE_TIMEZONE,
        location: 'TBD',
        category: mapKindToCategory('Exam'),
        notes: null,
        metadata: {
          sessionType: 'review',
        },
        createdAt: nowIso,
        updatedAt: nowIso,
      })
    }
  }

  return {
    protocolVersion: 'v1',
    courses: courses.sort((left, right) => left.code.localeCompare(right.code)),
    schedules: schedules.sort(
      (left, right) =>
        (left.entityId || '').localeCompare(right.entityId ?? '')
        || getScheduleSortRank(left) - getScheduleSortRank(right)
        || left.dayOfWeek - right.dayOfWeek
        || left.startAt.localeCompare(right.startAt),
    ),
    sessions: sessions.sort((left, right) =>
      (left.startAt || '').localeCompare(right.startAt || ''),
    ),
  }
}
