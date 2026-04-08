import { readHtmlResponse } from './entities.mjs'
import { parseLectureDetailHtml } from './univis-parse.mjs'

export async function resolveAssignedLectureSchedules({
  lecture,
  detail,
  fetchImpl,
  sourceBaseUrl = 'https://univis.uni-kiel.de',
  warnings,
}) {
  const resolvedSchedules = []
  const seenAssignedUrls = new Set()

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
