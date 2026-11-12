import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { saveConsole, consoleState, revision, requestedMode, modeConfig } from '../modules/breeze-settings/control.mjs'

const seed = () => ({ voice: { enabled: true }, modules: { voice: { enabled: true, useBuiltin: false } }, safeMode: false, ext: {} })
function apiFixture() {
  let cfg = seed()
  return { config: () => cfg, settings: () => cfg.ext?.['breeze-settings'] || {}, setConfig: fn => { cfg = typeof fn === 'function' ? fn(cfg) : fn; return cfg } }
}
const eng = o => ({ id: 'e1', name: '玉玲珑', type: 'breeze', base: 'https://api.breeze.blue/v1', apiKey: 'brz_secret', voiceId: 'voc_x', promptTags: true, addedAt: '2026-11-13 09:00', ...o })
const routeBody = o => ({ engines: [eng()], emotions: DEFAULTS8(o), strengths: [{ id: 'l1', name: '轻度', value: 2, builtin: true }, { id: 's1', name: '标准', value: 4, builtin: true }, { id: 'h1', name: '强烈', value: 6, builtin: true }], presets: [], advanced: {} })
const DEFAULTS8 = o => ['calm', 'playful', 'down', 'angry', 'excited', 'proud', 'whiny', 'lazy'].map(c => ({ name: c, code: c, builtin: true, engine: c === 'down' && o?.downEngine ? o.downEngine : 'e1', instructions: '', strength: 'model', ref: { mode: 'none', path: '', text: '', param: '' }, ...(c === 'calm' && o?.calm ? o.calm : {}) }))

test('engine registry validates and keeps unrelated ext keys', () => {
  const api = apiFixture(); api.config().ext.unrelated = { keep: 1 }
  const rev = revision(api.config())
  const state = saveConsole(api, { revision: rev, ...routeBody() })
  assert.equal(state.engines[0].name, '玉玲珑'); assert.equal(state.engines[0].apiKey, '')
  assert.equal(state.engines[0].apiKeySet, false)
  assert.equal(state.emotions.length, 8); assert.equal(state.emotions[3].engine, 'e1')
  assert.equal(state.strengths[2].value, 6)
  assert.equal(api.config().ext.unrelated.keep, 1)
  assert.ok(!JSON.stringify(api.config()).includes('brz_secret'), 'engine keys must not live in config')
})
test('engine rows reject bad type/base/name and duplicates', () => {
  const api = apiFixture(); const rev = revision(api.config())
  const body = routeBody()
  for (const bad of [eng({ name: '' }), eng({ type: 'elevenlabs' }), eng({ base: 'ftp://x' }), eng({ id: 'e1', name: '重名' }), eng({ voiceId: '../x' })]) {
    assert.throws(() => saveConsole(api, { revision: rev, engines: [eng(), bad], emotions: body.emotions, strengths: body.strengths, presets: [], advanced: {} }))
  }
  assert.throws(() => saveConsole(api, { revision: rev, engines: [eng(), eng()], emotions: body.emotions, strengths: body.strengths, presets: [], advanced: {} }), /重复/)
})
test('emotion rows: code duplicates, unknown engine, ref modes, strength values', () => {
  const api = apiFixture(); const rev = revision(api.config())
  const body = routeBody()
  const cloneEmo = (code, patch) => body.emotions.map(e => e.code === code ? { ...e, ...patch } : e)
  saveConsole(api, { revision: rev, ...body })
  const rev2 = revision(api.config())
  assert.throws(() => saveConsole(api, { revision: rev2, engines: body.engines, emotions: cloneEmo('calm', { engine: 'e9' }), strengths: body.strengths, presets: [], advanced: {} }), /不存在/)
  assert.throws(() => saveConsole(api, { revision: rev2, engines: body.engines, emotions: body.emotions.concat(body.emotions[0]), strengths: body.strengths, presets: [], advanced: {} }), /重复/)
  const ok = saveConsole(api, { revision: rev2, engines: body.engines, emotions: cloneEmo('calm', { strength: 7, ref: { mode: 'param', param: 'calm' } }), strengths: body.strengths, presets: [], advanced: {} })
  assert.equal(ok.emotions[0].strength, 7); assert.equal(ok.emotions[0].ref.param, 'calm')
  assert.throws(() => saveConsole(api, { revision: revision(api.config()), engines: body.engines, emotions: cloneEmo('calm', { strength: 11 }), strengths: body.strengths, presets: [], advanced: {} }), /1–10/)
})
test('presets store the emotion route only (no engines) and dedupe by name', () => {
  const api = apiFixture(); const rev = revision(api.config())
  const body = routeBody()
  saveConsole(api, { revision: rev, ...body })
  const rev2 = revision(api.config())
  const state = saveConsole(api, { revision: rev2, engines: body.engines, emotions: body.emotions, strengths: body.strengths,
    presets: [{ name: '玉玲珑全套', route: { emotions: body.emotions, strengths: body.strengths } }], advanced: {} })
  assert.equal(state.presets[0].name, '玉玲珑全套')
  assert.equal(state.presets[0].route.emotions.length, 8)
  assert.throws(() => saveConsole(api, { revision: revision(api.config()), engines: body.engines, emotions: body.emotions, strengths: body.strengths, presets: [{ name: '同名', route: { emotions: body.emotions, strengths: body.strengths } }, { name: '同名', route: { emotions: body.emotions, strengths: body.strengths } }], advanced: {} }), /重复/)
})
test('advanced settings validate; stale revision rejected', () => {
  const api = apiFixture(); const rev = revision(api.config())
  const state = saveConsole(api, { revision: rev, ...routeBody(), advanced: { outputFormat: 'mp3_24000_128', timeoutSeconds: 120, fallback: false, retryCount: 3, retryDelaySeconds: 0.5, speakerBoost: false } })
  assert.equal(state.advanced.retryCount, 3); assert.equal(state.advanced.speakerBoost, false)
  assert.throws(() => saveConsole(api, { revision: rev, ...routeBody(), advanced: { retryCount: 9 } }), /配置已在其他页面变更/)
  assert.throws(() => saveConsole(api, { revision: revision(api.config()), ...routeBody(), advanced: { outputFormat: 'flac' } }), /选项无效|输出格式/)
})
test('mode helpers keep the three-state semantics', () => {
  let cfg = seed()
  for (const mode of ['official', 'off', 'enhanced']) {
    cfg = modeConfig(cfg, mode); assert.equal(requestedMode(cfg), mode)
  }
})
