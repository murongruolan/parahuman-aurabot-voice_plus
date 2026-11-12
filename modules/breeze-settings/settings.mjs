// Settings live in cfg.ext["breeze-settings"]; core cfg.voice is untouched.
// 1.4.1 起为「引擎注册表 + 情绪路由」结构，不做旧配置向前兼容（用户明确授权）。
export const DEFAULTS = Object.freeze({
  outputFormat: 'wav', timeoutSeconds: 300, fallback: true,
  retryCount: 2, retryDelaySeconds: 1, speakerBoost: true,
  engines: [],
  emotions: [],
  strengths: [],
  presets: [],
})
export const SEED_EMOTIONS = Object.freeze([
  { name: '平静', code: 'calm' }, { name: '俏皮', code: 'playful' }, { name: '失落', code: 'down' }, { name: '生气', code: 'angry' },
  { name: '兴奋', code: 'excited' }, { name: '得意', code: 'proud' }, { name: '娇嗔', code: 'whiny' }, { name: '慵懒', code: 'lazy' },
])
export const SEED_STRENGTHS = Object.freeze([
  { id: 'l1', name: '轻度', value: 2, builtin: true }, { id: 's1', name: '标准', value: 4, builtin: true }, { id: 'h1', name: '强烈', value: 6, builtin: true },
])
export const FORMATS = ['wav', 'wav_24000', 'mp3', 'mp3_24000_64', 'mp3_24000_96', 'mp3_24000_128', 'mp3_24000_160']

/** 引擎与情绪路由为空时按默认种子补齐（只补不覆盖已有配置）。 */
export function withSeeds(ext) {
  if (!Array.isArray(ext.engines)) ext.engines = []
  if (!Array.isArray(ext.presets)) ext.presets = []
  if (!Array.isArray(ext.emotions) || !ext.emotions.length) {
    ext.emotions = SEED_EMOTIONS.map(e => ({ name: e.name, code: e.code, builtin: true, engine: null, instructions: '', strength: 'model', ref: { mode: 'none', path: '', text: '', param: '' } }))
  }
  if (!Array.isArray(ext.strengths) || !ext.strengths.length) ext.strengths = SEED_STRENGTHS.map(s => ({ ...s }))
  return ext
}
