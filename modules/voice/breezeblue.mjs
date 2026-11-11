// BreezeBlue Developer API adapter. No SDK, no automatic paid retries, no secrets in output.
import { mkdirSync, writeFileSync, readdirSync, lstatSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

export const API_BASE = 'https://api.breeze.blue/v1'
export const FORMATS = ['wav', 'wav_24000', 'mp3', 'mp3_24000_64', 'mp3_24000_96', 'mp3_24000_128', 'mp3_24000_160']
export const DEFAULTS = Object.freeze({
  provider: 'builtin', apiKey: '', voiceId: '', modelId: 'breeze-tts-2',
  languageCode: '', instructions: '', guidanceScale: 1, speed: 1, volume: 1,
  speakerBoost: false, outputFormat: 'wav', timeoutSeconds: 300, fallback: true,
  retryCount: 2, retryDelaySeconds: 1,
  emotion: Object.freeze({
    endpoints: [], templates: [],
    routing: Object.freeze({ calm: 'breezeblue', playful: 'breezeblue', down: 'breezeblue', angry: 'breezeblue', excited: 'breezeblue', proud: 'breezeblue', whiny: 'breezeblue', lazy: 'breezeblue' }),
  }),
})
const MAX_AUDIO_BYTES = 32 * 1024 * 1024
const MAX_JSON_BYTES = 2 * 1024 * 1024
const MAX_ERROR_BYTES = 16 * 1024

export class BreezeError extends Error {
  constructor(message, code = 'BREEZE_ERROR', status = 0) {
    super(message)
    this.name = 'BreezeError'
    this.code = code
    this.status = status
  }
}

export function redact(value, key = '') {
  let text = String(value ?? '')
  if (key) text = text.split(key).join('[已隐藏]')
  return text.replace(/brz_[A-Za-z0-9_-]+/g, '[已隐藏]')
    .replace(/(xi-api-key["']?\s*[:=]\s*["']?)[^\s,"';]+/gi, '$1[已隐藏]')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .slice(0, 360)
}

function textSetting(value, fallback = '') {
  if (value === undefined || value === null) return fallback
  if (typeof value !== 'string') throw new BreezeError('Breeze 配置应为字符串，请在设置页重新保存。', 'INVALID_CONFIG')
  return value.trim()
}
function numberSetting(value, fallback, min, max, label) {
  const n = value === undefined || value === null || value === '' ? fallback : Number(value)
  if (typeof value === 'boolean' || !Number.isFinite(n) || n < min || n > max) {
    throw new BreezeError(`${label}必须在 ${min}–${max} 之间。`, 'INVALID_CONFIG')
  }
  return n
}
function boolSetting(value, fallback) {
  if (value === undefined || value === null) return fallback
  if (typeof value !== 'boolean') throw new BreezeError('Breeze 开关配置无效，请在设置页重新保存。', 'INVALID_CONFIG')
  return value
}

export function normalizeSettings(raw = {}, { requireVoice = true } = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BreezeError('Breeze 配置无效。', 'INVALID_CONFIG')
  const apiKey = textSetting(raw.apiKey)
  if (!apiKey) throw new BreezeError('请先填写并保存 Breeze API Key。', 'MISSING_KEY')
  if (apiKey.length > 512 || /[\s\x00-\x1f\x7f]/.test(apiKey)) throw new BreezeError('Breeze API Key 格式无效。', 'INVALID_CONFIG')
  const voiceId = textSetting(raw.voiceId)
  if (requireVoice && !voiceId) throw new BreezeError('请填写 Voice ID，或在音色列表中选择并保存。', 'MISSING_VOICE')
  // The ID is a single URL segment. Never let it change the host, endpoint or query.
  if (voiceId && !/^[A-Za-z0-9_-]{1,160}$/.test(voiceId)) throw new BreezeError('Voice ID 只应包含字母、数字、下划线或短横线。', 'INVALID_CONFIG')
  const modelId = textSetting(raw.modelId, DEFAULTS.modelId)
  if (modelId && !/^[A-Za-z0-9._-]{1,120}$/.test(modelId)) throw new BreezeError('模型 ID 格式无效。', 'INVALID_CONFIG')
  const languageCode = textSetting(raw.languageCode).toLowerCase()
  if (languageCode && !/^[a-z]{2}$/.test(languageCode)) throw new BreezeError('语言代码请留空自动识别，或填 zh / en 等两位代码。', 'INVALID_CONFIG')
  const instructions = textSetting(raw.instructions)
  if (Array.from(instructions).length > 2000) throw new BreezeError('表演指令最多 2000 个字符。', 'INVALID_CONFIG')
  const outputFormat = textSetting(raw.outputFormat, DEFAULTS.outputFormat)
  if (!FORMATS.includes(outputFormat)) throw new BreezeError('请选择支持的 WAV 或 MP3 输出格式。', 'INVALID_CONFIG')
  return {
    apiKey, voiceId, modelId, languageCode, instructions, outputFormat,
    guidanceScale: numberSetting(raw.guidanceScale, 1, 1, 10, '引导强度'),
    speed: numberSetting(raw.speed, 1, 0.5, 2, '语速'),
    volume: numberSetting(raw.volume, 1, 0.01, 2, '音量'),
    speakerBoost: boolSetting(raw.speakerBoost, false),
    timeoutMs: numberSetting(raw.timeoutSeconds, 300, 10, 600, '超时秒数') * 1000,
  }
}

export function buildTtsRequest(text, raw) {
  if (typeof text !== 'string' || !text.trim()) throw new BreezeError('没有要念的文字。', 'INVALID_TEXT')
  const clean = text.trim()
  // Stay under the documented default quota; do not silently truncate or multiply paid calls.
  if (Array.from(clean).length > 1000) throw new BreezeError('Breeze 单次最多 1000 个字符，请拆成多条语音；本模块不会自动拆单扣费。', 'TEXT_TOO_LONG')
  const config = normalizeSettings(raw)
  const body = {
    text: clean,
    voice_settings: { guidance_scale: config.guidanceScale, speed: config.speed,
      volume: config.volume, use_speaker_boost: config.speakerBoost },
  }
  if (config.modelId) body.model_id = config.modelId
  if (config.languageCode) body.language_code = config.languageCode
  if (config.instructions) body.instructions = config.instructions
  return {
    config,
    url: `${API_BASE}/text-to-speech/${encodeURIComponent(config.voiceId)}?output_format=${encodeURIComponent(config.outputFormat)}&delivery=sync`,
    init: { method: 'POST', redirect: 'error', headers: { 'xi-api-key': config.apiKey,
      'content-type': 'application/json', accept: config.outputFormat.startsWith('mp3') ? 'audio/mpeg' : 'audio/wav' },
    body: JSON.stringify(body) },
  }
}

async function readBounded(response, maxBytes) {
  const length = Number(response.headers.get('content-length'))
  if (Number.isFinite(length) && length > maxBytes) {
    await response.body?.cancel().catch(() => {})
    throw new BreezeError('Breeze 响应超过安全大小上限。', 'RESPONSE_TOO_LARGE')
  }
  if (!response.body) return Buffer.alloc(0)
  const reader = response.body.getReader()
  const chunks = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) {
        await reader.cancel().catch(() => {})
        throw new BreezeError('Breeze 响应超过安全大小上限。', 'RESPONSE_TOO_LARGE')
      }
      chunks.push(Buffer.from(value))
    }
    return Buffer.concat(chunks, size)
  } finally { reader.releaseLock() }
}

