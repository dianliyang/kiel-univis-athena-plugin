import { readHtmlResponse } from '../utils/entities.js'
import { parseLectureDetailHtml } from './univis-parse.js'
import { UnivisLectureDetail, UnivisLectureRow, UnivisSchedule } from '../types/univis.js'

export async function resolveAssignedLectureSchedules({
  lecture,
  detail,
  fetchImpl,
  sourceBaseUrl = 'https://univis.uni-kiel.de',
  warnings,
}: {
  lecture: UnivisLectureRow
  detail: UnivisLectureDetail
  fetchImpl: (url: string) => Promise<any>
  sourceBaseUrl?: string
  warnings: string[]
}): Promise<UnivisSchedule[]> {
  const resolvedSchedules: UnivisSchedule[] = []
  const seenAssignedUrls = new Set<string>()

  for (const assignedLecture of detail.assignedLectures ?? []) {
    if (!assignedLecture.detailUrl) {
      resolvedSchedules.push(...assignedLecture.schedules)
      continue
    }

    if (seenAssignedUrls.has(assignedLecture.detailUrl)) {
      continue
    }
    seenAssignedUrls.add(assignedLecture.detailUrl)

    try {
      const assignedResponse = await fetchImpl(assignedLecture.detailUrl)
      const assignedHtml = await readHtmlResponse(assignedResponse)
      const assignedDetail = parseLectureDetailHtml(assignedHtml, {
        categoryTitle: lecture.categoryTitle,
        allCategories: lecture.allCategories,
        detailUrl: assignedLecture.detailUrl,
        sourceBaseUrl,
      })
      const usableAssignedSchedules
        = assignedDetail.primarySchedules?.filter(
          schedule => !!schedule.startDate && !!schedule.endDate,
        ) ?? []

      if (usableAssignedSchedules.length === 0) {
        warnings.push(
          `Skipped assigned lecture detail for ${lecture.code}: no usable schedule range at ${assignedLecture.detailUrl}`,
        )
        continue
      }

      resolvedSchedules.push(...usableAssignedSchedules)
    }
    catch (error) {
      warnings.push(
        `Skipped assigned lecture detail for ${lecture.code}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      )
    }
  }

  return resolvedSchedules
}
