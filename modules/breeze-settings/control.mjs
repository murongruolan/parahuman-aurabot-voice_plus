// State/configuration for the independent console; no host source patches.
import { createHash } from 'node:crypto'
import { DEFAULTS } from './settings.mjs'

export const MODES = ['enhanced', 'official', 'off']
export const ENGINES = ['auto', 'edge', 'windows', 'cosyvoice', 'gptsovits', 'http']
const TEXT_LIMITS = { apiKey: 512, voiceId: 160, modelId: 120, languageCode: 2, instructions: 2000 }
const NUMBER_RULES = { guidanceScale: [1, 10], timeoutSeconds: [10, 600], retryDelaySeconds: [0, 10] }
const ORIGINAL_TEXT = { voice: 160, rate: 20, pitch: 20 }
const GROUPS = {
  cosyvoice: { text: { url: 2048, spkId: 160, instruct: 2000 }, numbers: { sampleRate: [8000, 96000] }, enums: { mode: ['sft', 'instruct'] } },
  gptsovits: { text: { url: 2048, refAudio: 4096, promptText: 4000, textLang: 20, promptLang: 20 } },
  http: { text: { urlTemplate: 4096, headers: 16000, body: 16000 }, numbers: { sampleRate: [8000, 96000] }, enums: { method: ['GET', 'POST'] } },
}
const EMOTION_KEYS = ['calm', 'playful', 'down', 'angry', 'excited', 'proud', 'whiny', 'lazy']
const EMOTION_LEGS = ['breezeblue', 'builtin']
const DEFAULT_EMOTION_ROUTING = Object.fromEntries(EMOTION_KEYS.map(key => [key, 'breezeblue']))
const DEFAULT_EMOTION_ROW = { instructions: '', guidance: 'follow' }
const DEFAULT_AROUSAL = { L: 2, M: 4, H: 6 }

function emotionTable(raw, current) {
  const base = object(current) ? current : {}
  const out = {}
  for (const key of EMOTION_KEYS) {
    const row = object(raw?.[key]) ? raw[key] : base[key] || DEFAULT_EMOTION_ROW
    const guidance = row.guidance === undefined || row.guidance === 'follow' ? 'follow' : number(row.guidance, [1, 10], '情绪 guidance')
    out[key] = { instructions: string(row.instructions ?? '', 2000, '情绪指令'), guidance }
  }
  return out
}
function arousalTable(raw, current) {
  const base = object(current) ? current : DEFAULT_AROUSAL
  const out = {}
  for (const key of ['L', 'M', 'H']) out[key] = number(object(raw) && raw[key] !== undefined ? raw[key] : (base[key] ?? DEFAULT_AROUSAL[key]), [1, 10], '唤醒度 guidance')
  return out
}
const object = v => v && typeof v === 'object' && !Array.isArray(v)
function fail(message) { throw new Error(message) }
function string(v, max, key) {
  if (typeof v !== 'string' || Array.from(v).length > max) fail(`${key} 格式错误或超过 ${max} 字符。`)
  return v.trim()
}
function number(v, range, key) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < range[0] || v > range[1]) fail(`${key} 必须在 ${range.join('–')} 之间。`)
  return v
}
function choice(v, allowed, key) { if (!allowed.includes(v)) fail(`${key} 选项无效。`); return v }