function parseJson(buf) {
  try { return JSON.parse(buf.toString('utf8')) } catch { return null }
}
function errorFor(response, data, apiKey) {
  const hints = { 400: '请求无效', 401: 'API Key 无效或已失效', 402: '余额或密钥额度不足',
    403: '权限或额度不足', 404: '音色不存在或无访问权限', 422: '参数校验失败',
    429: '触发并发或速率限制', 503: '服务繁忙', 504: '服务超时' }
  const code = typeof data?.code === 'string' ? redact(data.code, apiKey).slice(0, 80) : `HTTP_${response.status}`
  const detail = typeof data?.detail === 'string' ? data.detail : typeof data?.error === 'string' ? data.error : ''
  const retry = response.headers.get('retry-after')
  const delay = /^\d{1,4}$/.test(retry || '') ? `，建议等待 ${retry} 秒` : ''
  const uncertain = response.headers.get('history-item-id') ? '。平台可能已有生成结果，请先查看平台历史，勿连续重试扣费' : ''
  return new BreezeError(redact(`Breeze ${response.status}：${hints[response.status] || '请求失败'}${detail ? `（${detail}）` : ''}${delay}${uncertain}。本模块未自动重试。`, apiKey), code, response.status)
}

export function audioType(buf, format) {
  if (buf.length < 44) throw new BreezeError('Breeze 返回的音频为空或过短。', 'INVALID_AUDIO')
  const wav = buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE'
  const mp3 = buf.toString('ascii', 0, 3) === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)
  if (format.startsWith('wav') && wav) return { ext: 'wav', mime: 'audio/wav' }
  if (format.startsWith('mp3') && mp3) return { ext: 'mp3', mime: 'audio/mpeg' }
  throw new BreezeError('Breeze 返回内容不是所请求的 WAV/MP3；已拒绝写入，避免把错误文本当音频播放。', 'INVALID_AUDIO')
}

