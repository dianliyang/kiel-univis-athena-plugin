import { resolveAssignedLectureSchedules } from './assigned-resolution.mjs'
import { buildKielCourseImport } from './athena-map.mjs'
import { readHtmlResponse } from './entities.mjs'
import { COURSE_CATEGORY_TITLES } from './univis-normalize.mjs'
import {
  buildKielOverviewUrl,
  mergeLectureSummaries,
  parseCategoryLectureRows,
  parseLectureDetailHtml,
  parseOverviewCategories,
} from './univis-parse.mjs'

export { buildKielCourseImport } from './athena-map.mjs'
export { decodeHtmlEntities } from './entities.mjs'
export {
  buildKielOverviewUrl,
  mergeLectureSummaries,
  parseCategoryLectureRows,
  parseLectureDetailHtml,
  parseOverviewCategories,
} from './univis-parse.mjs'

export async function fetchKielUnivisCourses({
  fetchImpl = fetch,
  language = 'en',
  semester = '2026s',
  sourceBaseUrl = 'https://univis.uni-kiel.de',
} = {}) {
  const overviewResponse = await fetchImpl(
    buildKielOverviewUrl({ language, semester }),
  )
  const overviewHtml = await readHtmlResponse(overviewResponse)
  const categories = parseOverviewCategories(
    overviewHtml,
    sourceBaseUrl,
  ).filter(category => COURSE_CATEGORY_TITLES.has(category.title))

  const summaries = []
  const warnings = []

  for (const category of categories) {
    const categoryResponse = await fetchImpl(category.url)
    const categoryHtml = await readHtmlResponse(categoryResponse)
    summaries.push(
      ...parseCategoryLectureRows(categoryHtml, {
        categoryTitle: category.title,
        sourceBaseUrl,
      }),
    )
  }

  const mergedLectures = mergeLectureSummaries(summaries)
  const details = []

  for (const lecture of mergedLectures) {
    try {
      const detailResponse = await fetchImpl(lecture.detailUrl)
      const detailHtml = await readHtmlResponse(detailResponse)
      const detail = parseLectureDetailHtml(detailHtml, {
        categoryTitle: lecture.categoryTitle,
        allCategories: lecture.allCategories,
        detailUrl: lecture.detailUrl,
        sourceBaseUrl,
      })
      const assignedPageSchedules = await resolveAssignedLectureSchedules({
        lecture,
        detail,
        fetchImpl,
        sourceBaseUrl,
        warnings,
      })

      details.push({
        ...detail,
        code: detail.code ?? lecture.code,
        title: lecture.title ?? detail.title,
        schedules: [...(detail.primarySchedules ?? []), ...assignedPageSchedules],
      })
    }
    catch (error) {
      warnings.push(
        `Skipped lecture detail for ${lecture.code}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      )
    }
  }

  return {
    ...buildKielCourseImport(details, {
      university: 'Kiel University (CAU)',
      latestTerm: semester,
    }),
    warnings,
  }
}
