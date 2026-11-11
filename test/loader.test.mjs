import { test, after, before } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, cpSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'
import { createModules } from '../upstream/src/core/modules.js'
import builtinVoice from '../upstream/src/modules/voice/index.js'
import { normalize, publicConfig, mergeFromPanel } from '../upstream/src/core/config.js'

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
const convertedFile = join(root, 'converted.wav'); writeFileSync(convertedFile, wav)
let cfg, mods, localActive = false, localError = false, localMissing = false, song = null, stt = null
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
  local: { active: () => localActive, call: async (name, body) => { localCalls.push({ name, body }); if (localError) throw new Error('local failed'); return { file: localMissing ? join(root, 'missing.wav') : localFile } } },
  http: { body: async req => req.body || {} },
  hub: { localTranscribe: async () => '识别成功' },
  onebot: { call: async (name, body) => { historyCalls.push({ name, body }); return { messages: [{ user_id: 123, time: 1, message: [{ type: 'record', data: { file: 'x' } }] }] } } },
}
const setConfig = value => { const old = cfg; cfg = value; mods?.emit('config', cfg, old); return cfg }
function reset() {
  cfg = normalize({ ownerQQ: 123, voice: { enabled: true, engine: 'http', http: { urlTemplate: base + '/tts?text={text}', method: 'GET' }, songVoice: '' },
    ext: { 'breeze-settings': { provider: 'breezeblue', apiKey: 'brz_fixture_secret', voiceId: 'voc_fixture', outputFormat: 'wav' } },
    modules: { voice: { enabled: true, useBuiltin: false } } })
  localActive = localError = localMissing = false; song = null; stt = null
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

test('distributable loads through real snapshot/__lib loader as same-name user module', () => {
  const status = mods.status().find(m => m.id === 'voice')
  assert.equal(status.running, 'user', JSON.stringify(status)); assert.equal(status.fallback, false); assert.equal(status.error, '')
  assert.equal(typeof mods.use('voice').speak, 'function'); assert.equal(typeof mods.use('voice').edgeInstalled, 'function')
  for (const path of ['/voice/test', '/voice/install', '/voice/song-voices', '/voice/asr-status', '/voice/asr-prepare', '/voice/asr-last', '/voice/asr-test', '/ext/breeze-settings/breeze/status', '/ext/breeze-settings/breeze/voices', '/ext/breeze-settings/breeze/test']) assert.ok(mods.hasRoute('/aurabot/api' + path), path)
})
test('provider defaults keep old engine; copying the module does not auto-spend', async () => {
  reset(); cfg.ext['breeze-settings'] = {}
  const result = await mods.use('voice').speak('原语音')
  assert.equal(result.engine, 'http'); assert.equal(oldRequests.length, 1); assert.equal(remoteRequests.length, 0)
})
test('companion configuration module is eligible for actual host UI and keys stay masked', () => {
  reset()
  const s = mods.status().find(m => m.id === 'breeze-settings')
  const hasUi = m => m.running === 'user' && !m.builtin && !['voice', 'song'].includes(m.id) && ((m.settings || []).length || m.panel)
  assert.equal(mods.running('breeze-settings'), 'user'); assert.ok(hasUi(s)); assert.equal(s.tab, '')
  assert.equal(publicConfig(cfg).ext['breeze-settings'].apiKey, '')
})
test('omitting/disabling the companion never auto-enables paid generation', async () => {
  reset(); cfg.modules['breeze-settings'] = { enabled: false }; await mods.sync()
  assert.equal((await mods.use('voice').speak('旧引擎')).engine, 'http'); assert.equal(remoteRequests.length, 0)
  cfg.modules['breeze-settings'].enabled = true; await mods.reload('breeze-settings')
})
test('external or spoofed HTTP callers cannot spend stored key through preview routes', async () => {
  reset()
  for (const path of ['/voice/test', '/ext/breeze-settings/breeze/test', '/ext/breeze-settings/breeze/voices']) {
    for (const req of [
      { method: 'POST', socket: { remoteAddress: '198.51.100.9' }, headers: { host: 'localhost:5099' } },
      { method: 'POST', socket: { remoteAddress: '198.51.100.9' }, headers: { host: 'localhost:5099', 'x-forwarded-for': '127.0.0.1' } },
      { method: 'POST', socket: { remoteAddress: '127.0.0.1' }, headers: { host: 'evil.example:5099' } },
      { method: 'POST', socket: { remoteAddress: '127.0.0.1' }, headers: { host: 'localhost:5099', origin: 'https://evil.example' } },
      { method: 'GET', socket: { remoteAddress: '127.0.0.1' }, headers: { host: 'localhost:5099' } },
    ]) {
      const r = await mods.handle('/aurabot/api' + path, { ...req, body: { text: 'must not spend' } }, {})
      assert.equal(r.ok, false)
    }
  }
  assert.equal(remoteRequests.length, 0); assert.equal(oldRequests.length, 0)
})

test('Breeze replaces chat synth with unchanged speak result contract', async () => {
  reset()
  const result = await mods.use('voice').speak('你好 [笑]')
  assert.deepEqual(Object.keys(result).sort(), ['engine', 'file'])
  assert.equal(result.engine, 'breezeblue'); assert.deepEqual(readFileSync(result.file), wav)
  assert.equal(remoteRequests.length, 1); assert.equal(oldRequests.length, 0)
})
test('original /voice/test remains compatible and uses Breeze when selected', async () => {
  reset()
  const r = await route('/voice/test', { text: '试听' })
  assert.equal(r.ok, true); assert.equal(r.engine, 'breezeblue'); assert.equal(r.mime, 'audio/wav'); assert.deepEqual(Buffer.from(r.data, 'base64'), wav)
})
test('all preserved local engines still use the original helper with their protocol', async () => {
  for (const engine of ['http', 'gptsovits', 'cosyvoice']) {
    reset(); cfg.ext['breeze-settings'].provider = 'builtin'; cfg.voice.engine = engine
    cfg.voice.gptsovits = { url: base, textLang: 'zh', refAudio: 'ref.wav', promptText: '参考', promptLang: 'zh' }
    cfg.voice.cosyvoice = { url: base, mode: 'instruct', instruct: '温柔', spkId: '中文女', sampleRate: 22050 }
    const result = await mods.use('voice').speak('你好')
    assert.equal(result.engine, engine); assert.equal(oldRequests.length, 1); assert.equal(remoteRequests.length, 0)
    if (engine === 'gptsovits') assert.match(oldRequests[0].url, /ref_audio_path=ref.wav/)
    if (engine === 'cosyvoice') { assert.equal(oldRequests[0].method, 'POST'); assert.equal(oldRequests[0].url, '/inference_instruct') }
  }
})
test('local TTS precedence remains unchanged and does not invoke Breeze/RVC', async () => {
  reset(); localActive = true; cfg.voice.songVoice = 'custom'
  const r = await mods.use('voice').speak('本地优先')
  assert.equal(r.engine, 'local'); assert.equal(r.file, localFile)
  assert.equal(remoteRequests.length, 0); assert.equal(songCalls.length, 0)
  assert.deepEqual(localCalls, [{ name: 'tts', body: { text: '本地优先' } }])
})
test('failed/missing local result falls through to selected Breeze', async () => {
  for (const bad of ['error', 'missing']) {
    reset(); localActive = true; localError = bad === 'error'; localMissing = bad === 'missing'
    assert.equal((await mods.use('voice').speak('回落')).engine, 'breezeblue')
    assert.equal(remoteRequests.length, 1)
  }
})
test('Breeze failure falls back once to configured old engine, sanitized log', async () => {
  reset(); remote = () => new Response(JSON.stringify({ code: 'bad_key', detail: cfg.ext['breeze-settings'].apiKey }), { status: 401, headers: { 'content-type': 'application/json' } })
  assert.equal((await mods.use('voice').speak('兜底')).engine, 'http')
  assert.equal(remoteRequests.length, 1); assert.equal(oldRequests.length, 1)
  assert.ok(!logs.join('\n').includes(cfg.ext['breeze-settings'].apiKey)); assert.ok(logs.some(x => x.includes('回退')))
})
test('network-level Breeze failure falls back and is remembered for the console status', async () => {
  reset(); remote = () => { throw new TypeError('boom') }
  assert.equal((await mods.use('voice').speak('网络抖动')).engine, 'http')
  assert.equal(remoteRequests.length, 1); assert.equal(oldRequests.length, 1)
  const status = await route('/ext/breeze-settings/breeze/status')
  assert.ok(status.lastFallback); assert.equal(typeof status.lastFallback.at, 'number')
  assert.ok(Date.now() - status.lastFallback.at < 60000); assert.match(status.lastFallback.reason, /无法连接/)
  assert.ok(!JSON.stringify(status.lastFallback).includes(cfg.ext['breeze-settings'].apiKey))
})
test('strict mode throws instead of silently changing voice', async () => {
  reset(); cfg.ext['breeze-settings'].fallback = false; remote = () => new Response('{}', { status: 429 })
  await assert.rejects(mods.use('voice').speak('不回退'), e => e.status === 429)
  assert.equal(oldRequests.length, 0)
})
test('missing credentials fallback without making paid request', async () => {
  reset(); cfg.ext['breeze-settings'].apiKey = ''
  assert.equal((await mods.use('voice').speak('配置未完成')).engine, 'http')
  assert.equal(remoteRequests.length, 0)
})
test('RVC conversion applies exactly once to Breeze with preserved pitch/voice', async () => {
  reset(); cfg.voice.songVoice = 'my-rvc'; cfg.voice.songPitch = 3; song = { convertSpeech: async () => convertedFile }
  const r = await mods.use('voice').speak('变声')
  assert.equal(r.file, convertedFile); assert.equal(songCalls.length, 1)
  assert.equal(songCalls[0].opts.voice, 'my-rvc'); assert.equal(songCalls[0].opts.pitch, 3)
})
test('RVC failure preserves Breeze audio', async () => {
  reset(); cfg.voice.songVoice = 'missing'; song = { convertSpeech: async () => { throw new Error('RVC unavailable') } }
  const r = await mods.use('voice').speak('原声')
  assert.equal(r.engine, 'breezeblue'); assert.equal(songCalls.length, 1); assert.deepEqual(readFileSync(r.file), wav)
})
test('RVC also applies exactly once on original fallback TTS', async () => {
  reset(); cfg.ext['breeze-settings'].provider = 'builtin'; cfg.voice.songVoice = 'my-rvc'; song = { convertSpeech: async () => convertedFile }
  const r = await mods.use('voice').speak('旧引擎变声')
  assert.equal(r.engine, 'http'); assert.equal(r.file, convertedFile); assert.equal(songCalls.length, 1)
})
test('config edits take effect without module reload or changing cfg.voice', async () => {
  reset(); const before = structuredClone(cfg.voice)
  await mods.use('voice').speak('一')
  setConfig({ ...cfg, ext: { 'breeze-settings': { ...cfg.ext['breeze-settings'], voiceId: 'voc_new', instructions: '温柔', speed: 0.9 } } })
  await mods.use('voice').speak('二')
  assert.match(remoteRequests[1].url, /voc_new/); assert.equal(JSON.parse(remoteRequests[1].body).instructions, '温柔')
  assert.deepEqual(cfg.voice, before)
})
test('password settings mask public config and retain saved key when blank', () => {
  reset()
  const pub = publicConfig(cfg)
  assert.equal(pub.ext['breeze-settings'].apiKey, ''); assert.equal(pub.ext['breeze-settings'].apiKeySet, true)
  const updated = mergeFromPanel(cfg, { ext: { 'breeze-settings': { apiKey: '', speed: 0.8 } } })
  assert.equal(updated.ext['breeze-settings'].apiKey, cfg.ext['breeze-settings'].apiKey)
  assert.equal(updated.ext['breeze-settings'].speed, 0.8)
  assert.equal(mergeFromPanel(cfg, { ext: { 'breeze-settings': { apiKey: null } } }).ext['breeze-settings'].apiKey, '')
})
test('custom status and picker routes match ExtPanel URL and never expose key', async () => {
  reset(); localActive = true; cfg.voice.enabled = false
  const status = await route('/ext/breeze-settings/breeze/status')
  assert.equal(status.keySet, true); assert.equal(status.localTtsActive, true); assert.equal(status.voiceEnabled, false)
  assert.ok(!JSON.stringify(status).includes(cfg.ext['breeze-settings'].apiKey))
  remote = () => new Response(JSON.stringify({ voices: [{ voice_id: 'voc_one', name: '音色' }], has_more: false, total: 1, page: 1 }), { headers: { 'content-type': 'application/json' } })
  const list = await route('/ext/breeze-settings/breeze/voices', { type: 'personal' })
  assert.equal(list.ok, true); assert.equal(list.voices.length, 1)
})
test('direct preview uses saved settings, bypasses local, does not silently fallback', async () => {
  reset(); localActive = true; cfg.ext['breeze-settings'].provider = 'builtin'
  const result = await route('/ext/breeze-settings/breeze/test', { text: '直连', apiKey: 'ignored', voiceId: 'ignored' })
  assert.equal(result.engine, 'breezeblue'); assert.equal(localCalls.length, 0)
  assert.equal(remoteRequests[0].headers['xi-api-key'], cfg.ext['breeze-settings'].apiKey)
  remote = () => new Response('{}', { status: 401 })
  const fail = await route('/ext/breeze-settings/breeze/test', { text: '直连错误' })
  assert.equal(fail.ok, false); assert.equal(oldRequests.length, 0)
})
test('preview enforces small text budget before network', async () => {
  reset()
  for (const text of ['', '  ', '字'.repeat(201), 12]) assert.equal((await route('/ext/breeze-settings/breeze/test', { text })).ok, false)
  assert.equal(remoteRequests.length, 0)
})
test('existing ASR status/prepare/last and song status retain behavior', async () => {
  reset()
  assert.equal((await route('/voice/asr-status')).ok, false)
  assert.equal((await route('/voice/asr-prepare')).ok, false)
  assert.equal((await route('/voice/asr-test')).ok, false)
  let prepared = ''
  stt = { snapshot: () => ({ providers: [{ id: 'whisper', preparation: { phase: 'ready' } }], selection: { providerId: 'whisper' } }), prepare: id => (prepared = id) }
  assert.equal((await route('/voice/asr-status')).provider, 'whisper')
  assert.equal((await route('/voice/asr-prepare')).ok, true); assert.equal(prepared, 'whisper')
  assert.equal((await route('/voice/asr-last', { userId: 123 })).heard, '识别成功')
  assert.equal(historyCalls[0].name, 'get_friend_msg_history')
  assert.equal(remoteRequests.length, 0)
  song = { status: () => ({ ready: true, voices: [{ name: 'demo' }] }) }
  const songStatus = await route('/voice/song-voices')
  assert.equal(songStatus.available, true, JSON.stringify({ songStatus, running: mods.running('song'), logs }))
})
test('switch back to built-in preserves settings; reload restores user and avoids duplicate converters', async () => {
  reset(); const before = structuredClone(cfg.ext)
  setConfig({ ...cfg, modules: { ...cfg.modules, voice: { enabled: true, useBuiltin: true } } })
  await mods.sync()
  assert.equal(mods.running('voice'), 'builtin'); assert.deepEqual(cfg.ext, before)
  assert.equal(mods.hasRoute('/aurabot/api/ext/breeze-settings/breeze/test'), false)
  setConfig({ ...cfg, modules: { ...cfg.modules, voice: { enabled: true, useBuiltin: false } } })
  await mods.reload('voice')
  assert.equal(mods.running('voice'), 'user')
  cfg.voice.songVoice = 'one'; song = { convertSpeech: async () => convertedFile }
  await mods.use('voice').speak('一'); assert.equal(songCalls.length, 1)
  await mods.reload('voice'); await mods.use('voice').speak('二'); assert.equal(songCalls.length, 2)
})
test('safe mode restores built-in and ordinary disabled mode removes voice', async () => {
  reset(); cfg.safeMode = true; await mods.sync(); assert.equal(mods.running('voice'), 'builtin')
  cfg.safeMode = false; await mods.reload('breeze-settings'); await mods.reload('voice'); assert.equal(mods.running('voice'), 'user')
  cfg.modules.voice.enabled = false; await mods.sync(); assert.equal(mods.use('voice'), null)
  cfg.modules.voice.enabled = true; await mods.reload('voice'); assert.equal(mods.running('voice'), 'user')
})
test('in-flight Breeze work is cancelled on module stop without invoking fallback', async () => {
  reset()
  let began
  const ready = new Promise(r => (began = r))
  remote = (url, init) => new Promise((resolve, reject) => { began(); init.signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }) })
  const speaking = mods.use('voice').speak('等待')
  const result = assert.rejects(speaking, e => e.code === 'ABORTED')
  await ready
  mods.stop('voice')
  await result
  assert.equal(oldRequests.length, 0); assert.equal(remoteRequests.length, 1)
  reset(); await mods.reload('voice')
})
test('independent console stays available across enhanced, official and off; settings retained', async () => {
  reset()
  cfg.ext['breeze-settings'].customLegacy = 'keep-me'
  const key = cfg.ext['breeze-settings'].apiKey
  for (const mode of ['official', 'off', 'enhanced', 'off', 'official', 'enhanced']) {
    const state = await route('/ext/breeze-settings/console/status')
    const r = await route('/ext/breeze-settings/console/mode', { mode, revision: state.revision })
    assert.equal(r.ok, true, r.message); assert.equal(r.actualMode, mode); assert.equal(r.requestedMode, mode)
    assert.equal(mods.running('voice'), mode === 'off' ? null : mode === 'official' ? 'builtin' : 'user')
    assert.equal(mods.running('breeze-settings'), 'user')
    assert.equal(cfg.ext['breeze-settings'].apiKey, key); assert.equal(cfg.ext['breeze-settings'].customLegacy, 'keep-me')
    assert.equal(cfg.voice.enabled, mode !== 'off')
  }
  assert.equal(remoteRequests.length, 0)
})
test('console status/save mask keys, keep unrelated config, and reject stale writes', async () => {
  reset(); cfg.ext.unrelated = { keep: 1 }
  const state = await route('/ext/breeze-settings/console/status')
  assert.equal(state.settings.apiKey, ''); assert.equal(state.settings.apiKeySet, true)
  assert.equal(state.enhancedAvailable, true)
  const r = await route('/ext/breeze-settings/console/save', { revision: state.revision, settings: { speed: 0.9, apiKey: '' }, original: { engine: 'http' } })
  assert.equal(r.ok, true, r.message); assert.equal(cfg.ext['breeze-settings'].speed, 0.9)
  assert.equal(cfg.ext['breeze-settings'].apiKey, 'brz_fixture_secret'); assert.deepEqual(cfg.ext.unrelated, { keep: 1 })
  assert.equal((await route('/ext/breeze-settings/console/save', { revision: state.revision, settings: { speed: 1.1 } })).ok, false)
  assert.equal(cfg.ext['breeze-settings'].speed, 0.9)
})
test('console actual preview honors off state and cannot bypass stored revision', async () => {
  reset()
  let state = await route('/ext/breeze-settings/console/status')
  const preview = await route('/ext/breeze-settings/console/test', { text: '控制台试听', revision: state.revision })
  assert.equal(preview.ok, true, preview.message); assert.equal(preview.engine, 'breezeblue')
  assert.equal((await route('/ext/breeze-settings/console/test', { text: '不允许', revision: 'stale' })).ok, false)
  state = await route('/ext/breeze-settings/console/mode', { mode: 'off', revision: state.revision })
  assert.equal((await route('/ext/breeze-settings/console/test', { text: '关闭', revision: state.revision })).ok, false)
  assert.equal(remoteRequests.length, 1)
  await route('/ext/breeze-settings/console/mode', { mode: 'enhanced', revision: state.revision })
})

test('broken user entry falls back to built-in, restores from unchanged distributable', async () => {
  const entry = join(root, 'modules', 'voice', 'index.mjs')
  const original = readFileSync(entry, 'utf8')
  try {
    writeFileSync(entry, 'export default { syntax error')
    await mods.reload('voice')
    const status = mods.status().find(m => m.id === 'voice')
    assert.equal(status.running, 'builtin'); assert.equal(status.fallback, true)
  } finally { writeFileSync(entry, original); await mods.reload('voice') }
  assert.equal(mods.running('voice'), 'user')
})