export function saveAudio(buf, format, directory) {
  const { ext, mime } = audioType(buf, format)
  mkdirSync(directory, { recursive: true })
  // Only our own UUID files; never traverse subfolders or clean another engine's cache.
  for (const name of readdirSync(directory)) {
    if (!/^breeze-[0-9a-f-]{36}\.(wav|mp3)$/.test(name)) continue
    try {
      const p = join(directory, name), st = lstatSync(p)
      if (st.isFile() && Date.now() - st.mtimeMs > 86400000) unlinkSync(p)
    } catch { /* best-effort retention */ }
  }
  const file = join(directory, `breeze-${randomUUID()}.${ext}`)
  writeFileSync(file, buf, { flag: 'wx', mode: 0o600 })
  return { file, mime, bytes: buf.length, engine: 'breezeblue' }
}

export function createBreezeClient({ fetchImpl = (...args) => globalThis.fetch(...args), signal, maxPending = 8 } = {}) {
  let chain = Promise.resolve()
  let pending = 0
  function queue(work, requestSignal) {
    if (requestSignal.aborted) return Promise.reject(new BreezeError('Breeze 请求已取消。', 'ABORTED'))
    if (pending >= maxPending) return Promise.reject(new BreezeError('语音请求排队过多，请稍后再试。', 'QUEUE_FULL'))
    pending++
    const job = chain.then(() => {
      if (requestSignal.aborted) throw new BreezeError('Breeze 排队超时或模块已停用。', 'ABORTED')
      return work()
    }).finally(() => { pending-- })
    chain = job.catch(() => {})
    return new Promise((resolve, reject) => {
      const abort = () => reject(new BreezeError(signal?.aborted ? '语音模块已停用。' : 'Breeze 请求超时，平台可能已生成；请先查看平台历史，不要连续重试。', signal?.aborted ? 'ABORTED' : 'TIMEOUT'))
      requestSignal.addEventListener('abort', abort, { once: true })
      job.then(resolve, reject).finally(() => requestSignal.removeEventListener('abort', abort))
      if (requestSignal.aborted) abort()
    })
  }
  async function request(url, init, config, maxBytes, parseAudio, requestSignal) {
    try {
      requestSignal.throwIfAborted()
      const response = await fetchImpl(url, { ...init, signal: requestSignal })
      if (!response.ok) {
        const data = parseJson(await readBounded(response, MAX_ERROR_BYTES))
        throw errorFor(response, data, config.apiKey)
      }
      if (response.status !== 200) {
        await response.body?.cancel().catch(() => {})
        throw new BreezeError('Breeze 未返回同步音频（可能是异步任务）。请查看平台历史；本模块未自动重新提交。', 'UNEXPECTED_STATUS', response.status)
      }
      const buf = await readBounded(response, maxBytes)
      requestSignal.throwIfAborted()
      const contentType = response.headers.get('content-type') || ''
      const data = contentType.includes('json') || /^[\s﻿]*[\[{]/.test(buf.toString('utf8', 0, 48)) ? parseJson(buf) : null
      if (parseAudio) {
        if (data) throw new BreezeError(redact(`Breeze 返回 JSON 而非音频：${data.detail || data.error || data.code || '响应格式错误'}。`, config.apiKey), 'INVALID_AUDIO')
        audioType(buf, config.outputFormat)
        return buf
      }
      if (!data || data.ok === false) throw new BreezeError('Breeze 音色列表返回格式无效。', 'INVALID_RESPONSE')
      return data
    } catch (error) {
      if (error instanceof BreezeError) throw error
      if (requestSignal.aborted) throw new BreezeError(signal?.aborted ? '语音模块已停用。' : 'Breeze 请求超时；请先检查平台历史，避免重复扣费。', signal?.aborted ? 'ABORTED' : 'TIMEOUT')
      // Never include native request errors: proxies/transports may embed authenticated headers.
      // Classify by Node error code only (safe uppercase token).
      const nativeCode = typeof error?.code === 'string' && /^[A-Z][A-Z0-9_]{1,31}$/.test(error.code) ? `（${error.code}）` : ''
      throw new BreezeError(`无法连接 Breeze 官方 API${nativeCode}，请检查网络或代理。已提交的请求请先检查平台历史。`, 'NETWORK_ERROR')
    }
  }
  function requestSignal(timeoutMs) {
    const timeout = AbortSignal.timeout(timeoutMs)
    return signal ? AbortSignal.any([signal, timeout]) : timeout
  }
  return {
    async synthesize(text, raw, directory) {
      const { config, url, init } = buildTtsRequest(text, raw)
      const s = requestSignal(config.timeoutMs)
      return queue(async () => {
        const buf = await request(url, init, config, MAX_AUDIO_BYTES, true, s)
        s.throwIfAborted()
        return saveAudio(buf, config.outputFormat, directory)
      }, s)
    },
    async voices(raw, { type = 'personal', search = '', pageToken = '', page = 1 } = {}) {
      const config = normalizeSettings(raw, { requireVoice: false })
      if (!['personal', 'default', 'all'].includes(type)) throw new BreezeError('音色来源筛选无效。', 'INVALID_CONFIG')
      if (typeof search !== 'string' || search.length > 120 || typeof pageToken !== 'string' || pageToken.length > 8192) throw new BreezeError('音色筛选参数无效。', 'INVALID_CONFIG')
      if (!Number.isInteger(page) || page < 1 || page > 10000) throw new BreezeError('页码无效。', 'INVALID_CONFIG')
      const query = new URLSearchParams({ voice_type: type, page_size: '50' })
      if (search.trim()) query.set('search', search.trim())
      if (pageToken) query.set('next_page_token', pageToken)
      else query.set('page', String(page))
      const data = await request(`${API_BASE}/voices?${query}`, { method: 'GET', redirect: 'error',
        headers: { 'xi-api-key': config.apiKey, accept: 'application/json' } }, config, MAX_JSON_BYTES, false, requestSignal(Math.min(config.timeoutMs, 30000)))
      if (!Array.isArray(data.voices)) throw new BreezeError('Breeze 音色列表缺少 voices 数组。', 'INVALID_RESPONSE')
      return {
        voices: data.voices.filter(v => v && typeof v.voice_id === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(v.voice_id)).map(v => ({
          voiceId: v.voice_id, name: redact(v.name || v.voice_id, config.apiKey),
          origin: redact(v.origin || '', config.apiKey), type: redact(v.voice_type || '', config.apiKey),
        })),
        hasMore: data.has_more === true,
        nextPageToken: typeof data.next_page_token === 'string' ? data.next_page_token : '',
        page: Number.isInteger(data.page) ? data.page : page,
        total: Number.isFinite(data.total) ? data.total : data.voices.length,
      }
    },
  }
}
