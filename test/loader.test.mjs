import { test, after, before } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'
import { createModules } from '../upstream/src/core/modules.js'
import builtinVoice from '../upstream/src/modules/voice/index.js'
import { normalize, publicConfig, mergeFromPanel } from '../upstream/src/core/config.js'
import { revision } from '../modules/breeze-settings/control.mjs'

const root = mkdtempSync(join(tmpdir(), 'breeze-loader-'))
const pack = resolve(dirname(fileURLToPath(import.meta.url)), '../modules/voice')
const previousDir = process.env.AURABOT_DATA_DIR
const previousGlobal = globalThis.aurabot
const originalFetch = globalThis.fetch
process.env.AURABOT_DATA_DIR = root
cpSync(pack, join(root, 'modules', 'voice'), { recursive: true })
cpSync(resolve(pack, '../breeze-settings'), join(root, 'modules', 'breeze-settings'), { recursive: true })
const wav = Buffer.alloc(8044)
wav.write('RIFF'); wav.writeUInt32LE(8036, 4); wav.write('WAVE', 8); wav.write('fmt ', 12)
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(24000, 24)
wav.writeUInt32LE(48000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(8000, 40)
const localFile = join(root, 'local.wav'); writeFileSync(localFile, wav)
let cfg, mods, localActive = false, localError = false, song = null, stt = null
let remote = () => new Response(wav, { headers: { 'content-type': 'audio/wav' } })
let oldRequests = [], remoteRequests = [], logs = [], localCalls = [], songCalls = [], historyCalls = []
const logger = { info(...x) { logs.push(x.join(' ')) }, debug(...x) { logs.push(x.join(' ')) }, warn(...x) { logs.push(x.join(' ')) }, error(...x) { logs.push(x.join(' ')) } }
const server = createServer((req, res) => {
  const chunks = []; req.on('data', b => chunks.push(b)); req.on('end', () => {
    oldRequests.push({ url: req.url, method: req.method, body: Buffer.concat(chunks).toString() })
    res.writeHead(200, { 'content-type': 'audio/wav' }); res.end(wav)
  })
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}`
const core = {
  local: { active: () => localActive, call: async (name, body) => { localCalls.push({ name, body }); if (localError) throw new Error('local failed'); return { file: localFile } } },
  http: { body: async req => req.body || {} },
  hub: { localTranscribe: async () => '识别成功' },
  onebot: { call: async (name, body) => { historyCalls.push({ name, body }); return { messages: [{ user_id: 123, time: 1, message: [{ type: 'record', data: { file: 'x' } }] }] } } },
}
const setConfig = value => { const old = cfg; cfg = value; mods?.emit('config', cfg, old); return cfg }
function reset() {
  cfg = normalize({ ownerQQ: 123, voice: { enabled: true, engine: 'http', http: { urlTemplate: base + '/tts?text={text}', method: 'GET' }, songVoice: '' }, ext: {} })
  localActive = localError = false; song = null; stt = null
  remote = () => new Response(wav, { headers: { 'content-type': 'audio/wav' } })
  oldRequests = []; remoteRequests = []; logs = []; localCalls = []; songCalls = []; historyCalls = []
}
before(async () => {
  reset()
  mods = createModules({ ctx: { get: () => stt }, core, getConfig: () => cfg, setConfig,
    logger: { child: () => logger }, version: '1.2.0', builtins: [builtinVoice, { id: 'song', setup: () => ({
      status: () => song?.status ? song.status() : { ready: false, voices: [] },
      convertSpeech: async (file, opts) => { songCalls.push({ file, opts }); if (song?.convertSpeech) return song.convertSpeech(file, opts); throw new Error('song not ready') },
    }) }] })
  core.modules = mods
  await mods.boot()
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).startsWith('https://api.breeze.blue/')) { remoteRequests.push({ url: String(url), ...init }); return remote(url, init) }
    if (String(url).startsWith(base)) return originalFetch(url, init)
    throw new Error('Unexpected external request: ' + String(url))
  }
})
after(async () => {
  mods?.dispose(); globalThis.fetch = originalFetch
  if (previousDir === undefined) delete process.env.AURABOT_DATA_DIR; else process.env.AURABOT_DATA_DIR = previousDir
  if (previousGlobal === undefined) delete globalThis.aurabot; else globalThis.aurabot = previousGlobal
  await new Promise(r => server.close(r))
  rmSync(root, { recursive: true, force: true })
})
const route = (path, body = {}) => mods.handle('/aurabot/api' + path, { body,
  method: path.endsWith('/status') ? 'GET' : 'POST', socket: { remoteAddress: '127.0.0.1' },
  headers: { host: 'localhost:5099', origin: 'http://localhost:5099', 'sec-fetch-site': 'same-origin' } }, {})
const engineEntry = o => ({ id: 'e1', name: '玉玲珑', type: 'breeze', base: 'https://api.breeze.blue/v1', apiKey: 'brz_fixture_secret', voiceId: 'voc_fixture', promptTags: true, addedAt: '2026-11-13 09:00', ...o })
const routeBody = o => {
  const eng = engineEntry(o?.engine)
  return { revision: revision(cfg), engines: [eng], strengths: [{ id: 'l1', name: '轻度', value: 2, builtin: true }, { id: 's1', name: '标准', value: 4, builtin: true }, { id: 'h1', name: '强烈', value: 6, builtin: true }],
    emotions: ['calm', 'playful', 'down', 'angry', 'excited', 'proud', 'whiny', 'lazy'].map(code => ({ name: { calm: '平静', playful: '俏皮', down: '失落', angry: '生气', excited: '兴奋', proud: '得意', whiny: '娇嗔', lazy: '慵懒' }[code], code, builtin: true, engine: eng.id, instructions: code === 'excited' ? '兴奋一点！' : '', strength: 'model', ref: { mode: 'none', path: '', text: '', param: '' }, ...(o?.emotions?.[code] || {}) })),
    presets: [], advanced: {}, ...(o?.advanced ? { advanced: o.advanced } : {}) }
}
async function saveViaConsole(o) {
  const r = await route('/ext/breeze-settings/console/save', routeBody(o))
  if (r.ok === false) console.log('SAVE FAIL:', r.message)
  return r
}

test('distributable loads through real snapshot loader; engine keys stay out of config and state', async () => {
  reset(); await saveViaConsole()
  const status = mods.status().find(m => m.id === 'voice')
  assert.equal(status.running, 'user', JSON.stringify(status)); assert.equal(status.error, '')
  assert.equal(typeof mods.use('voice').speak, 'function')
  assert.ok(!JSON.stringify(cfg).includes('brz_fixture_secret'), 'keys live in engine-auth.json, not config')
  const state = await route('/ext/breeze-settings/console/status')
  assert.equal(state.engines[0].apiKey, ''); assert.equal(state.engines[0].apiKeySet, true)
  assert.equal(state.emotions.length, 8); assert.equal(state.strengths.length, 3)
  assert.ok(!JSON.stringify(state).includes('brz_fixture_secret'))
})
test('breeze engine leg synthesizes with pure-text defaults', async () => {
  reset(); await saveViaConsole()
  const r = await mods.use('voice').speak('你好 [笑]')
  if (r.engine !== 'breezeblue') console.log('DBG cfg=', JSON.stringify(cfg.ext['breeze-settings']), 'LOGS=', JSON.stringify(logs.slice(-4)))
  assert.equal(r.engine, 'breezeblue')
  const body = JSON.parse(remoteRequests.at(-1).body)
  assert.equal(body.text, '你好 [笑]'); assert.equal(body.instructions, undefined); assert.equal(body.voice_settings.guidance_scale, 1)
  assert.equal(body.voice_settings.use_speaker_boost, true); assert.equal('speed' in body.voice_settings, false)
  assert.match(remoteRequests.at(-1).url, /voc_fixture/)
})
test('pinned strength overrides the model tag; model-self uses the written tier', async () => {
  reset(); await saveViaConsole({ emotions: { calm: { instructions: '平静地说', strength: 3 } } })
  const r1 = await mods.use('voice').speak('[calm:H]平静句')
  const b1 = JSON.parse(remoteRequests.at(-1).body)
  assert.equal(b1.instructions, '平静地说'); assert.equal(b1.voice_settings.guidance_scale, 3)
  reset(); await saveViaConsole({ emotions: { excited: { instructions: '兴奋一点！', strength: 'model' } } })
  await mods.use('voice').speak('[excited:H]冲啊')
  assert.equal(JSON.parse(remoteRequests.at(-1).body).voice_settings.guidance_scale, 6)
  await mods.use('voice').speak('[excited:L]小声兴奋')
  assert.equal(JSON.parse(remoteRequests.at(-1).body).voice_settings.guidance_scale, 2)
  await mods.use('voice').speak('[excited]没写强度')
  assert.equal(JSON.parse(remoteRequests.at(-1).body).voice_settings.guidance_scale, 4)
})
test('gptsovits engine leg posts emotion code and reference fields', async () => {
  reset()
  await saveViaConsole({ engine: { id: 'e2', name: '沈妙-GPT', type: 'gptsovits', base: base + '/gpt', apiKey: '', addedAt: 'x' }, downEngine: 'e2' })
  const r = await mods.use('voice').speak('[down]好难受')
  assert.equal(r.engine, '沈妙-GPT'); assert.deepEqual(readFileSync(r.file), wav)
  const body = JSON.parse(oldRequests.at(-1).body)
  assert.equal(body.emotion, 'down'); assert.equal(body.text, '好难受')
})
test('unknown emotion code or missing engine falls back to the default engine', async () => {
  reset(); await saveViaConsole()
  const r = await mods.use('voice').speak('[ghost]嘿')
  assert.equal(r.engine, 'breezeblue'); assert.equal(JSON.parse(remoteRequests.at(-1).body).text, '嘿')
  reset(); cfg.ext['breeze-settings'] = {}
  const r2 = await mods.use('voice').speak('[呲牙]中文保留')
  assert.equal(r2.engine, 'http')
  assert.match(decodeURIComponent(oldRequests.at(-1).url), /中文保留/)
  reset(); cfg.ext['breeze-settings'] = {}
  assert.equal((await mods.use('voice').speak('没引擎')).engine, 'http')
  assert.equal(remoteRequests.length, 0)
})
test('engine failure falls back to the original engine once, records lastFallback', async () => {
  reset()
  await saveViaConsole({ engine: { id: 'e9', name: '挂了', type: 'breeze', base: 'https://127.0.0.1:1/x', apiKey: 'brz_x', voiceId: 'voc_x' }, advanced: { retryCount: 0 } })
  const r = await mods.use('voice').speak('引擎挂了')
  assert.equal(r.engine, 'http'); assert.ok(logs.some(x => x.includes('回退原语音引擎')))
  const status = await route('/ext/breeze-settings/breeze/status')
  assert.match(status.lastFallback.reason, /无法连接|连接失败/)
})
test('voice picker route is engine-scoped and never exposes the key', async () => {
  reset(); await saveViaConsole()
  const voicesJson = () => new Response(JSON.stringify({ voices: [{ voice_id: 'voc_one', name: '玉玲珑' }], has_more: false }), { headers: { 'content-type': 'application/json' } })
  remote = voicesJson
  const r = await route('/ext/breeze-settings/breeze/voices', { engineId: 'e1', type: 'personal', search: '', pageToken: '', page: 1 })
  assert.equal(r.ok, true); assert.equal(r.voices.length, 1); assert.ok(!JSON.stringify(r).includes('brz_fixture_secret'))
  const bad = await route('/ext/breeze-settings/breeze/voices', { engineId: 'e9' })
  assert.equal(bad.ok, false)
})
test('prompt rule is generated from attached emotions only and honors per-engine promptTags', async () => {
  reset(); await saveViaConsole()
  const rules = () => mods.rules('private')
  assert.ok(rules().some(x => x.includes('calm 平静') && x.includes('excited 兴奋')))
  assert.ok(rules().some(x => x.includes('行内标签')))
  setConfig({ ...cfg, ext: { 'breeze-settings': { ...cfg.ext['breeze-settings'], engines: cfg.ext['breeze-settings'].engines.map(e => ({ ...e, promptTags: false })) } } })
  assert.ok(!rules().some(x => x.includes('行内标签')))
  assert.ok(rules().some(x => x.includes('中文标点')))
  setConfig({ ...cfg, ext: { 'breeze-settings': { ...cfg.ext['breeze-settings'], emotions: cfg.ext['breeze-settings'].emotions.map(e => ({ ...e, engine: null })) } } })
  assert.ok(!rules().some(x => x.includes('calm 平静')), 'detached emotions leave the prompt rule')
})
test('leading interjections get "……" on the Breeze leg', async () => {
  reset(); await saveViaConsole()
  await mods.use('voice').speak('嗯，我在。')
  assert.equal(JSON.parse(remoteRequests.at(-1).body).text, '……嗯，我在。')
})
test('hash cache dedupes identical text+params', async () => {
  reset(); await saveViaConsole()
  await mods.use('voice').speak('喂，睡了吗。')
  await mods.use('voice').speak('喂，睡了吗。')
  assert.equal(remoteRequests.length, 1)
})
test('console actual preview and mode routes keep working', async () => {
  reset(); await saveViaConsole()
  const state = await route('/ext/breeze-settings/console/status')
  const preview = await route('/ext/breeze-settings/console/test', { text: '控制台试听', revision: state.revision })
  assert.equal(preview.ok, true, 'preview:' + preview.message); assert.equal(preview.engine, 'breezeblue', 'preview engine')
  const mode = await route('/ext/breeze-settings/console/mode', { mode: 'off', revision: state.revision })
  assert.equal(mode.ok, true, 'mode:' + (mode.message || '')); assert.equal(mods.running('voice'), null, 'mode off running')
  const back = await route('/ext/breeze-settings/console/mode', { mode: 'enhanced', revision: revision(cfg) })
  assert.equal(back.ok, true, 'back:' + (back.message || '')); assert.equal(cfg.voice.enabled, true, 'back cfg')
  if (mods.running('voice') !== 'user') await mods.reload('voice')
  assert.equal(mods.running('voice'), 'user')
})
test('companion routes stay loopback-only', async () => {
  reset()
  const r = await mods.handle('/aurabot/api/ext/breeze-settings/console/status', { method: 'GET', socket: { remoteAddress: '198.51.100.9' }, headers: { host: 'localhost:5099' } }, {})
  assert.equal(r.ok, false)
})
test('429 retries with backoff; 402 trips the breaker after three', async () => {
  reset()
  await saveViaConsole({ advanced: { retryCount: 2, retryDelaySeconds: 0 } })
  let n = 0
  remote = () => { n++; if (n < 3) return new Response('{}', { status: 429 }); return new Response(wav, { headers: { 'content-type': 'audio/wav' } }) }
  assert.equal((await mods.use('voice').speak('限流重试')).engine, 'breezeblue'); assert.equal(remoteRequests.length, 3)
  reset()
  await saveViaConsole({ advanced: { retryCount: 0 } })
  remote = () => new Response('{}', { status: 402 })
  for (let i = 0; i < 3; i++) assert.equal((await mods.use('voice').speak('额度' + i)).engine, 'http')
  const status = await route('/ext/breeze-settings/breeze/status')
  assert.ok(status.breakerUntil > Date.now())
  await mods.use('voice').speak('熔断中')
  assert.equal(remoteRequests.length, 3)
})

