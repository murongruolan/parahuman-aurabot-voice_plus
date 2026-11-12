// 独立「情绪引擎」控制台后端：引擎注册表 + 情绪路由 + 预设；引擎 API Key 存模块数据目录（不进配置、不进 /state）。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { panelAccessError } from './access.mjs'
import { consoleState, saveConsole, revision, requestedMode, modeConfig } from './control.mjs'

export default {
  id: 'breeze-settings',
  name: '增强语音',
  version: '1.4.1',
  api: 1,
  description: '情绪引擎控制台：引擎注册表、情绪路由、强度档位与预设；支持 Breeze 与 GPT-SoVITS。',
  panel: 'panel.js',
  setup(api) {
    const authFile = () => api.dataDir('engine-auth.json')
    function readAuth() { try { const v = JSON.parse(readFileSync(authFile(), 'utf8')); return v && typeof v === 'object' ? v : {} } catch { return {} } }
    function writeAuth(map) { mkdirSync(join(authFile(), '..'), { recursive: true }); writeFileSync(authFile(), JSON.stringify(map, null, 2), { mode: 0o600 }) }
    function setEngineKey(id, key) { const m = readAuth(); if (key) m[id] = key; else delete m[id]; writeAuth(m) }
    function getEngineKey(id) { return String(readAuth()[id] || '') }

    const { http, modules } = api.core
    const fail = error => ({ ok: false, message: String(error?.message || '操作失败').replace(/brz_[A-Za-z0-9_-]+/g, '[已隐藏]').slice(0, 360) })
    const route = (path, method, handler) => api.route(path, async req => {
      const denied = panelAccessError(req, method, api.config().security)
      if (denied) return denied
      try { return await handler(req) } catch (error) { return fail(error) }
    })
    const withKeyState = state => {
      const auth = readAuth()
      return { ...state, engines: state.engines.map(e => ({ ...e, apiKey: '', apiKeySet: Boolean(auth[e.id]) })) }
    }

    route('/console/status', 'GET', () => withKeyState(consoleState(api)))

    route('/console/save', 'POST', async req => {
      const body = await http.body(req)
      if (Array.isArray(body.engines)) {
        const ids = new Set()
        for (const e of body.engines) {
          if (!e || typeof e.id !== 'string') continue
          ids.add(e.id)
          if (e.apiKey === null) setEngineKey(e.id, '')
          else if (typeof e.apiKey === 'string' && e.apiKey !== '') setEngineKey(e.id, e.apiKey)
        }
        for (const id of Object.keys(readAuth())) if (!ids.has(id)) setEngineKey(id, '')
        body.engines = body.engines.map(e => ({ ...e, apiKey: undefined }))
      }
      return withKeyState(saveConsole(api, body))
    })

    route('/console/test', 'POST', async req => {
      const body = await http.body(req)
      if (requestedMode(api.config()) === 'off') throw new Error('语音已关闭，请先在「已安装」里开启语音模块。')
      if (typeof body?.text !== 'string' || !body.text.trim() || Array.from(body.text).length > 200) throw new Error('试听请输入1–200个字符。')
      if (typeof body?.revision === 'string' && body.revision !== revision(api.config())) throw new Error('配置已变化，请刷新后再试听。')
      const voice = api.use('voice')
      if (typeof voice?.speak !== 'function') throw new Error('语音模块还未就绪。')
      const { file, engine } = await voice.speak(body.text)
      const buffer = readFileSync(file)
      if (buffer.length > 32 * 1024 * 1024) throw new Error('试听文件超过大小上限。')
      const mime = file.endsWith('.wav') ? 'audio/wav' : file.endsWith('.ogg') ? 'audio/ogg' : 'audio/mpeg'
      return { ok: true, engine, mime, data: buffer.toString('base64') }
    })

    route('/console/mode', 'POST', async req => {
      const body = await http.body(req)
      if (!body || Object.keys(body).some(k => !['mode', 'revision'].includes(k))) throw new Error('模式切换请求无效。')
      if (typeof body.revision !== 'string' || body.revision !== revision(api.config())) throw new Error('配置已变化，请刷新后再切换。')
      api.setConfig(cfg => modeConfig(cfg, body.mode))
      await modules.sync()
      if (body.mode === 'enhanced' && modules.running('voice') !== 'user') await modules.reload('voice')
      return { ok: true, mode: body.mode }
    })

    // voice 模块从这里取引擎 API Key；breeze-settings 停用时拿不到 Key，Breeze 腿自动走回退。
    return { getEngineKey, setEngineKey }
  },
}
