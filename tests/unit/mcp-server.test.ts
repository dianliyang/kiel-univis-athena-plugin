import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'

import {
  createKielUnivisMcpServer,
  listKielUnivisCoursesTool,
  searchKielUnivisCoursesTool,
} from '../../src/mcp.js'

async function readFixture(name: string) {
  return fs.readFile(new URL(`../../fixtures/${name}`, import.meta.url), 'utf8')
}

test('defines read-only MCP tools for listing and searching Kiel UnivIS courses', () => {
  const server = createKielUnivisMcpServer()

  assert.equal(server.server.getCapabilities().tools?.listChanged, true)
  assert.equal(listKielUnivisCoursesTool.name, 'list_kiel_univis_courses')
  assert.equal(searchKielUnivisCoursesTool.name, 'search_kiel_univis_courses')
  assert.match(listKielUnivisCoursesTool.description, /List Kiel UnivIS courses/i)
  assert.match(searchKielUnivisCoursesTool.description, /Search Kiel UnivIS courses/i)
})

test('list tool returns a readable course list without importing data', async () => {
  const overviewHtml = await readFixture('overview-fetch-response.html')
  const categoryHtml = await readFixture('category-fetch-response.html')
  const detailHtml = await readFixture('detail-fetch-response.html')
  const responses = [overviewHtml, categoryHtml, detailHtml]

  const result = await listKielUnivisCoursesTool.handler(
    { language: 'en', semester: '2026s', requestPath: '/formbot' },
    {
      fetchImpl: async () => {
        const body = responses.shift()
        if (!body) throw new Error('Unexpected fetch')
        return {
          headers: { get: () => 'text/html; charset=utf-8' },
          text: async () => body,
        } as Response
      },
    },
  )

  assert.equal(result.courses.length, 1)
  assert.match(result.content, /Found 1 Kiel UnivIS course/i)
  assert.match(result.content, /Advanced Cryptography/i)
  assert.doesNotMatch(result.content, /Imported/i)
})

test('search tool filters the retrieved course list', async () => {
  const overviewHtml = await readFixture('overview-fetch-response.html')
  const categoryHtml = await readFixture('category-fetch-response.html')
  const detailHtml = await readFixture('detail-fetch-response.html')
  const responses = [overviewHtml, categoryHtml, detailHtml]

  const result = await searchKielUnivisCoursesTool.handler(
    { query: 'cryptography', language: 'en', semester: '2026s', requestPath: '/formbot' },
    {
      fetchImpl: async () => {
        const body = responses.shift()
        if (!body) throw new Error('Unexpected fetch')
        return {
          headers: { get: () => 'text/html; charset=utf-8' },
          text: async () => body,
        } as Response
      },
    },
  )

  assert.equal(result.courses.length, 1)
  assert.match(result.content, /cryptography/i)
  assert.match(result.content, /Advanced Cryptography/i)
})

test('list tool forwards the requested UnivIS directory', async () => {
  const requests: Array<{ url: string, init?: RequestInit }> = []

  await assert.rejects(
    () =>
      listKielUnivisCoursesTool.handler(
        {
          language: 'en',
          semester: 'ws2026/27',
          requestPath: '/form',
          tdir: 'techn/infora/master/master_1',
        },
        {
          fetchImpl: async (url: string, init?: RequestInit) => {
            requests.push({ url, init })
            throw new Error('stop after first request')
          },
        },
      ),
    /stop after first request/,
  )

  assert.match(requests[0].url, /^https:\/\/univis\.uni-kiel\.de\/form/)
  assert.equal(requests[0].init?.method, 'GET')
  assert.match(requests[0].url, /sem=2026w/)
  assert.match(requests[0].url, /tdir=techn%2Finfora%2Fmaster%2Fmaster_1/)
})
