import { resolveAssignedLectureSchedules } from './parsing/assigned-resolution.js'
import { buildKielCourseImport } from './mapping/athena-map.js'
import { readHtmlResponse } from './utils/entities.js'
import {
  buildKielOverviewRequest,
  mergeLectureSummaries,
  parseCategoryLectureRows,
  parseDegreeNode,
  parseLectureDetailHtml,
} from './parsing/univis-parse.js'
import { KielUnivisImportData } from './types/athena.js'

type FetchLike = (url: string, init?: RequestInit) => Promise<any>

export async function fetchKielUnivisCourses({
  fetchImpl = fetch,
  language = 'en',
  semester = '2026s',
  tdir = 'techn/infora/master',
  requestPath = '/form',
  sourceBaseUrl = 'https://univis.uni-kiel.de',
}: {
  fetchImpl?: FetchLike
  language?: string
  semester?: string
  tdir?: string
  requestPath?: string
  sourceBaseUrl?: string
} = {}): Promise<KielUnivisImportData> {
  const overviewRequest = buildKielOverviewRequest({ language, semester, tdir, requestPath })
  const overviewResponse = await fetchImpl(overviewRequest.url, overviewRequest.init)
  const overviewHtml = await readHtmlResponse(overviewResponse)
  const degreeNode = parseDegreeNode(
    overviewHtml,
    sourceBaseUrl,
  )
  const categories = degreeNode.categories

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
    documents: degreeNode.documents,
    warnings,
  }
}
