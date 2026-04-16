import { extractUrls } from './entities.mjs'
import {
  findFirstOccurrenceDate,
  KIEL_SOURCE_TIMEZONE,
  toAllDayEndIso,
  toAllDayStartIso,
  zonedDateTimeToIso,
} from './time.mjs'
import {
  getExamDisplayLabel,
  getSessionTypeForKind,
  mapKindToCategory,
} from './univis-normalize.mjs'

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildCourseId(university, detail) {
  const stableKey = detail.code ?? detail.number ?? detail.title
  return `course-${slugify(university)}-${slugify(stableKey)}`
}

function getScheduleSortRank(schedule) {
  if (schedule.sessionType === 'review') {
    return 0
  }

  return schedule.allDay ? 2 : 1
}

export function buildKielCourseImport(
  lectureDetails,
  { university = 'Kiel University (CAU)', latestTerm = null } = {},
) {
  const nowIso = new Date().toISOString()
  const courses = []
  const schedules = []
  const sessions = []

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
      code: detail.code,
      title: detail.title,
      department: detail.department ?? 'Department of Computer Science',
      level: 'master',
      credit: detail.credit,
      instructors: detail.instructors,
      latestSemester: latestTerm ? { label: latestTerm } : null,
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
      const normalizedStartAt = hasConcreteTime ? schedule.startTime : '00:00'
      const normalizedEndAt = hasConcreteTime ? schedule.endTime : '23:59'
      const startAt = hasConcreteTime
        ? zonedDateTimeToIso(
            firstDate,
            schedule.startTime,
            KIEL_SOURCE_TIMEZONE,
          )
        : toAllDayStartIso(firstDate)
      const endAt = hasConcreteTime
        ? zonedDateTimeToIso(firstDate, schedule.endTime, KIEL_SOURCE_TIMEZONE)
        : toAllDayEndIso(firstDate)
      const recurrenceUntil = hasConcreteTime
        ? zonedDateTimeToIso(
            schedule.endDate,
            schedule.endTime,
            KIEL_SOURCE_TIMEZONE,
          )
        : toAllDayEndIso(schedule.endDate)

      if (!startAt || !endAt) {
        continue
      }

      schedules.push({
        id: `schedule-${slugify(`${courseId}-${schedule.kindLabel}-${index}`)}`,
        entityType: 'course',
        entityId: courseId,
        title: detail.title,
        dayOfWeek:
          schedule.dayOfWeek
          ?? new Date(`${firstDate}T00:00:00.000Z`).getUTCDay(),
        allDay: !hasConcreteTime,
        startAt: normalizedStartAt,
        endAt: normalizedEndAt,
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        recurrenceUntil,
        timezone: KIEL_SOURCE_TIMEZONE,
        location: normalizedLocation,
        category: mapKindToCategory(schedule.kindLabel),
        sessionType: getSessionTypeForKind(schedule.kindLabel),
        notes: null,
        metadata: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
    }

    for (const [index, exam] of detail.exams.entries()) {
      const examDisplayLabel = getExamDisplayLabel(exam.label)
      const allDay = !exam.startTime || !exam.endTime
      const startAt = allDay
        ? toAllDayStartIso(exam.date)
        : zonedDateTimeToIso(exam.date, exam.startTime, KIEL_SOURCE_TIMEZONE)
      const endAt = allDay
        ? toAllDayEndIso(exam.date)
        : zonedDateTimeToIso(exam.date, exam.endTime, KIEL_SOURCE_TIMEZONE)

      if (!startAt || !endAt) {
        continue
      }

      schedules.push({
        id: `schedule-${slugify(`${courseId}-${exam.label}-${index}`)}`,
        entityType: 'course',
        entityId: courseId,
        title: `${detail.title} · ${examDisplayLabel}`,
        dayOfWeek: new Date(startAt).getUTCDay(),
        allDay,
        startAt,
        endAt,
        startDate: exam.date,
        endDate: exam.date,
        recurrenceUntil: endAt,
        timezone: KIEL_SOURCE_TIMEZONE,
        location: 'TBD',
        category: mapKindToCategory('Exam'),
        sessionType: 'review',
        notes: null,
        metadata: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
    }
  }

  return {
    courses: courses.sort((left, right) => left.code.localeCompare(right.code)),
    schedules: schedules.sort(
      (left, right) =>
        left.entityId.localeCompare(right.entityId ?? '')
        || getScheduleSortRank(left) - getScheduleSortRank(right)
        || left.dayOfWeek - right.dayOfWeek
        || left.startAt.localeCompare(right.startAt),
    ),
    sessions: sessions.sort((left, right) =>
      left.startAt.localeCompare(right.startAt),
    ),
  }
}
