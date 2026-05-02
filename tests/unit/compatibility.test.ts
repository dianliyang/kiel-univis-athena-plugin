import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'

import plugin from '../../src/index.js'

async function readFixture(name: string) {
  return fs.readFile(new URL(`../../fixtures/${name}`, import.meta.url), 'utf8')
}

test('declares the expected Athena manifest compatibility fields', async () => {
  const manifest = JSON.parse(
    await fs.readFile(new URL('../../manifest.json', import.meta.url), 'utf8'),
  )

  assert.deepEqual(manifest.capabilities, ['writeCourses', 'writeSchedules'])
  assert.deepEqual(manifest.permissions, {
    getConfig: true,
    setConfig: false,
    readContent: false,
    fetch: true,
  })
  assert.deepEqual(manifest.network, {
    domains: ['univis.uni-kiel.de'],
  })
})

test('pull returns the Athena plugin envelope with imported course data', async () => {
  const overviewHtml = await readFixture('overview-fetch-response.html')
  const categoryHtml = await readFixture('category-fetch-response.html')
  const detailHtml = await readFixture('detail-fetch-response.html')
  const responses = [overviewHtml, categoryHtml, detailHtml]
  const requestedUrls: any[] = []

  const result = await plugin.pull({
    async getConfig() {
      return {
        language: 'en',
        semester: '2026s',
      }
    },
    async fetch({ url, method }: { url: string; method: string }) {
      requestedUrls.push({ url, method })
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

  assert.equal(result.protocolVersion, 'v1')
  assert.ok(Array.isArray(result.warnings))
  assert.equal(result.warnings!.length, 0)
  assert.equal(result.courses!.length, 1)
  assert.equal(result.schedules!.length, 3)
  assert.equal(result.courses![0].code, 'infAdvCry-01a')
  assert.equal(result.courses![0].metadata, null)
  assert.equal(result.schedules![0].entityType, 'course')
  assert.equal(requestedUrls.length, 3)
  assert.deepEqual(
    requestedUrls.map(request => request.method),
    ['GET', 'GET', 'GET'],
  )
})

test('pull uses a configurable request path while keeping the fixed UnivIS host', async () => {
  const overviewHtml = await readFixture('overview-fetch-response.html')
  const categoryHtml = await readFixture('category-fetch-response.html')
  const detailHtml = await readFixture('detail-fetch-response.html')
  const responses = [overviewHtml, categoryHtml, detailHtml]
  const requestedUrls: any[] = []

  await plugin.pull({
    async getConfig() {
      return {
        language: 'en',
        semester: '2026s',
        requestPath: '/catalog',
      }
    },
    async fetch({ url, method }: { url: string; method: string }) {
      requestedUrls.push({ url, method })
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

  assert.match(
    requestedUrls[0].url,
    /^https:\/\/univis\.uni-kiel\.de\/catalog\//,
  )
  assert.equal(new URL(requestedUrls[0].url).hostname, 'univis.uni-kiel.de')
  assert.deepEqual(
    requestedUrls.map(request => request.method),
    ['GET', 'GET', 'GET'],
  )
})

test('push returns Athena-compatible summary and ignores sessions', async () => {
  const result = await plugin.push(
    {} as any,
    {
      courses: [{ id: 'course-1' }] as any,
      schedules: [{ id: 'schedule-1' }] as any,
      sessions: [{ id: 'session-1' }] as any,
    },
  )

  assert.deepEqual(result, {
    protocolVersion: 'v1',
    summary: {
      courses: 1,
      schedules: 1,
      sessions: 0,
    },
    warnings: [
      'Kiel UnivIS push is metadata-only. Remote UnivIS data was not modified.',
      'Ignored 1 session record(s) because the plugin does not write sessions.',
    ],
  })
})
