import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'

import plugin from '../../src/index.js'

test('exports the kiel univis plugin agent tool runtime', () => {
  assert.equal(Array.isArray(plugin.tools), true)
  assert.equal(plugin.tools[0].name, 'retrieve_kiel_univis_courses')
  assert.equal(typeof plugin.tools[0].execute, 'function')
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
  assert.ok(
    plugin.config.some(
      field =>
        field.key === 'requestPath'
        && field.defaultValue === '/formbot',
    ),
  )
})

test('defines release packaging scripts for plugin and MCP zip assets', async () => {
  const pkg = JSON.parse(
    await fs.readFile(new URL('../../package.json', import.meta.url), 'utf8'),
  )

  assert.equal(typeof pkg.scripts['package:release'], 'string')
  assert.match(pkg.scripts['package:release'], /zip/i)
  assert.match(pkg.scripts['package:release'], /kiel-univis-courses\.zip/)
  assert.match(pkg.scripts['package:release'], /kiel-univis-mcp\.zip/)
  assert.match(pkg.scripts['package:release'], /manifest\.json/)
  assert.match(pkg.scripts['package:release'], /dist\/mcp\.mjs/)
  assert.equal(pkg.bin['kiel-univis-mcp'], 'dist/mcp.mjs')
})
