import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extensionPatch, originalPatch, modeConfig, requestedMode, consoleState, revision, saveConsole, emotionPatch } from '../modules/breeze-settings/control.mjs'
import { panelAccessError } from '../modules/breeze-settings/access.mjs'
import { DEFAULTS } from '../modules/breeze-settings/settings.mjs'

const config = () => ({ voice: { enabled: true, engine: 'http', songVoice: 'keep', http: { headers: 'secret-header', body: '{"text":"{text}"}' } },
  ext: { 'breeze-settings': { ...DEFAULTS, apiKey: 'brz_dummy_only', voiceId: 'voc_demo' }, other: { keep: true } }, modules: { voice: { enabled: true, useBuiltin: false }, other: { enabled: true } }, safeMode: false })
function apiFixture() {
  let cfg = config()
  return { config: () => cfg, settings: () => cfg.ext['breeze-settings'], setConfig: fn => { cfg = fn(cfg); return cfg },
    core: { local: { active: () => false }, modules: { status: () => [{ id: 'voice', running: cfg.modules.voice.enabled ? cfg.modules.voice.useBuiltin ? 'builtin' : 'user' : null, hasUser: true }] } } }
}
test('three mutually exclusive modes preserve all non-mode settings', () => {
  let cfg = config()
  for (const mode of ['official', 'off', 'enhanced']) {
    cfg = modeConfig(cfg, mode); assert.equal(requestedMode(cfg), mode)
    assert.equal(cfg.voice.songVoice, 'keep'); assert.equal(cfg.ext['breeze-settings'].apiKey, 'brz_dummy_only')
    assert.deepEqual(cfg.modules.other, { enabled: true }); assert.deepEqual(cfg.ext.other, { keep: true })
  }
})
test('unknown mode and safe-mode activation rejected', () => {
  assert.throws(() => modeConfig(config(), 'unknown'))
  assert.throws(() => modeConfig({ ...config(), safeMode: true }, 'enhanced'), /安全模式/)
})
test('Breeze validated patch preserves unknown legacy settings and blank key', () => {
  const old = { apiKey: 'secret', legacy: 2 }
  assert.deepEqual(extensionPatch({ speed: 0.9, apiKey: '' }, old), { ...old, speed: 0.9 })
  assert.equal(extensionPatch({ apiKey: null }, old).apiKey, '')
  for (const patch of [{ unknown: 1 }, { speed: 0 }, { speed: '1' }, { volume: 3 }, { provider: 'other' }, { voiceId: '../x' }, { languageCode: 'bad' }, { fallback: 'true' }]) assert.throws(() => extensionPatch(patch, old))
})
test('original patch allows only TTS parameters and preserves RVC/ASR', () => {
  const c = config().voice
  const changed = originalPatch({ engine: 'windows', http: { headers: '' } }, c)
  assert.equal(changed.songVoice, 'keep'); assert.equal(changed.http.headers, 'secret-header')
  assert.equal(originalPatch({ http: { headers: null } }, c).http.headers, '')
  for (const p of [{ enabled: false }, { songVoice: 'x' }, { http: { arbitrary: 1 } }, { engine: 'breezeblue' }]) assert.throws(() => originalPatch(p, c))
})
test('console state hides key/header and unrecognized extension fields', () => {
  const api = apiFixture(); api.config().ext['breeze-settings'].otherSecret = 'sensitive'
  api.config().ext['breeze-settings'].emotion = { endpoints: [{ id: 'e1', name: '自训练', method: 'GET', urlTemplate: 'http://x/t', headers: 'Authorization: secret-header' }], routing: { calm: 'e1' }, templates: [{ name: 'T', routing: { calm: 'breezeblue' } }] }
  const state = consoleState(api)
  assert.equal(state.settings.apiKey, ''); assert.equal(state.original.http.headers, '')
  assert.equal(state.settings.otherSecret, undefined); assert.equal(state.enhancedAvailable, true)
  assert.equal(state.settings.emotion.endpoints[0].headers, ''); assert.equal(state.settings.emotion.endpoints[0].headersSet, true)
  assert.equal(state.settings.emotion.routing.playful, 'breezeblue')
  assert.ok(!JSON.stringify(state).includes('secret-header')); assert.ok(!JSON.stringify(state).includes('brz_dummy'))
})
test('save validates before changing data and rejects concurrent config edits', () => {
  const api = apiFixture(); const rev = revision(api.config()), before = structuredClone(api.config())
  assert.throws(() => saveConsole(api, { revision: rev, settings: { speed: 0.8 }, original: { enabled: false } }))
  assert.deepEqual(api.config(), before)
  saveConsole(api, { revision: rev, settings: { speed: 0.8 }, original: { engine: 'windows' } })
  assert.equal(api.config().voice.engine, 'windows')
  assert.throws(() => saveConsole(api, { revision: rev, settings: { speed: 1 } }), /配置已/)
  assert.throws(() => saveConsole(api, { revision: revision(api.config()), modules: {} }))
})
test('retry settings validate as bounded integers and delay', () => {
  const old = { apiKey: 'secret' }
  assert.deepEqual(extensionPatch({ retryCount: 0, retryDelaySeconds: 0 }, old), { ...old, retryCount: 0, retryDelaySeconds: 0 })
  assert.equal(extensionPatch({ retryCount: 5, retryDelaySeconds: 10 }, old).retryCount, 5)
  for (const patch of [{ retryCount: -1 }, { retryCount: 6 }, { retryCount: 1.5 }, { retryCount: '2' }, { retryDelaySeconds: -1 }, { retryDelaySeconds: 11 }, { retryDelaySeconds: '1' }]) assert.throws(() => extensionPatch(patch, old))
})
test('emotion patch validates endpoints, routing and templates with keep semantics', () => {
  const base = { routing: {}, endpoints: [], templates: [] }
  const patched = emotionPatch({ endpoints: [{ id: 'e1', name: '甲', method: 'GET', urlTemplate: 'http://x/tts?text={text}', headers: '' }], routing: { calm: 'e1', angry: 'breezeblue' }, templates: [{ name: 'T', routing: { calm: 'breezeblue' } }] }, base)
  assert.equal(patched.endpoints[0].name, '甲'); assert.equal(patched.routing.calm, 'e1'); assert.equal(patched.templates.length, 1)
  const withSecret = { ...patched, endpoints: [{ ...patched.endpoints[0], headers: 'secret' }] }
  assert.equal(emotionPatch({ endpoints: [{ id: 'e1', name: '甲', method: 'GET', urlTemplate: 'http://x/t', headers: '' }], routing: {}, templates: patched.templates }, withSecret).endpoints[0].headers, 'secret')
  assert.equal(emotionPatch({ endpoints: [{ id: 'e1', name: '甲', method: 'GET', urlTemplate: 'http://x/t', headers: null }], routing: {}, templates: patched.templates }, withSecret).endpoints[0].headers, '')
  const ep = o => [{ name: 'a', urlTemplate: 'http://x', ...o }]
  for (const bad of [
    { endpoints: [{ name: '', urlTemplate: 'http://x' }] },
    { endpoints: [{ name: 'a', urlTemplate: 'ftp://x' }] },
    { endpoints: [{ name: 'a', urlTemplate: 'http://x', method: 'PUT' }] },
    { routing: { evil: 'breezeblue' } },
    { routing: { calm: 'e99' } },
    { templates: [{ name: 'T', routing: { calm: 'e99' } }] },
    { templates: [{ name: '' }] },
    { endpoints: ep({ name: 'a' }).concat(ep({ name: 'a' })) },
  ]) assert.throws(() => emotionPatch(bad, base))
})
test('console controls reject remote/spoofed clients independently of host', () => {
  const local = { method: 'POST', socket: { remoteAddress: '127.0.0.1' }, headers: { host: 'localhost:5099' } }
  assert.equal(panelAccessError(local, 'POST'), null)
  for (const req of [{}, { ...local, socket: { remoteAddress: '203.0.113.7' } }, { ...local, headers: { ...local.headers, 'x-forwarded-for': '127.0.0.1' } }, { ...local, method: 'GET' }]) assert.equal(panelAccessError(req, 'POST').ok, false)
})
