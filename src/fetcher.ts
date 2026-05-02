import { resolveAssignedLectureSchedules } from './parsing/assigned-resolution.js'
import { buildKielCourseImport } from './mapping/athena-map.js'
import { readHtmlResponse } from './utils/entities.js'
import { COURSE_CATEGORY_TITLES } from './parsing/univis-normalize.js'
import {
  buildKielOverviewUrl,
  mergeLectureSummaries,
  parseCategoryLectureRows,
  parseLectureDetailHtml,
  parseOverviewCategories,
} from './parsing/univis-parse.js'
import { PluginPullResult } from './types/athena.js'

export async function fetchKielUnivisCourses({
  fetchImpl = fetch,
  language = 'en',
  semester = '2026s',
  requestPath = '/formbot',
  sourceBaseUrl = 'https://univis.uni-kiel.de',
}: {
  fetchImpl?: (url: string) => Promise<any>
  language?: string
  semester?: string
  requestPath?: string
  sourceBaseUrl?: string
} = {}): Promise<PluginPullResult> {
  const overviewResponse = await fetchImpl(
    buildKielOverviewUrl({ language, semester, requestPath }),
  )
  const overviewHtml = await readHtmlResponse(overviewResponse)
  const categories = parseOverviewCategories(
    overviewHtml,
    sourceBaseUrl,
  ).filter(category => COURSE_CATEGORY_TITLES.has(category.title))

  const summaries = []
  const warnings: string[] = []

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

  const result = buildKielCourseImport(details as any, {
    university: 'Kiel University (CAU)',
    latestTerm: semester,
  })

  return {
    ...result,
    warnings,
  }
}
