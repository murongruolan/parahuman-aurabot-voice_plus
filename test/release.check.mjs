import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { createModules } from '../upstream/src/core/modules.js'
import builtinVoice from '../upstream/src/modules/voice/index.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const release = join(root, 'dist', 'aurabot-breezeblue-voice-1.0.0')
const isolated = mkdtempSync(join(root, 'artifacts', 'release-fixture-'))
const modulesDir = join(isolated, 'modules')
mkdirSync(modulesDir)
writeFileSync(join(modulesDir, 'API.md'), 'fixture official user module marker')
writeFileSync(join(modulesDir, 'aurabot.d.ts'), '// fixture')
const { install } = await import(pathToFileURL(join(release, 'install.mjs')))
let mods
const oldData = process.env.AURABOT_DATA_DIR, oldGlobal = globalThis.aurabot, oldFetch = globalThis.fetch
const calls = []
after(() => {
  mods?.dispose(); globalThis.fetch = oldFetch
  if (oldData === undefined) delete process.env.AURABOT_DATA_DIR; else process.env.AURABOT_DATA_DIR = oldData
  if (oldGlobal === undefined) delete globalThis.aurabot; else globalThis.aurabot = oldGlobal
  rmSync(isolated, { recursive: true, force: true })
})
test('release checksums verify and installer targets only the isolated fixture', async () => {
  for (const line of readFileSync(join(release, 'SHA256SUMS.txt'), 'utf8').trim().split('\n')) {
    const [hash, path] = line.split('  ')
    assert.equal(createHash('sha256').update(readFileSync(join(release, path))).digest('hex'), hash, path)
  }
  assert.equal(install({ packageDir: release, modulesDir }).mode, 'check-only')
  assert.ok(!readdirSync(modulesDir).includes('voice'))
  assert.equal(install({ packageDir: release, modulesDir, apply: true }).mode, 'installed')
  assert.throws(() => install({ packageDir: release, modulesDir, apply: true }), /already exists/)
})
test('installed release loads and serves voice through official module loader', async () => {
  process.env.AURABOT_DATA_DIR = isolated
  let cfg = { modules: {}, ext: { 'breeze-settings': { provider: 'breezeblue', apiKey: 'brz_release_fixture_only', voiceId: 'voc_release' } }, voice: { enabled: true } }
  const silent = { info() {}, warn() {}, error() {}, debug() {} }
  const core = { local: { active: () => false }, hub: {}, onebot: {}, http: { body: async req => req.body || {} } }
  mods = createModules({ ctx: { get: () => null }, core, getConfig: () => cfg, setConfig: x => (cfg = x), logger: { child: () => silent }, version: '1.2.0', builtins: [builtinVoice] })
  await mods.boot()
  assert.equal(mods.running('voice'), 'user')
  const wav = readFileSync(join(release, '试听样本', '玉玲珑-早上好.wav'))
  globalThis.fetch = async (url, init) => {
    assert.match(String(url), /^https:\/\/api\.breeze\.blue\/v1\/text-to-speech\/voc_release\?/)
    calls.push({ text: JSON.parse(init.body).text, method: init.method })
    return new Response(wav, { headers: { 'content-type': 'audio/wav' } })
  }
  const result = await mods.use('voice').speak('发行包验证')
  assert.equal(result.engine, 'breezeblue'); assert.deepEqual(readFileSync(result.file), wav)
  const preview = await mods.handle('/aurabot/api/ext/breeze-settings/breeze/test', { body: { text: '成品试听' }, method: 'POST', socket: { remoteAddress: '127.0.0.1' }, headers: { host: 'localhost:5099' } }, {})
  assert.equal(preview.ok, true); assert.equal(preview.engine, 'breezeblue')
  assert.deepEqual(calls, [{ text: '发行包验证', method: 'POST' }, { text: '成品试听', method: 'POST' }])
})
