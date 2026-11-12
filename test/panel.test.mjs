import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../modules/breeze-settings/panel.js', import.meta.url), 'utf8')

test('panel compiles under the host new Function contract', () => {
  const C = new Function('React', 'h', 'ui', 'call', source)(null, null, null, null)
  assert.equal(typeof C, 'function')
})
test('panel source references the expected route surface', () => {
  assert.ok(source.includes('/console/status')); assert.ok(source.includes('/console/save'))
  assert.ok(source.includes('/breeze/status')); assert.ok(source.includes('/console/test'))
  assert.ok(source.includes('engine-auth') === false, 'keys never referenced in panel')
})