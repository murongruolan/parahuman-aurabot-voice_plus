import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { install } from '../scripts/install.mjs'

const root = mkdtempSync(join(tmpdir(), 'breeze-install-tests-'))
after(() => rmSync(root, { recursive: true, force: true }))
let n = 0
function fixture() {
  const home = join(root, String(++n)), packageDir = join(home, 'release'), modulesDir = join(home, 'target', 'modules')
  mkdirSync(modulesDir, { recursive: true })
  const modules = ['voice', 'breeze-settings'].map(id => {
    mkdirSync(join(packageDir, id), { recursive: true })
    const entries = { 'index.mjs': `export default {id:'${id}',setup(){return {}}}`, 'package.json': '{"type":"module"}' }
    const files = Object.entries(entries).map(([path, content]) => {
      writeFileSync(join(packageDir, id, path), content)
      return { path, sha256: createHash('sha256').update(content).digest('hex') }
    })
    return { id, files }
  })
  const manifest = { id: 'aurabot-breezeblue-voice', modules }
  writeFileSync(join(packageDir, 'MODULE-FILES.sha256.json'), JSON.stringify(manifest))
  writeFileSync(join(modulesDir, 'API.md'), 'Aurabot API')
  writeFileSync(join(modulesDir, 'aurabot.d.ts'), '// types')
  writeFileSync(join(home, 'target', 'config.json'), '{"existing":true}')
  return { home, packageDir, modulesDir, manifest }
}
test('installer defaults to check-only and never chooses a local DSH directory', () => {
  const f = fixture(), before = readdirSync(f.modulesDir)
  assert.throws(() => install({ packageDir: f.packageDir }), /absolute/)
  assert.throws(() => install({ packageDir: f.packageDir, modulesDir: 'modules' }), /absolute/)
  const result = install(f)
  assert.equal(result.mode, 'check-only'); assert.deepEqual(readdirSync(f.modulesDir), before)
})
test('explicit install copies both modules and never modifies existing configuration', () => {
  const f = fixture(), configFile = join(f.home, 'target', 'config.json'), before = readFileSync(configFile)
  const result = install({ ...f, apply: true })
  assert.equal(result.mode, 'installed'); assert.equal(result.files, 4); assert.equal(result.targets.length, 2)
  for (const id of ['voice', 'breeze-settings']) assert.deepEqual(readdirSync(join(f.modulesDir, id)).sort(), ['index.mjs', 'package.json'])
  assert.deepEqual(readFileSync(configFile), before)
  assert.ok(!readdirSync(f.modulesDir).some(p => p.startsWith('_breezeblue')))
})
for (const id of ['voice', 'breeze-settings']) test(`existing user ${id} is never overwritten, even if empty`, () => {
  const f = fixture(); mkdirSync(join(f.modulesDir, id))
  assert.throws(() => install({ ...f, apply: true }), /already exists/)
  writeFileSync(join(f.modulesDir, id, 'mine.txt'), 'important')
  assert.throws(() => install({ ...f, apply: true }), /already exists/)
  assert.equal(readFileSync(join(f.modulesDir, id, 'mine.txt'), 'utf8'), 'important')
  assert.equal(readdirSync(f.modulesDir).filter(x => ['voice', 'breeze-settings'].includes(x)).length, 1)
})
test('checksum failure in either module makes no destination changes', () => {
  const f = fixture(); writeFileSync(join(f.packageDir, 'breeze-settings', 'index.mjs'), 'changed')
  assert.throws(() => install({ ...f, apply: true }), /checksum/)
  assert.equal(existsSync(join(f.modulesDir, 'voice')), false)
  assert.equal(existsSync(join(f.modulesDir, 'breeze-settings')), false)
})
test('wrong target rejected before installing', () => {
  const f = fixture(); rmSync(join(f.modulesDir, 'aurabot.d.ts'))
  assert.throws(() => install({ ...f, apply: true }), /user modules directory/)
  assert.equal(existsSync(join(f.modulesDir, 'voice')), false)
})
test('unexpected credential/cache files in package rejected', () => {
  const f = fixture(); writeFileSync(join(f.packageDir, 'voice', 'secret.json'), '{}')
  assert.throws(() => install({ ...f, apply: true }), /Unexpected files/)
  assert.equal(existsSync(join(f.modulesDir, 'voice')), false)
})
test('traversal and duplicate manifest entries rejected', () => {
  const f = fixture(), original = f.manifest.modules[0].files
  for (const files of [[{ path: '../outside', sha256: 'a'.repeat(64) }], [original[0], original[0]]]) {
    f.manifest.modules[0].files = files
    writeFileSync(join(f.packageDir, 'MODULE-FILES.sha256.json'), JSON.stringify(f.manifest))
    assert.throws(() => install({ ...f, apply: true }), /Unsafe manifest/)
  }
})
test('incomplete or extra module manifests are rejected', () => {
  const f = fixture()
  f.manifest.modules.pop()
  writeFileSync(join(f.packageDir, 'MODULE-FILES.sha256.json'), JSON.stringify(f.manifest))
  assert.throws(() => install({ ...f, apply: true }), /Invalid package/)
})
