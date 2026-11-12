import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, utimesSync, readdirSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createBreezeClient, buildTtsRequest, normalizeSettings, saveAudio, audioType, redact, API_BASE } from '../modules/voice/breezeblue.mjs'

const root = mkdtempSync(join(tmpdir(), 'breeze-unit-'))
after(() => rmSync(root, { recursive: true, force: true }))
const config = { apiKey: 'brz_dummy_test_only', voiceId: 'voc_demo', modelId: 'breeze-tts-2', outputFormat: 'wav' }
function wav() {
  const b = Buffer.alloc(8044)
  b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVE', 8); b.write('fmt ', 12)
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(24000, 24)
  b.writeUInt32LE(48000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34)
  b.write('data', 36); b.writeUInt32LE(8000, 40)
  return b
}
const mp3 = Buffer.alloc(600, 0x22); mp3.write('ID3')
const audio = (b = wav(), mime = 'audio/wav') => new Response(b, { headers: { 'content-type': mime } })
const json = (b, status = 200, headers = {}) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json', ...headers } })
function mock(respond) {
  const hits = []
  const client = createBreezeClient({ fetchImpl: async (url, init) => { hits.push({ url, ...init }); return respond(url, init) } })
  return { client, hits }
}

test('request contract: official URL, xi-api-key, synchronous raw audio, safe JSON text', () => {
  const text = '她说"你好"\n[笑] 世界 🎵'
  const { url, init } = buildTtsRequest(text, { ...config, instructions: '  温柔地说。 ', guidanceScale: 3.5, speakerBoost: true, languageCode: 'ZH' })
  assert.equal(url, API_BASE + '/text-to-speech/voc_demo?output_format=wav&delivery=sync')
  assert.equal(init.method, 'POST'); assert.equal(init.redirect, 'error')
  assert.equal(init.headers['xi-api-key'], config.apiKey)
  assert.deepEqual(JSON.parse(init.body), { text, model_id: 'breeze-tts-2', language_code: 'zh', instructions: '温柔地说。', voice_settings: { guidance_scale: 3.5, use_speaker_boost: true } })
  assert.ok(!url.includes(config.apiKey))
})
test('five-field shape: speed/volume are never sent; defaults guidance 1 + boost true', () => {
  const { init } = buildTtsRequest(' 嗨 ', { ...config, modelId: '', languageCode: '', instructions: '' })
  const body = JSON.parse(init.body)
  assert.equal(body.text, '嗨'); assert.equal(body.model_id, undefined)
  assert.equal(body.language_code, undefined); assert.equal(body.instructions, undefined)
  assert.deepEqual(body.voice_settings, { guidance_scale: 1, use_speaker_boost: true })
  assert.equal('speed' in body.voice_settings, false); assert.equal('volume' in body.voice_settings, false)
})
test('leading interjections get the "……" prefix; already-prefixed text is left alone', () => {
  const body = t => JSON.parse(buildTtsRequest(t, config).init.body).text
  assert.equal(body('嗯，我在。'), '……嗯，我在。')
  assert.equal(body('……嗯，我在。'), '……嗯，我在。')
  assert.equal(body('呜呜呜…好难受'), '……呜呜呜…好难受')
  assert.equal(body('你好，吃了吗'), '你好，吃了吗')
  assert.equal(body('嗯'), '嗯')
  assert.equal(body('嗯, 我在。'), '……嗯, 我在。')
  assert.equal(body('嗯. hi'), '……嗯. hi')
  assert.equal(body('哈! 你看'), '……哈! 你看')
  assert.equal(body('hmm, fine'), 'hmm, fine')
})
test('cache key covers text and synthesis parameters', () => {
  const a = buildTtsRequest('你好', config).config.cacheKey
  assert.match(a, /^[0-9a-f]{64}$/)
  assert.notEqual(a, buildTtsRequest('你好呀', config).config.cacheKey)
  assert.notEqual(a, buildTtsRequest('你好', { ...config, guidanceScale: 4 }).config.cacheKey)
  assert.notEqual(a, buildTtsRequest('你好', { ...config, voiceId: 'voc_other' }).config.cacheKey)
  assert.equal(buildTtsRequest('你好', config).config.cacheKey, a)
})
for (const [key, value] of [
  ['apiKey', ''], ['apiKey', 'bad\nheader'], ['apiKey', {}], ['voiceId', ''], ['voiceId', '../leak'], ['voiceId', 'a?key=x'],
  ['voiceId', 'https://evil.example'], ['modelId', 'bad model'], ['modelId', 'a'.repeat(121)], ['languageCode', 'zho'],
  ['guidanceScale', 0], ['guidanceScale', 11], ['guidanceScale', 'NaN'],
  ['speakerBoost', 'false'], ['timeoutSeconds', 0], ['timeoutSeconds', 601], ['timeoutSeconds', true], ['outputFormat', 'pcm'], ['instructions', '长'.repeat(2001)],
]) test(`invalid configuration rejected before network: ${key}=${String(value).slice(0, 20)}`, () => {
  assert.throws(() => buildTtsRequest('你好', { ...config, [key]: value }), /Breeze|Voice|模型|语言|强度|超时|WAV|指令/)
})
test('empty, nonstring and overlong texts never generate; Unicode counted as characters', () => {
  for (const v of ['', '  ', null, 123, '文'.repeat(1001)]) assert.throws(() => buildTtsRequest(v, config))
  assert.equal(Array.from(JSON.parse(buildTtsRequest('🎵'.repeat(1000), config).init.body).text).length, 1000)
})
test('identical text+params hit the hash cache and never re-bill', async () => {
  const { client, hits } = mock(() => audio())
  const a = await client.synthesize('你好', config, root)
  const b = await client.synthesize('你好', config, root)
  assert.equal(a.engine, 'breezeblue'); assert.equal(a.mime, 'audio/wav')
  assert.equal(b.cached, true); assert.equal(b.file, a.file); assert.deepEqual(readFileSync(a.file), wav())
  assert.equal(hits.length, 1, 'second identical request must be served from cache')
  const c = await client.synthesize('你好', { ...config, voiceId: 'voc_other' }, root)
  assert.notEqual(c.file, a.file); assert.equal(hits.length, 2)
})
test('MP3 returned byte-for-byte in .mp3, correct Accept and query', async () => {
  const { client, hits } = mock(() => audio(mp3, 'audio/mpeg'))
  const r = await client.synthesize('你好', { ...config, outputFormat: 'mp3_24000_128' }, root)
  assert.ok(r.file.endsWith('.mp3')); assert.deepEqual(readFileSync(r.file), mp3)
  assert.match(hits[0].url, /output_format=mp3_24000_128/); assert.equal(hits[0].headers.accept, 'audio/mpeg')
})
for (const [title, buffer, mime] of [['HTML', Buffer.from('<html>' + 'x'.repeat(900)), 'text/html'], ['JSON', Buffer.from('{"ok":false,"detail":"bad"}'), 'application/json'], ['PCM', Buffer.alloc(2000), 'application/octet-stream'], ['wrong format', mp3, 'audio/mpeg'], ['empty', Buffer.alloc(0), 'audio/wav']]) {
  test(`reject ${title}, no file created`, async () => {
    const dir = join(root, title.replace(/\W/g, '-')); mkdirSync(dir)
    const { client } = mock(() => audio(buffer, mime))
    await assert.rejects(client.synthesize('你好', config, dir), e => e.code === 'INVALID_AUDIO')
    assert.deepEqual(readdirSync(dir), [])
  })
}
for (const status of [400, 401, 402, 403, 404, 422, 429, 503, 504]) test(`HTTP ${status} error safely reported, never automatically retried`, async () => {
  const { client, hits } = mock(() => json({ ok: false, code: 'test_code', detail: `bad ${config.apiKey}` }, status, { 'retry-after': '5', 'history-item-id': 'hist_demo' }))
  await assert.rejects(client.synthesize('你好', config, join(root, 'http-' + status)), e => e.status === status && !e.message.includes(config.apiKey) && e.message.includes('未自动重试') && e.message.includes('平台'))
  assert.equal(hits.length, 1)
})
test('202 async response is not accepted as audio or resubmitted', async () => {
  const { client, hits } = mock(() => json({ generation_job_id: 'job' }, 202))
  await assert.rejects(client.synthesize('你好', config, join(root, 'async')), e => e.code === 'UNEXPECTED_STATUS')
  assert.equal(hits.length, 1)
})
test('unknown native error never echoes headers or secrets', async () => {
  const { client } = mock(() => { throw new Error(`connection failed xi-api-key=${config.apiKey}`) })
  await assert.rejects(client.synthesize('你好', config, join(root, 'native')), e => e.code === 'NETWORK_ERROR' && !e.message.includes(config.apiKey))
})
test('declared huge response rejected before buffering', async () => {
  const { client } = mock(() => new Response(wav(), { headers: { 'content-type': 'audio/wav', 'content-length': String(40 * 1024 * 1024) } }))
  await assert.rejects(client.synthesize('你好', config, join(root, 'huge')), e => e.code === 'RESPONSE_TOO_LARGE')
})
test('oversized streamed body rejected without Content-Length', async () => {
  const { client } = mock(() => new Response(new ReadableStream({ start(controller) { for (let i = 0; i < 33; i++) controller.enqueue(new Uint8Array(1024 * 1024)); controller.close() } })))
  await assert.rejects(client.synthesize('你好', config, join(root, 'streamed')), e => e.code === 'RESPONSE_TOO_LARGE')
})
test('parallel requests serialized, distinct configs/text stay isolated', async () => {
  let active = 0, peak = 0
  const { client, hits } = mock(async () => { active++; peak = Math.max(peak, active); await new Promise(r => setTimeout(r, 10)); active--; return audio() })
  await Promise.all([client.synthesize('一', config, root), client.synthesize('二', { ...config, voiceId: 'voc_other' }, root), client.synthesize('三', { ...config, instructions: '慢一点' }, root)])
  assert.equal(peak, 1); assert.deepEqual(hits.map(h => JSON.parse(h.body).text), ['一', '二', '三'])
  assert.match(hits[1].url, /voc_other/)
})
test('failed queued request does not poison the queue', async () => {
  let n = 0
  const { client } = mock(() => ++n === 1 ? json({ detail: 'invalid' }, 401) : audio())
  const results = await Promise.allSettled([client.synthesize('甲', config, root), client.synthesize('乙', config, root)])
  assert.equal(results[0].status, 'rejected'); assert.equal(results[1].status, 'fulfilled')
})
test('queue bounded and disposal aborts pending work, no extra API calls', async () => {
  const ctrl = new AbortController(); let calls = 0
  const client = createBreezeClient({ signal: ctrl.signal, maxPending: 2, fetchImpl: (url, init) => new Promise((resolve, reject) => { calls++; init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }) }) })
  const jobs = [client.synthesize('一', config, root), client.synthesize('二', config, root)]
  const done = Promise.allSettled(jobs)
  await assert.rejects(client.synthesize('三', config, root), e => e.code === 'QUEUE_FULL')
  ctrl.abort()
  const results = await done
  assert.ok(results.every(r => r.status === 'rejected')); assert.ok(calls <= 1)
  await assert.rejects(client.synthesize('四', config, root), e => e.code === 'ABORTED')
})
test('cache retention deletes only old owned files; unrelated files kept', () => {
  const dir = join(root, 'retention'); mkdirSync(dir)
  const owned = 'breeze-12345678-1234-1234-1234-123456789abc.wav'
  writeFileSync(join(dir, owned), wav()); writeFileSync(join(dir, 'my-recording.wav'), wav())
  const old = new Date(Date.now() - 2 * 86400000)
  utimesSync(join(dir, owned), old, old); utimesSync(join(dir, 'my-recording.wav'), old, old)
  saveAudio(wav(), 'wav', dir)
  assert.ok(!readdirSync(dir).includes(owned)); assert.ok(readdirSync(dir).includes('my-recording.wav'))
})
test('voice picker uses exact API paging/filter contract and safe projection', async () => {
  const { client, hits } = mock(() => json({ voices: [{ voice_id: 'voc_one', name: '玉玲珑', voice_type: 'personal', origin: 'cloned', extra: config.apiKey }, { voice_id: '../bad' }], has_more: true, next_page_token: 'token + /=', page: 2, total: 80 }))
  const r = await client.voices({ ...config, voiceId: '' }, { type: 'personal', search: '玉 玲珑', pageToken: 'token + /=' })
  const url = new URL(hits[0].url)
  assert.equal(url.pathname, '/v1/voices'); assert.equal(url.searchParams.get('voice_type'), 'personal')
  assert.equal(url.searchParams.get('page_size'), '50'); assert.equal(url.searchParams.get('search'), '玉 玲珑')
  assert.equal(url.searchParams.get('next_page_token'), 'token + /=')
  assert.equal(hits[0].headers['xi-api-key'], config.apiKey)
  assert.equal(r.voices.length, 1); assert.equal(r.hasMore, true); assert.ok(!JSON.stringify(r).includes(config.apiKey))
})
test('voice list invalid JSON schema errors are actionable', async () => {
  const { client } = mock(() => json({ data: [] }))
  await assert.rejects(client.voices(config), /voices/)
})
test('key redaction covers exact key and other Breeze keys', () => {
  assert.equal(redact('x brz_not_real_token y', ''), 'x [已隐藏] y')
  assert.equal(redact('x private y', 'private'), 'x [已隐藏] y')
})
