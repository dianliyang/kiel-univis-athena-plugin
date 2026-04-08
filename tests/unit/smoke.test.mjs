import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'

import plugin from '../../index.mjs'

test('exports the kiel univis plugin runtime entrypoints', () => {
  assert.equal(typeof plugin.pull, 'function')
  assert.equal(typeof plugin.push, 'function')
})

test('ships the expected manifest metadata', async () => {
  const manifest = JSON.parse(
    await fs.readFile(new URL('../../manifest.json', import.meta.url), 'utf8'),
  )

  assert.equal(manifest.id, 'kiel-univis-courses')
  assert.ok(Array.isArray(manifest.capabilities))
  assert.ok(manifest.permissions)
  assert.equal(manifest.permissions.getConfig, true)
  assert.equal(manifest.permissions.fetch, true)
})
