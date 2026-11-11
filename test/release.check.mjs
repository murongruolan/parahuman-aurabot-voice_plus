import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { createModules } from '../upstream/src/core/modules.js'
import builtinVoice from '../upstream/src/modules/voice/index.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const release = join(root, 'dist', 'aurabot-breezeblue-voice-1.2.0')
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
  core.modules = mods
  await mods.boot()
  assert.equal(mods.running('voice'), 'user')
  const req = (method, body) => ({ method, body, socket: { remoteAddress: '127.0.0.1' }, headers: { host: 'localhost:5099' } })
  const route = (path, method, body) => mods.handle('/aurabot/api/ext/breeze-settings' + path, req(method, body), {})
  const status = await route('/console/status', 'GET')
  assert.equal(status.ok, true); assert.equal(status.actualMode, 'enhanced'); assert.equal(status.enhancedAvailable, true)
  assert.equal(status.settings.apiKey, ''); assert.equal(status.settings.apiKeySet, true)
  const saved = await route('/console/save', 'POST', { revision: status.revision, settings: { speed: 0.9 }, original: { engine: 'windows' } })
  assert.equal(saved.ok, true); assert.equal(cfg.ext['breeze-settings'].speed, 0.9); assert.equal(cfg.voice.engine, 'windows')
  const off = await route('/console/mode', 'POST', { revision: saved.revision, mode: 'off' })
  assert.equal(off.ok, true); assert.equal(off.actualMode, 'off'); assert.equal(cfg.voice.enabled, false); assert.equal(mods.running('voice'), null)
  const back = await route('/console/mode', 'POST', { revision: off.revision, mode: 'enhanced' })
  assert.equal(back.ok, true); assert.equal(back.actualMode, 'enhanced'); assert.equal(cfg.voice.enabled, true)
  assert.equal(cfg.modules.voice.useBuiltin, false); assert.equal(mods.running('voice'), 'user')
  const wav = readFileSync(join(release, '试听样本', '玉玲珑-早上好.wav'))
  globalThis.fetch = async (url, init) => {
    assert.match(String(url), /^https:\/\/api\.breeze\.blue\/v1\/text-to-speech\/voc_release\?/)
    calls.push({ text: JSON.parse(init.body).text, method: init.method })
    return new Response(wav, { headers: { 'content-type': 'audio/wav' } })
  }
  const result = await mods.use('voice').speak('发行包验证')
  assert.equal(result.engine, 'breezeblue'); assert.deepEqual(readFileSync(result.file), wav)
  const preview = await mods.handle('/aurabot/api/ext/breeze-settings/breeze/test', req('POST', { text: '成品试听' }), {})
  assert.equal(preview.ok, true); assert.equal(preview.engine, 'breezeblue')
  const current = await route('/console/status', 'GET')
  const actualPreview = await route('/console/test', 'POST', { revision: current.revision, text: '控制台试听' })
  assert.equal(actualPreview.ok, true); assert.equal(actualPreview.engine, 'breezeblue'); assert.equal(actualPreview.mime, 'audio/wav')
  assert.deepEqual(calls, [{ text: '发行包验证', method: 'POST' }, { text: '成品试听', method: 'POST' }, { text: '控制台试听', method: 'POST' }])
})
