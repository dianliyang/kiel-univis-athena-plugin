import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'

import plugin from '../../index.mjs'
import {
  fetchKielUnivisCourses,
  parseLectureDetailHtml,
} from '../../lib.mjs'

async function readFixture(name) {
  return fs.readFile(new URL(`../../fixtures/${name}`, import.meta.url), 'utf8')
}

test('pulls a course from overview, category, and detail fixtures', async () => {
  const overviewHtml = await readFixture('overview-fetch-response.html')
  const categoryHtml = await readFixture('category-fetch-response.html')
  const detailHtml = await readFixture('detail-fetch-response.html')
  const responses = [overviewHtml, categoryHtml, detailHtml]

  const result = await plugin.pull({
    async getConfig() {
      return {
        language: 'en',
        semester: '2026s',
      }
    },
    async fetch({ url }) {
      const bodyText = responses.shift()
      if (!bodyText) {
        throw new Error(`Unexpected fetch: ${url}`)
      }

      return {
        status: 200,
        finalUrl: url,
        headers: {
          'content-type': 'text/html; charset=utf-8',
        },
        bodyText,
      }
    },
  })

  assert.equal(result.courses.length, 1)
  assert.equal(result.courses[0].code, 'infAdvCry-01a')
  assert.equal(result.courses[0].title, 'Advanced Cryptography')
  assert.equal(result.schedules.length, 3)
})

test('dedupes assigned lecture pages and keeps the authoritative schedule range', async () => {
  const detailHtml = await readFixture('detail-assigned-discovery.html')
  const assignedHtml = await readFixture('detail-assigned-target.html')
  const overviewHtml = await readFixture('overview-assigned-fetch-response.html')
  const categoryHtml = await readFixture('category-assigned-fetch-response.html')
  const fetchCalls = []
  const responsesByUrl = new Map([
    [
      'https://univis.uni-kiel.de/formbot/dsc_3Danew_2Ftlecture_26tdir_3Dtechn_2Finfora_2Fmaster_26lang_3Den_26ref_3Dtlecture_26sem_3D2026s',
      overviewHtml,
    ],
    ['https://univis.uni-kiel.de/category', categoryHtml],
    ['https://univis.uni-kiel.de/category-assigned', categoryHtml],
    ['https://univis.uni-kiel.de/detail', detailHtml],
    ['https://univis.uni-kiel.de/form?exercise=infEdTechExercise', assignedHtml],
  ])

  const imported = await fetchKielUnivisCourses({
    fetchImpl: async (url) => {
      const normalizedUrl = String(url)
      fetchCalls.push(normalizedUrl)
      const bodyText = responsesByUrl.get(normalizedUrl)
      if (!bodyText) {
        throw new Error(`Unexpected URL: ${normalizedUrl}`)
      }

      return {
        headers: {
          get(name) {
            return /content-type/i.test(name)
              ? 'text/html; charset=utf-8'
              : null
          },
        },
        async text() {
          return bodyText
        },
      }
    },
  })

  const exerciseSchedules = imported.schedules.filter(
    schedule => schedule.metadata?.sessionType === 'tutorial',
  )

  assert.equal(
    fetchCalls.filter(
      url => url === 'https://univis.uni-kiel.de/form?exercise=infEdTechExercise',
    ).length,
    1,
  )
  assert.equal(exerciseSchedules.length, 1)
  assert.equal(exerciseSchedules[0].startDate, '2025-12-08')
  assert.equal(exerciseSchedules[0].endDate, '2026-02-08')
  assert.equal(exerciseSchedules[0].startAt, '14:15')
  assert.equal(exerciseSchedules[0].endAt, '15:45')
})

test('normalizes detail headings with trailing codes and import markers', async () => {
  const detailHtml = await readFixture('detail-heading-import.html')
  const detail = parseLectureDetailHtml(detailHtml, {
    categoryTitle: 'Compulsory elective modules in Computer Science',
    allCategories: ['Compulsory elective modules in Computer Science'],
    detailUrl: 'https://univis.uni-kiel.de/form?lecture=infTML',
  })

  assert.equal(detail.title, 'Theory of Machine Learning')
  assert.equal(detail.code, 'infTML-01a')
  assert.equal(detail.number, '080268')
})
