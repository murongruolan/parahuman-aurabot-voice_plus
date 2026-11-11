// 情绪路由：语音文本内的情绪标记解析 + 通用 HTTP 情绪端点适配。
// 标记语法（宿主编译器只认裸 <voice></voice>，因此情绪写在内容里，由本模块剥离）：
//   <voice>[excited:H]今天运气真好！[laugh]</voice>
//   <voice>[down:L]对不起…[cry]</voice>
//   无标记 = 默认 calm / M / 无风格。
import { randomUUID } from 'node:crypto'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export const EMOTIONS = {
  calm: { zh: '平静', instr: '语气平静、放松，平稳地述说' },
  playful: { zh: '俏皮', instr: '语气俏皮、轻快，带一点笑意' },
  down: { zh: '失落', instr: '语气失落、低沉，情绪蔫蔫的' },
  angry: { zh: '生气', instr: '语气生气、不满，声音带一点力度' },
  excited: { zh: '兴奋', instr: '语气兴奋、雀跃，情绪高昂' },
  proud: { zh: '得意', instr: '语气得意、神气，带点小骄傲' },
  whiny: { zh: '娇嗔', instr: '语气娇嗔、软糯，带一点小抱怨' },
  lazy: { zh: '慵懒', instr: '语气慵懒、慢悠悠，有点提不起劲' },
}
export const AROUSALS = {
  L: { zh: '低唤醒', instr: '整体能量低：气声多一些、音量略小、语速放慢、停顿拉长', speed: 0.85 },
  M: { zh: '中唤醒', instr: '用自然说话的能量与语速', speed: 1 },
  H: { zh: '高唤醒', instr: '能量拉满：语速加快、音调更高、更用力', speed: 1.15 },
}
export const STYLES = {
  whisper: { zh: '气声/耳语', instr: '用气声、耳语般的质感' },
  cry: { zh: '哭腔', instr: '带哭腔，声音有些颤抖哽咽' },
  laugh: { zh: '笑腔', instr: '带笑腔，边笑边说的感觉' },
  tremble: { zh: '颤音/哽咽', instr: '声音带着颤音和哽咽' },
  drawl: { zh: '拖腔/慵懒', instr: '拖腔、懒洋洋地把字音拉长' },
  growl: { zh: '压低嗓音/狠厉', instr: '压低嗓音，带一点狠厉的力度' },
  coquettish: { zh: '撒娇/上扬尾音', instr: '撒娇的口吻，尾音微微上扬' },
  sigh: { zh: '无奈/叹气', instr: '带着无奈的叹气' },
}
export const DEFAULT_ROUTING = Object.fromEntries(Object.keys(EMOTIONS).map(key => [key, 'breezeblue']))
// Breeze 原生行内音频标签（官方 docs/guides/audio-tags，zh 用方括号；英文环境用括号）。
// 无原生标签的风格（drawl/coquettish）只靠表演指令表达。
export const BREEZE_NATIVE_TAGS = {
  whisper: '[耳语]', cry: '[哭声]', laugh: '[笑]', tremble: '[呜咽]', sigh: '[叹气]', growl: '[闷哼]', drawl: '', coquettish: '',
}
const EMOTION_ALIAS = Object.fromEntries(Object.entries(EMOTIONS).flatMap(([key, v]) => [[key, key], [v.zh, key]]))
const AROUSAL_ALIAS = { L: 'L', M: 'M', H: 'H', l: 'L', m: 'M', h: 'H', 低: 'L', 中: 'M', 高: 'H', 低唤醒: 'L', 中唤醒: 'M', 高唤醒: 'H' }
const STYLE_ALIAS = Object.fromEntries(Object.entries(STYLES).flatMap(([key, v]) => [[key, key], [v.zh, key], [v.zh.split('/')[0], key], [v.zh.split('/')[1], key]].filter(x => x[0] && x[1])))

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const JOIN_RE = parts => new RegExp(parts.map(escapeRe).sort((a, b) => b.length - a.length).join('|'), 'u')

/** 从语音文本里解析并剥离情绪标记；不认识的方括号保持原样。 */
export function parseVoiceTags(raw) {
  const text = String(raw ?? '')
  let emotion = 'calm', arousal = 'M', styles = []
  const emotionRe = JOIN_RE(Object.keys(EMOTION_ALIAS))
  const arousalRe = JOIN_RE(Object.keys(AROUSAL_ALIAS))
  const styleRe = JOIN_RE(Object.keys(STYLE_ALIAS))
  const combo = new RegExp(`\\[(${emotionRe.source})(?:[:：](${arousalRe.source}))?\\]`, 'u')
  let flagged = false
  let rest = text.replace(combo, (_m, e, a) => {
    flagged = true
    emotion = EMOTION_ALIAS[e]
    if (a) arousal = AROUSAL_ALIAS[a]
    return ''
  })
  rest = rest.replace(new RegExp(`\\[(${styleRe.source})\\]`, 'gu'), (_m, s) => {
    flagged = true
    styles.push(STYLE_ALIAS[s])
    return ''
  })
  const cleaned = rest.replace(/[ \t]{2,}/g, ' ').trim()
  return { emotion, arousal, styles: [...new Set(styles)], text: cleaned, flagged }
}

