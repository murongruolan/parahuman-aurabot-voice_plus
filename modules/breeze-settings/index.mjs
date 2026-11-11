import { readFileSync, statSync } from 'node:fs'
import { DEFAULTS } from './settings.mjs'
import { panelAccessError } from './access.mjs'
import { consoleState, modeConfig, revision, saveConsole } from './control.mjs'

// Stable ID preserves 1.0.0 settings. No tab: the official host gives this console its own page.
export default {
  id: 'breeze-settings',
  name: '增强语音',
  version: '1.1.1',
  api: 1,
  description: '官方 / 增强 / 关闭互斥切换；按引擎组织配置，保留原有语音能力。',
  defaults: DEFAULTS,
  panel: 'panel.js',
  setup(api) {
    // Custom panel replaces the automatic form, but the host must still mask/store the password.
    const { registerSecretField } = api.lib('core/config.js')
    registerSecretField(['ext', 'breeze-settings', 'apiKey'])
    const { http, modules } = api.core
    const fail = error => ({ ok: false, message: String(error?.message || '操作失败').split(String(api.settings().apiKey || '\0')).join('[已隐藏]').replace(/brz_[A-Za-z0-9_-]+/g, '[已隐藏]').slice(0, 360) })
    const route = (path, method, handler) => api.route(path, async req => {
      const denied = panelAccessError(req, method, api.config().security)
      if (denied) return denied
      try { return await handler(req) } catch (error) { return fail(error) }
    })
    let switching = false
    route('/console/status', 'GET', () => consoleState(api))
    route('/console/save', 'POST', async req => {
      const body = await http.body(req)
      if (switching) throw new Error('正在切换语音，请稍候再保存。')
      return saveConsole(api, body)
    })
    route('/console/test', 'POST', async req => {
      const body = await http.body(req)
      if (switching) throw new Error('正在切换语音，请稍候再试听。')
      const state = consoleState(api)
      if (body?.revision !== state.revision) throw new Error('配置已经变化，请刷新后再试听。')
      if (state.actualMode === 'off') throw new Error('语音已关闭，请先选择官方或增强模式。')
      if (typeof body?.text !== 'string' || !body.text.trim() || Array.from(body.text).length > 200) throw new Error('试听请输入1–200个字符。')
      const voice = api.use('voice')
      if (typeof voice?.speak !== 'function') throw new Error('语音模块还未就绪。')
      const { file, engine } = await voice.speak(body.text)
      if (statSync(file).size > 32 * 1024 * 1024) throw new Error('试听文件超过大小上限。')
      const buffer = readFileSync(file)
      const mime = file.endsWith('.wav') ? 'audio/wav' : file.endsWith('.ogg') ? 'audio/ogg' : 'audio/mpeg'
      return { ok: true, engine, mime, data: buffer.toString('base64') }
    })
    route('/console/mode', 'POST', async req => {
      const body = await http.body(req)
      if (!body || Object.keys(body).some(k => !['mode', 'revision'].includes(k))) throw new Error('模式切换请求无效。')
      if (switching) throw new Error('正在切换语音，请稍候。')
      if (body.revision !== revision(api.config())) throw new Error('配置已经变化，请刷新后再切换。')
      if (body.mode === 'enhanced' && !consoleState(api).enhancedAvailable) throw new Error('找不到用户 voice 模块，请先安装配套 voice 文件夹。')
      switching = true
      try {
        api.setConfig(cfg => modeConfig(cfg, body.mode))
        // setConfig may already trigger sync; let it finish before explicitly restarting unchanged files.
        await modules.sync()
        if (body.mode === 'enhanced' && modules.running('voice') !== 'user') await modules.reload('voice')
        return consoleState(api)
      } finally { switching = false }
    })
    return {}
  },
}
