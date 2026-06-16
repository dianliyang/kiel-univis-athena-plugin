import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'

import plugin from '../../src/index.js'
import { fetchKielUnivisCourses } from '../../src/fetcher.js'
import {
  parseCategoryLectureRows,
  parseDegreeNode,
  parseLectureDetailHtml,
  parseOverviewCategories,
} from '../../src/parsing/univis-parse.js'

async function readFixture(name: string) {
  return fs.readFile(new URL(`../../fixtures/${name}`, import.meta.url), 'utf8')
}

test('pulls a course from overview, category, and detail fixtures', async () => {
  const overviewHtml = await readFixture('overview-fetch-response.html')
  const categoryHtml = await readFixture('category-fetch-response.html')
  const detailHtml = await readFixture('detail-fetch-response.html')
  const responses = [overviewHtml, categoryHtml, detailHtml]

  const result = await plugin.tools[0].execute({
    async getConfig() {
      return {
        language: 'en',
        semester: '2026s',
      }
    },
    async fetch({ url }: { url: string }) {
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
  } as any)

  const data = result.data as any

  assert.equal(data.courses.length, 1)
  assert.equal(data.courses[0].code, 'infAdvCry-01a')
  assert.equal(data.courses[0].title, 'Advanced Cryptography')
  assert.equal(data.schedules.length, 3)
})

test('dedupes assigned lecture pages and keeps the authoritative schedule range', async () => {
  const detailHtml = await readFixture('detail-assigned-discovery.html')
  const assignedHtml = await readFixture('detail-assigned-target.html')
  const overviewHtml = await readFixture('overview-assigned-fetch-response.html')
  const categoryHtml = await readFixture('category-assigned-fetch-response.html')
  const fetchCalls: string[] = []
  const responsesByUrl = new Map([
    ['overview', overviewHtml],
    ['https://univis.uni-kiel.de/category', categoryHtml],
    ['https://univis.uni-kiel.de/category-assigned', categoryHtml],
    ['https://univis.uni-kiel.de/detail', detailHtml],
    ['https://univis.uni-kiel.de/form?exercise=infEdTechExercise', assignedHtml],
  ])

  const imported = await fetchKielUnivisCourses({
    fetchImpl: async (url: string, init?: RequestInit) => {
      const normalizedUrl = String(url)
      fetchCalls.push(normalizedUrl)
      let bodyText: string | undefined
      if (normalizedUrl.startsWith('https://univis.uni-kiel.de/form') && !normalizedUrl.includes('exercise=')) {
        assert.equal(init?.method, 'GET')
        assert.match(normalizedUrl, /sem=2026s/)
        assert.match(normalizedUrl, /tdir=techn%2Finfora%2Fmaster/)
        bodyText = responsesByUrl.get('overview')
      } else {
        bodyText = responsesByUrl.get(normalizedUrl)
      }
      if (!bodyText) {
        throw new Error(`Unexpected URL: ${normalizedUrl}`)
      }

      return {
        headers: {
          get(name: string) {
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

  const exerciseSchedules = imported.schedules!.filter(
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

test('parses the full computer science master degree node', () => {
  const html = `
    <h2>Master's degree program in computer science</h2>
    <A HREF="http://www.studservice.uni-kiel.de/sta/fachpruefungsordnung-informatik-master-1-fach-englisch.pdf">Degree-Specific Examination Regulations (FPO) for Computer Science (1-subject, Master)</A>
    <br><A HREF="http://www.studservice.uni-kiel.de/sta/pruefungsverfahrensordnung-bachelor-master-englisch.pdf">Examination Procedure Regulations at Kiel University for Students of Bachelors's and Master's Degree Programmes</A>
    <ul>
      <li><a href="form?tdir=techn/infora/master/theore">Theoretical Computer Science</a></li>
      <li><a href="form?tdir=techn/infora/master/wahlpf">Compulsory elective modules in Computer Science</a></li>
      <li><a href="form?tdir=techn/infora/master/master_1">Seminar</a></li>
      <li><a href="form?tdir=techn/infora/master/master_2">Advanced Project</a></li>
      <li><a href="form?tdir=techn/infora/master/mitarb">Involvement in a working group</a></li>
      <li><a href="form?tdir=techn/infora/master/master_3">Master Thesis Supervision Seminar</a></li>
      <li><a href="form?tdir=techn/infora/master/integr">Open Elective</a></li>
      <li><a href="form?tdir=techn/infora/master/kolloq">Colloquia and study groups</a></li>
    </ul>
  `

  const degreeNode = parseDegreeNode(html, 'https://univis.uni-kiel.de')

  assert.equal(degreeNode.title, "Master's degree program in computer science")
  assert.deepEqual(
    degreeNode.documents.map(document => document.title),
    [
      'Degree-Specific Examination Regulations (FPO) for Computer Science (1-subject, Master)',
      "Examination Procedure Regulations at Kiel University for Students of Bachelors's and Master's Degree Programmes",
    ],
  )
  assert.deepEqual(
    degreeNode.categories.map(category => category.title),
    [
      'Theoretical Computer Science',
      'Compulsory elective modules in Computer Science',
      'Seminar',
      'Advanced Project',
      'Involvement in a working group',
      'Master Thesis Supervision Seminar',
      'Open Elective',
      'Colloquia and study groups',
    ],
  )
})

test('overview categories are no longer restricted to lecture module buckets', async () => {
  const overviewHtml = await readFixture('overview-fetch-response.html')

  const categories = parseOverviewCategories(
    overviewHtml.replace(
      '</ul>',
      '<li><a href="form?tdir=techn/infora/master/master_1">Seminar</a></li></ul>',
    ),
    'https://univis.uni-kiel.de',
  )

  assert.ok(categories.some(category => category.title === 'Seminar'))
})

test('category lecture rows include seminar categories', () => {
  const rows = parseCategoryLectureRows(
    `
      <h4>
        <a href="form?dsc=anew/lecture_view&lvs=seminar">infSemDaSci-01a: Master Seminar - Data Science</a>
      </h4>
      <small>S; 2 cred.h; ECTS: 5; Mon, 14:15 - 15:45; from 18.10.2026 to 7.2.2027</small>
    `,
    {
      categoryTitle: 'Seminar',
      sourceBaseUrl: 'https://univis.uni-kiel.de',
    },
  )

  assert.equal(rows.length, 1)
  assert.equal(rows[0].code, 'infSemDaSci-01a')
})

test('detail parser preserves seminar schedule kind', () => {
  const detail = parseLectureDetailHtml(
    `
      <h3>infSemDaSci-01a: Master Seminar - Data Science (infSemDaSci-01a) (080080)</h3>
      <dl>
        <dt><b>Details</b></dt>
        <dd>
          Seminar<br>
          Time and place: Mon 14:15 - 15:45, CAP4 - R.715<br>
          from 18.10.2026 to 7.2.2027<br>
          ECTS credits: 5
        </dd>
      </dl>
    `,
    {
      categoryTitle: 'Seminar',
      allCategories: ['Seminar'],
      detailUrl: 'https://univis.uni-kiel.de/form?seminar',
    },
  )

  assert.equal(detail.primarySchedules[0].kindLabel, 'Seminar')
})