/** 有情绪标记时，把情绪/唤醒/风格换算成 Breeze 表演指令与语速。 */
export function applyEmotion(config, tags) {
  if (!tags?.flagged) return config
  const emo = EMOTIONS[tags.emotion] || EMOTIONS.calm
  const arousal = AROUSALS[tags.arousal] || AROUSALS.M
  const parts = [emo.instr, arousal.instr, ...(tags.styles || []).map(s => (STYLES[s] || {}).instr).filter(Boolean)]
  const base = String(config.instructions || '').trim()
  const instructions = [base, ...parts].filter(Boolean).join('；')
  const speed = Math.min(2, Math.max(0.5, (Number(config.speed) || 1) * arousal.speed))
  // 动态表演指令需要更强的引导权重才听得出（官方示例 guidance 4.0）。
  const guidanceScale = Math.max(Number(config.guidanceScale) || 1, 2)
  return { ...config, instructions, speed, guidanceScale }
}

export class EmotionError extends Error {
  constructor(message, code = 'EMOTION_ERROR', status = 0) {
    super(message)
    this.name = 'EmotionError'
    this.code = code
    this.status = status
  }
}

/** 一行一个 "Name: Value" 的请求头文本 → 对象；不校验值，只为发送。 */
export function parseHeaders(text) {
  const headers = {}
  for (const line of String(text || '').split(/\r?\n/)) {
    const i = line.indexOf(':')
    if (i > 0 && i < line.length - 1) {
      const name = line.slice(0, i).trim()
      if (name && !/[^\x21-\x7e]/.test(name)) headers[name] = line.slice(i + 1).trim()
    }
  }
  return headers
}

const jsonEscape = value => JSON.stringify(String(value)).slice(1, -1)

/** URL 模板：占位符按 URL 编码替换。 */
export function fillUrl(template, values) {
  return String(template || '').replace(/\{(text|emotion|arousal|styles|reqid)\}/g, (_m, k) => encodeURIComponent(values[k] ?? ''))
}

/** POST 体模板：占位符按 JSON 字符串替换（键名/引号由模板自己写）。 */
export function fillBody(template, values) {
  return String(template || '').replace(/\{(text|emotion|arousal|styles|reqid)\}/g, (_m, k) => jsonEscape(values[k] ?? ''))
}

function sniff(buf) {
  const head = buf.subarray(0, 16).toString('latin1')
  if (head.startsWith('RIFF') && head.slice(8, 12) === 'WAVE') return 'wav'
  if (head.startsWith('ID3') || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return 'mp3'
  if (head.startsWith('OggS')) return 'ogg'
  return null
}

/**
 * 通用 HTTP 情绪端点：GET 用 URL 模板，POST 用体模板；单次请求、不自动重试。
 * 错误消息不包含请求头/URL（可能带鉴权信息）。
 */
export function createEmotionSynth({ fetchLike, signal, timeoutSeconds, directory }) {
  return async function synthesize(text, tags, endpoint) {
    if (!endpoint || !/^https?:\/\//.test(String(endpoint.urlTemplate || ''))) throw new EmotionError('情绪端点地址无效（需 http/https URL 模板）。', 'INVALID_ENDPOINT')
    const method = String(endpoint.method || 'GET').toUpperCase()
    if (!['GET', 'POST'].includes(method)) throw new EmotionError('情绪端点请求方式仅支持 GET/POST。', 'INVALID_ENDPOINT')
    const values = { text, emotion: tags.emotion, arousal: tags.arousal, styles: (tags.styles || []).join(','), reqid: randomUUID() }
    const headers = parseHeaders(endpoint.headers)
    let url = fillUrl(endpoint.urlTemplate, values)
    let body
    if (method === 'POST') {
      body = fillBody(endpoint.body || '{"text":"{text}"}', values)
      if (!Object.keys(headers).some(k => k.toLowerCase() === 'content-type')) headers['content-type'] = 'application/json'
    }
    let response
    try {
      response = await fetchLike(url, { method, headers, ...(body === undefined ? {} : { body }), signal: AbortSignal.any([signal, AbortSignal.timeout(Math.max(10, Number(typeof timeoutSeconds === 'function' ? timeoutSeconds() : timeoutSeconds) || 60) * 1000)]) })
    } catch (error) {
      throw new EmotionError('情绪端点连接失败（未收到响应）。', 'NETWORK_ERROR')
    }
    if (!response.ok) throw new EmotionError(`情绪端点返回 HTTP ${response.status}。`, 'HTTP_STATUS', response.status)
    const buf = Buffer.from(await response.arrayBuffer())
    if (!buf.length || buf.length > 32 * 1024 * 1024) throw new EmotionError('情绪端点响应过大或为空。', 'BAD_AUDIO')
    const type = sniff(buf)
    if (!type) throw new EmotionError('情绪端点没有返回可识别的音频（WAV/MP3/OGG）。', 'BAD_AUDIO')
    const file = join(directory, `emotion-${Date.now()}-${randomUUID().slice(0, 8)}.${type}`)
    mkdirSync(directory, { recursive: true })
    writeFileSync(file, buf)
    return { file, engine: endpoint.name }
  }
}