function emotionRouting(raw, current, endpointIds) {
  const out = { ...current }
  for (const [key, value] of Object.entries(object(raw) ? raw : fail('情绪路由格式无效。'))) {
    if (!EMOTION_KEYS.includes(key)) fail('不支持的情绪键：' + key)
    out[key] = choice(value, [...EMOTION_LEGS, ...endpointIds], '情绪路由')
  }
  return out
}
function emotionEndpoint(raw, current, id) {
  if (!object(raw)) fail('情绪端点格式无效。')
  const name = string(raw.name, 24, '端点名称')
  if (!name) fail('端点名称不能为空。')
  const method = choice(raw.method || 'GET', ['GET', 'POST'], '端点方式')
  const urlTemplate = string(raw.urlTemplate, 2048, '端点地址')
  if (!/^https?:\/\//.test(urlTemplate)) fail('端点地址需以 http(s):// 开头。')
  const body = raw.body === undefined ? (current?.body ?? '') : string(raw.body, 16000, '端点请求体')
  const headers = raw.headers === undefined || raw.headers === '' ? (current?.headers ?? '') : raw.headers === null ? '' : string(raw.headers, 16000, '端点请求头')
  return { id, name, method, urlTemplate, body, headers }
}
function emotionPreset(raw, current, endpointIds) {
  if (!object(raw)) fail('情绪预设格式无效。')
  const name = string(raw.name, 24, '预设名称')
  if (!name) fail('预设名称不能为空。')
  const voiceId = string(raw.voiceId ?? (current?.voiceId ?? ''), 160, '预设 Voice ID')
  if (voiceId && !/^[A-Za-z0-9_-]+$/.test(voiceId)) fail('预设 Voice ID 格式错误。')
  return {
    name, voiceId,
    routing: emotionRouting(object(raw.routing) ? raw.routing : current?.routing || DEFAULT_EMOTION_ROUTING, DEFAULT_EMOTION_ROUTING, endpointIds),
    emotions: emotionTable(raw.emotions, current?.emotions),
    arousal: arousalTable(raw.arousal, current?.arousal),
  }
}
export function emotionPatch(raw, current) {
  const base = { routing: {}, endpoints: [], templates: [], ...(object(current) ? current : {}) }
  const endpoints = []
  const ids = new Set()
  const rawEndpoints = object(raw) ? raw.endpoints : base.endpoints
  const items = Array.isArray(rawEndpoints) ? rawEndpoints : base.endpoints
  for (const item of items) {
    const id = typeof item?.id === 'string' && /^e[0-9]{1,3}$/.test(item.id) ? item.id : 'e' + (endpoints.length + 1)
    if (ids.has(id)) fail('端点序号重复。')
    ids.add(id)
    endpoints.push(emotionEndpoint(item, base.endpoints.find(e => e.id === id), id))
  }
  if (endpoints.length > 12) fail('情绪端点最多 12 个。')
  const names = new Set()
  for (const e of endpoints) { if (names.has(e.name)) fail('端点名称重复。'); names.add(e.name) }
  const endpointIds = endpoints.map(e => e.id)
  const routing = emotionRouting(object(raw) ? object(raw.routing) ? raw.routing : base.routing : base.routing, base.routing, endpointIds)
  const templates = []
  const rawTemplates = object(raw) ? raw.templates : base.templates
  const tpls = Array.isArray(rawTemplates) ? rawTemplates : base.templates
  for (const t of tpls) {
    templates.push(emotionPreset(t, base.templates.find(x => x?.name === t?.name), endpointIds))
  }
  if (templates.length > 10) fail('情绪预设最多 10 个。')
  return { endpoints, routing, templates, emotions: emotionTable(object(raw) ? raw.emotions : undefined, base.emotions), arousal: arousalTable(object(raw) ? raw.arousal : undefined, base.arousal) }
}
function maskedEmotion(ext) {
  const emo = object(ext?.emotion) ? ext.emotion : {}
  const epList = Array.isArray(emo.endpoints) ? emo.endpoints : []
  const tplList = Array.isArray(emo.templates) ? emo.templates : []
  return {
    routing: { ...DEFAULT_EMOTION_ROUTING, ...(object(emo.routing) ? emo.routing : {}) },
    endpoints: epList.filter(object).map(e => ({ ...e, headers: '', headersSet: Boolean(e.headers) })),
    templates: tplList.filter(object),
    emotions: emotionTable(object(emo.emotions) ? emo.emotions : {}, object(emo.emotions) ? emo.emotions : {}),
    arousal: arousalTable(object(emo.arousal) ? emo.arousal : {}, object(emo.arousal) ? emo.arousal : {}),
  }
}

export function extensionPatch(raw, current) {
  if (!object(raw)) fail('设置格式无效。')
  const patch = {}
  for (const [key, value] of Object.entries(raw)) {
    if (Object.hasOwn(TEXT_LIMITS, key)) {
      if (key === 'apiKey' && (value === '' || value === undefined)) continue // masked blank means keep
      if (key === 'apiKey' && value === null) { patch.apiKey = ''; continue }
      const text = string(value, TEXT_LIMITS[key], key)
      if (key === 'apiKey' && /[^\x21-\x7e]/.test(text)) fail('Key 不应包含空格或控制字符。')
      if (key === 'voiceId' && text && !/^[A-Za-z0-9_-]+$/.test(text)) fail('Voice ID 格式错误。')
      if (key === 'modelId' && text && !/^[A-Za-z0-9._-]+$/.test(text)) fail('模型 ID 格式错误。')
      if (key === 'languageCode' && text && !/^[A-Za-z]{2}$/.test(text)) fail('语言代码请留空或填写 zh / en。')
      patch[key] = key === 'languageCode' ? text.toLowerCase() : text
    } else if (Object.hasOwn(NUMBER_RULES, key)) patch[key] = number(value, NUMBER_RULES[key], key)
    else if (key === 'retryCount') {
      const retries = number(value, [0, 5], key)
      if (!Number.isInteger(retries)) fail('重试次数必须是 0–5 的整数。')
      patch[key] = retries
    } else if (key === 'provider') patch[key] = choice(value, ['builtin', 'breezeblue', 'emotion'], key)
    else if (key === 'outputFormat') patch[key] = choice(value, ['wav', 'wav_24000', 'mp3', 'mp3_24000_64', 'mp3_24000_96', 'mp3_24000_128', 'mp3_24000_160'], key)
    else if (key === 'emotion') patch[key] = emotionPatch(value, current?.emotion)
    else if (key === 'speakerBoost' || key === 'fallback' || key === 'promptTags') {
      if (typeof value !== 'boolean') fail(`${key} 必须是开关值。`)
      patch[key] = value
    } else fail('请求包含不支持的增强语音设置。')
  }
  return { ...current, ...patch }
}

export function originalPatch(raw, current) {
  if (!object(raw)) fail('原引擎设置格式无效。')
  const out = { ...current }
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'engine') out[key] = choice(value, ENGINES, key)
    else if (Object.hasOwn(ORIGINAL_TEXT, key)) out[key] = string(value, ORIGINAL_TEXT[key], key)
    else if (Object.hasOwn(GROUPS, key)) {
      if (!object(value)) fail('引擎参数格式无效。')
      const schema = GROUPS[key], group = { ...current?.[key] }
      for (const [field, val] of Object.entries(value)) {
        if (Object.hasOwn(schema.text || {}, field)) {
          if (key === 'http' && field === 'headers' && val === '') continue
          group[field] = key === 'http' && field === 'headers' && val === null ? '' : string(val, schema.text[field], field)
        } else if (Object.hasOwn(schema.numbers || {}, field)) group[field] = number(val, schema.numbers[field], field)
        else if (Object.hasOwn(schema.enums || {}, field)) group[field] = choice(val, schema.enums[field], field)
        else fail('请求包含不支持的引擎参数。')
      }
      out[key] = group
    } else fail('只能修改语音引擎相关配置。')
  }
  return out
}

