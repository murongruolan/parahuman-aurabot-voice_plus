import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { parseVoiceTags, applyEmotion, fillUrl, fillBody, parseHeaders, createEmotionSynth, DEFAULT_ROUTING } from '../modules/voice/emotion.mjs'

const dir = mkdtempSync(join(tmpdir(), 'emotion-'))
after(() => rmSync(dir, { recursive: true, force: true }))

test('parses [emotion:arousal] plus style markers and strips them', () => {
  assert.deepEqual(parseVoiceTags('[excited:H]今天运气真好！[laugh]'), { emotion: 'excited', arousal: 'H', styles: ['laugh'], text: '今天运气真好！', flagged: true })
  assert.deepEqual(parseVoiceTags('[down:L]对不起…[cry]'), { emotion: 'down', arousal: 'L', styles: ['cry'], text: '对不起…', flagged: true })
  assert.deepEqual(parseVoiceTags('你好，吃了吗'), { emotion: 'calm', arousal: 'M', styles: [], text: '你好，吃了吗', flagged: false })
  const zh = parseVoiceTags('[兴奋:高]冲呀 [耳语][叹气]')
  assert.equal(zh.emotion, 'excited'); assert.equal(zh.arousal, 'H'); assert.deepEqual(zh.styles, ['whisper', 'sigh']); assert.equal(zh.text, '冲呀')
})
test('unrecognized brackets and native Breeze tags stay in the text', () => {
  const r = parseVoiceTags('[瞎写的]你好[呲牙]')
  assert.deepEqual(r, { emotion: 'calm', arousal: 'M', styles: [], text: '[瞎写的]你好[呲牙]', flagged: false })
  assert.equal(parseVoiceTags('他[轻笑]了一[停顿]下').text, '他[轻笑]了一[停顿]下')
})
test('applyEmotion follows the empirical laws: empty instructions = pure text, guidance from emotion row x arousal', () => {
  const base = { guidanceScale: 1, speakerBoost: true,
    emotion: { emotions: { down: { instructions: '', guidance: 'follow' }, excited: { instructions: '兴奋一点！', guidance: 'follow' }, angry: { instructions: '生气！', guidance: 8 } }, arousal: { L: 2, M: 4, H: 6 } } }
  const pure = applyEmotion(base, parseVoiceTags('[down:L]对不起'))
  assert.equal(pure.instructions, ''); assert.equal(pure.guidanceScale, 1)
  const follow = applyEmotion(base, parseVoiceTags('[excited:H]冲啊'))
  assert.equal(follow.instructions, '兴奋一点！'); assert.equal(follow.guidanceScale, 6)
  const fixed = applyEmotion(base, parseVoiceTags('[angry:M]哼'))
  assert.equal(fixed.guidanceScale, 8)
  const unchanged = { guidanceScale: 3 }
  assert.equal(applyEmotion(unchanged, parseVoiceTags('你好')), unchanged)
  assert.equal(Object.keys(DEFAULT_ROUTING).length, 8)
})
test('url and body templates substitute all tokens with proper escaping', () => {
  const v = { text: '你好"吗', emotion: 'calm', arousal: 'M', styles: 'sigh,laugh', reqid: 'r1' }
  assert.equal(fillUrl('http://x/tts?t={text}&e={emotion}&a={arousal}&s={styles}', v), 'http://x/tts?t=' + encodeURIComponent('你好"吗') + '&e=calm&a=M&s=sigh%2Claugh')
  assert.equal(fillBody('{"text":"{text}","emotion":"{emotion}"}', v), '{"text":"你好\\"吗","emotion":"calm"}')
})
test('headers parse line by line and skip unsafe lines', () => {
  assert.deepEqual(parseHeaders('Authorization: Bearer x\nX-Mode: 安静'), { Authorization: 'Bearer x', 'X-Mode': '安静' })
  assert.deepEqual(parseHeaders('bad line\nok: v'), { ok: 'v' })
})
test('emotion synth accepts wav, names the engine, and rejects bad replies', async () => {
  const wav = Buffer.from('RIFFxxxxWAVEyyyy')
  const endpoint = { name: '自训练', method: 'GET', urlTemplate: 'http://x/tts?text={text}' }
  const synth = createEmotionSynth({ fetchLike: async () => new Response(wav, { status: 200, headers: { 'content-type': 'audio/wav' } }), signal: new AbortController().signal, timeoutSeconds: 5, directory: dir })
  const ok = await synth('你好', { emotion: 'calm', arousal: 'M', styles: [] }, endpoint)
  assert.equal(ok.engine, '自训练'); assert.equal(existsSync(ok.file), true)
  const bad = createEmotionSynth({ fetchLike: async () => new Response('not audio', { status: 200 }), signal: new AbortController().signal, timeoutSeconds: 5, directory: dir })
  await assert.rejects(bad('x', { emotion: 'calm', arousal: 'M', styles: [] }, endpoint), /可识别的音频/)
  const gone = createEmotionSynth({ fetchLike: async () => new Response('{}', { status: 500 }), signal: new AbortController().signal, timeoutSeconds: 5, directory: dir })
  await assert.rejects(gone('x', { emotion: 'calm', arousal: 'M', styles: [] }, endpoint), /HTTP 500/)
  const dead = createEmotionSynth({ fetchLike: async () => { throw new TypeError('boom') }, signal: new AbortController().signal, timeoutSeconds: 5, directory: dir })
  await assert.rejects(dead('x', { emotion: 'calm', arousal: 'M', styles: [] }, endpoint), /连接失败/)
  const invalid = createEmotionSynth({ fetchLike: async () => new Response(wav), signal: new AbortController().signal, timeoutSeconds: 5, directory: dir })
  await assert.rejects(invalid('x', { emotion: 'calm', arousal: 'M', styles: [] }, { name: 'x', urlTemplate: 'ftp://x' }), /地址无效/)
})