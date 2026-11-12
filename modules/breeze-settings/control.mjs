// 情绪引擎控制台后端：引擎注册表 + 情绪路由 + 强度档位 + 预设。不做旧配置向前兼容。
import { createHash } from 'node:crypto'
import { DEFAULTS, FORMATS, withSeeds } from './settings.mjs'

export const MODES = ['enhanced', 'official', 'off']
function fail(m) { throw new Error(m) }
const object = v => v && typeof v === 'object' && !Array.isArray(v)
function str(v, max, key) { if (typeof v !== 'string' || Array.from(v).length > max) fail(`${key} 格式错误或超过 ${max} 字符。`); return v.trim() }
function num(v, range, key) { if (typeof v !== 'number' || !Number.isFinite(v) || v < range[0] || v > range[1]) fail(`${key} 必须在 ${range.join('–')} 之间。`); return v }
function bool(v, key) { if (typeof v !== 'boolean') fail(`${key} 必须是开关值。`); return v }
function choice(v, allowed, key) { if (!allowed.includes(v)) fail(`${key} 选项无效。`); return v }
const ENGINE_TYPES = ['breeze', 'gptsovits']

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
  return createHash('sha256').update(JSON.stringify({ ext: cfg.ext?.['breeze-settings'], voice: cfg.voice?.enabled, module: cfg.modules?.voice, safe: cfg.safeMode })).digest('hex')
}