export function requestedMode(cfg) {
  if (cfg.modules?.voice?.enabled === false || cfg.voice?.enabled === false) return 'off'
  return cfg.modules?.voice?.useBuiltin === true ? 'official' : 'enhanced'
}

export function modeConfig(cfg, mode) {
  choice(mode, MODES, '语音模式')
  if (cfg.safeMode && mode === 'enhanced') fail('安全模式仍开启，请先在「已安装」关闭安全模式。')
  return { ...cfg, voice: { ...cfg.voice, enabled: mode !== 'off' },
    modules: { ...cfg.modules, voice: { ...cfg.modules?.voice, enabled: mode !== 'off',
      ...(mode === 'off' ? {} : { useBuiltin: mode === 'official' }) } } }
}

export function revision(cfg) {
  return createHash('sha256').update(JSON.stringify({ ext: cfg.ext?.['breeze-settings'], voice: cfg.voice, module: cfg.modules?.voice, safe: cfg.safeMode })).digest('hex')
}

export function consoleState(api) {
  const cfg = api.config()
  const saved = api.settings()
  const ext = Object.fromEntries(Object.entries(DEFAULTS).map(([key, value]) => [key, saved[key] ?? value]))
  const rec = api.core.modules?.status?.().find(m => m.id === 'voice')
  const desired = requestedMode(cfg)
  const running = rec?.running || null
  const actual = !running || cfg.voice?.enabled === false ? 'off' : running === 'builtin' ? 'official' : 'enhanced'
  const voice = cfg.voice || {}
  const original = { engine: voice.engine || 'auto', voice: voice.voice || '', rate: voice.rate || '+0%', pitch: voice.pitch || '+0Hz' }
  for (const group of Object.keys(GROUPS)) {
    original[group] = {}
    for (const field of [...Object.keys(GROUPS[group].text || {}), ...Object.keys(GROUPS[group].numbers || {}), ...Object.keys(GROUPS[group].enums || {})]) {
      if (voice[group]?.[field] !== undefined) original[group][field] = voice[group][field]
    }
  }
  original.http.headersSet = Boolean(original.http.headers)
  original.http.headers = ''
  return { ok: true, revision: revision(cfg), requestedMode: desired, actualMode: actual, running,
    fallback: Boolean(rec?.fallback), safeMode: Boolean(cfg.safeMode),
    moduleError: typeof rec?.error === 'string' ? rec.error.replace(/brz_[A-Za-z0-9_-]+/g, '[已隐藏]').slice(0, 220) : '',
    settings: { ...ext, apiKey: '', apiKeySet: Boolean(ext.apiKey), emotion: maskedEmotion(ext) }, original,
    localTtsActive: Boolean(api.core.local?.active?.('tts')),
    rvcVoice: voice.songVoice || '',
    enhancedAvailable: Boolean(rec?.hasUser),
  }
}

export function saveConsole(api, body) {
  if (!object(body) || Object.keys(body).some(k => !['revision', 'settings', 'original'].includes(k))) fail('保存请求格式无效。')
  if (typeof body.revision !== 'string' || body.revision !== revision(api.config())) fail('配置已在其他页面变更。请刷新后重新编辑，避免覆盖。')
  api.setConfig(cfg => ({ ...cfg,
    ext: { ...cfg.ext, 'breeze-settings': extensionPatch(body.settings || {}, cfg.ext?.['breeze-settings'] || {}) },
    voice: originalPatch(body.original || {}, cfg.voice || {}),
  }))
  return consoleState(api)
}
