import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'

import plugin from '../../src/index.js'

async function readFixture(name: string) {
  return fs.readFile(new URL(`../../fixtures/${name}`, import.meta.url), 'utf8')
}

test('declares the expected Athena agent tool manifest fields', async () => {
  const manifest = JSON.parse(
    await fs.readFile(new URL('../../manifest.json', import.meta.url), 'utf8'),
  )

  assert.deepEqual(manifest.capabilities, ['agentTools'])
  assert.deepEqual(manifest.permissions, {
    getConfig: false,
    setConfig: false,
    fetch: true,
  })
  assert.deepEqual(manifest.network, {
    domains: ['univis.uni-kiel.de'],
  })
})

test('agent tool retrieves course data for review', async () => {
  const overviewHtml = await readFixture('overview-fetch-response.html')
  const categoryHtml = await readFixture('category-fetch-response.html')
  const detailHtml = await readFixture('detail-fetch-response.html')
  const responses = [overviewHtml, categoryHtml, detailHtml]
  const requestedUrls: any[] = []
  const tool = plugin.tools[0]

  const result = await tool.execute({
    async getConfig() {
      return {
        language: 'en',
        semester: '2026s',
      }
    },
    async fetch(request: { url: string; method: string; body?: string }) {
      const { url } = request
      requestedUrls.push(request)
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

  assert.equal(tool.name, 'retrieve_kiel_univis_courses')
  assert.match(result.content, /Retrieved 1 Kiel UnivIS course\(s\) and 3 schedule\(s\) for review/)
  assert.ok(Array.isArray(result.warnings))
  assert.equal(result.warnings.length, 0)
  assert.equal(data.courses.length, 1)
  assert.equal(data.schedules.length, 3)
  assert.equal(data.courses[0].code, 'infAdvCry-01a')
  assert.equal(data.courses[0].metadata, null)
  assert.equal(data.schedules[0].entityType, 'course')
  assert.equal(requestedUrls.length, 3)
  assert.deepEqual(
    requestedUrls.map(request => request.method),
    ['GET', 'GET', 'GET'],
  )
  assert.match(requestedUrls[0].url, /sem=2026s/)
  assert.match(requestedUrls[0].url, /tdir=techn%2Finfora%2Fmaster/)
})

test('agent tool uses a configurable request path while keeping the fixed UnivIS host', async () => {
  const overviewHtml = await readFixture('overview-fetch-response.html')
  const categoryHtml = await readFixture('category-fetch-response.html')
  const detailHtml = await readFixture('detail-fetch-response.html')
  const responses = [overviewHtml, categoryHtml, detailHtml]
  const requestedUrls: any[] = []

  await plugin.tools[0].execute({
    async getConfig() {
      return null
    },
    async fetch(request: { url: string; method: string; body?: string }) {
      const { url } = request
      requestedUrls.push(request)
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
  } as any, {
    requestPath: '/catalog',
  })

  assert.match(
    requestedUrls[0].url,
    /^https:\/\/univis\.uni-kiel\.de\/catalog/,
  )
  assert.equal(new URL(requestedUrls[0].url).hostname, 'univis.uni-kiel.de')
  assert.deepEqual(
    requestedUrls.map(request => request.method),
    ['GET', 'GET', 'GET'],
  )
  assert.match(requestedUrls[0].url, /sem=2026s/)
})

test('agent tool input overrides saved config for one retrieval', async () => {
  const requestedUrls: any[] = []

  await assert.rejects(
    () =>
      plugin.tools[0].execute(
        {
          async getConfig() {
            return {
              language: 'en',
              semester: '2026s',
              requestPath: '/formbot',
            }
          },
          async fetch(request: { url: string; method: string; body?: string }) {
            requestedUrls.push(request)
            throw new Error('stop after first request')
          },
        } as any,
        {
          language: 'de',
          semester: '2025w',
          requestPath: '/catalog',
          tdir: 'techn/infora/master/theore',
        },
      ),
    /stop after first request/,
  )

  const url = new URL(requestedUrls[0].url)
  assert.equal(url.hostname, 'univis.uni-kiel.de')
  assert.equal(url.pathname, '/catalog')
  assert.equal(requestedUrls[0].method, 'GET')
  assert.match(requestedUrls[0].url, /sem=2025w/)
  assert.match(requestedUrls[0].url, /tdir=techn%2Finfora%2Fmaster%2Ftheore/)
})