function engineRow(raw, current) {
  if (!object(raw)) fail('引擎格式无效。')
  const id = typeof raw.id === 'string' && /^e[0-9a-z]{1,24}$/i.test(raw.id) ? raw.id : (current?.id || fail('引擎 id 缺失。'))
  const name = str(raw.name, 24, '引擎名称'); if (!name) fail('引擎名称不能为空。')
  const type = choice(raw.type || current?.type || 'breeze', ENGINE_TYPES, '引擎类型')
  const base = str(raw.base ?? current?.base ?? '', 2048, '服务地址'); if (!/^https?:\/\//.test(base)) fail('服务地址需以 http(s):// 开头。')
  const out = { id, name, type, base, addedAt: str(raw.addedAt ?? current?.addedAt ?? '', 24, '添加时间') }
  if (type === 'breeze') {
    const voiceId = str(raw.voiceId ?? current?.voiceId ?? '', 160, 'Voice ID'); if (!/^[A-Za-z0-9_-]{1,160}$/.test(voiceId)) fail('Voice ID 格式错误。')
    out.voiceId = voiceId
    out.promptTags = raw.promptTags === undefined ? (current?.promptTags ?? true) : bool(raw.promptTags, '情绪标记提示词')
  }
  return out
}
function emotionRow(raw, current) {
  if (!object(raw)) fail('情绪格式无效。')
  const name = str(raw.name, 24, '情绪名称'); if (!name) fail('情绪名称不能为空。')
  const code = str(raw.code, 20, '情绪代号'); if (!/^[a-z][a-z0-9_-]{0,19}$/.test(code)) fail('情绪代号格式错误。')
  const engine = raw.engine === undefined ? (current?.engine ?? null) : (raw.engine === null || raw.engine === '' ? null : str(raw.engine, 40, '情绪引擎'))
  const instructions = str(raw.instructions ?? current?.instructions ?? '', 2000, '情绪指令')
  const strength = raw.strength === undefined ? (current?.strength ?? 'model')
    : raw.strength === 'model' ? 'model' : typeof raw.strength === 'number' ? num(raw.strength, [1, 10], '强度') : str(raw.strength, 24, '强度')
  const r = object(raw.ref) ? raw.ref : current?.ref || {}
  const ref = { mode: choice(r.mode ?? current?.ref?.mode ?? 'none', ['none', 'path', 'param'], '参考配置'),
    path: str(r.path ?? current?.ref?.path ?? '', 4096, '音频路径'), text: str(r.text ?? current?.ref?.text ?? '', 4000, '音频文字'), param: str(r.param ?? current?.ref?.param ?? '', 80, '参考参数') }
  return { name, code, builtin: Boolean(raw.builtin ?? current?.builtin ?? false), engine, instructions, strength, ref }
}
function strengthRow(raw, current) {
  if (!object(raw)) fail('强度档格式无效。')
  const id = typeof raw.id === 'string' && /^[a-z0-9]{1,24}$/i.test(raw.id) ? raw.id : (current?.id || fail('强度档 id 缺失。'))
  const name = str(raw.name, 12, '强度名称'); if (!name) fail('强度名称不能为空。')
  const value = num(raw.value ?? current?.value, [1, 10], '强度 guidance')
  return { id, name, value, builtin: Boolean(raw.builtin ?? current?.builtin ?? false) }
}
function presetRow(raw, current, engineIds) {
  if (!object(raw)) fail('预设格式无效。')
  const name = str(raw.name, 24, '预设名称'); if (!name) fail('预设名称不能为空。')
  const r = object(raw.route) ? raw.route : current?.route || {}
  const emotions = [].concat(Array.isArray(r.emotions) ? r.emotions : []).map(x => emotionRow(x, null))
  if (emotions.length > 24) fail('预设内情绪最多 24 个。')
  const strengths = [].concat(Array.isArray(r.strengths) ? r.strengths : []).map(x => strengthRow(x, null))
  if (strengths.length > 12) fail('预设内强度档最多 12 个。')
  return { name, route: { emotions, strengths } }
}
function advancedPatch(raw, current) {
  const base = { ...DEFAULTS, ...(object(current) ? current : {}) }
  const r = object(raw) ? raw : {}
  return {
    outputFormat: choice(r.outputFormat ?? base.outputFormat, FORMATS, '输出格式'),
    timeoutSeconds: num(r.timeoutSeconds ?? base.timeoutSeconds, [10, 600], '请求超时'),
    fallback: bool(r.fallback ?? base.fallback, '失败回退'),
    retryCount: typeof r.retryCount === 'number' ? num(r.retryCount, [0, 5], '重试次数') : base.retryCount,
    retryDelaySeconds: typeof r.retryDelaySeconds === 'number' ? num(r.retryDelaySeconds, [0, 10], '重试间隔') : base.retryDelaySeconds,
    speakerBoost: bool(r.speakerBoost ?? base.speakerBoost, '音色相似度增强'),
  }
}
function keyOf(list, id, key) { return list.find(x => x[key] === id) }

export function saveConsole(api, body) {
  if (!object(body) || Object.keys(body).some(k => !['revision', 'engines', 'emotions', 'strengths', 'presets', 'advanced'].includes(k))) fail('保存请求格式无效。')
  if (typeof body.revision !== 'string' || body.revision !== revision(api.config())) fail('配置已在其他页面变更。请刷新后重新编辑，避免覆盖。')
  const prev = withSeeds({ ...api.config().ext?.['breeze-settings'] })
  const engines = []
  const eids = new Set()
  for (const raw of [].concat(Array.isArray(body.engines) ? body.engines : prev.engines)) {
    const e = engineRow(raw, keyOf(prev.engines, raw?.id, 'id'))
    if (eids.has(e.id)) fail('引擎 id 重复。'); eids.add(e.id); engines.push(e)
  }
  if (engines.length > 12) fail('引擎最多 12 个。')
  const enames = new Set()
  for (const e of engines) { if (enames.has(e.name)) fail('引擎名称重复。'); enames.add(e.name) }
  const engineIds = engines.map(e => e.id)
  const emotions = []
  const codes = new Set()
  for (const raw of [].concat(Array.isArray(body.emotions) ? body.emotions : prev.emotions)) {
    const e = emotionRow(raw, keyOf(prev.emotions, raw?.code, 'code'))
    if (codes.has(e.code)) fail('情绪代号重复。'); codes.add(e.code)
    if (e.engine && !engineIds.includes(e.engine)) fail('情绪挂载了不存在的引擎。')
    emotions.push(e)
  }
  if (emotions.length > 24) fail('情绪最多 24 个。')
  const strengths = []
  const sids = new Set()
  for (const raw of [].concat(Array.isArray(body.strengths) ? body.strengths : prev.strengths)) {
    const s = strengthRow(raw, keyOf(prev.strengths, raw?.id, 'id'))
    if (sids.has(s.id)) fail('强度档 id 重复。'); sids.add(s.id); strengths.push(s)
  }
  if (strengths.length > 12) fail('强度档最多 12 个。')
  const presets = []
  const pnames = new Set()
  for (const raw of [].concat(Array.isArray(body.presets) ? body.presets : prev.presets)) {
    const p = presetRow(raw, keyOf(prev.presets, raw?.name, 'name'), engineIds)
    if (pnames.has(p.name)) fail('预设名称重复。'); pnames.add(p.name); presets.push(p)
  }
  if (presets.length > 10) fail('预设最多 10 套。')
  const advanced = advancedPatch(body.advanced, prev.advanced)
  api.setConfig(cfg => ({ ...cfg, ext: { ...cfg.ext, 'breeze-settings': { engines, emotions, strengths, presets, advanced } } }))
  return consoleState(api)
}

export function consoleState(api) {
  const cfg = api.config()
  const ext = withSeeds({ ...(object(cfg.ext?.['breeze-settings']) ? cfg.ext['breeze-settings'] : {}) })
  return {
    ok: true, revision: revision(cfg),
    engines: [].concat(ext.engines).map(e => ({ ...e, apiKey: '', apiKeySet: Boolean(e.apiKey) })),
    emotions: [].concat(ext.emotions),
    strengths: [].concat(ext.strengths),
    presets: [].concat(ext.presets),
    advanced: advancedPatch(ext.advanced, ext.advanced),
  }
}
