// 从 Aurabot v1.2.0 的内置模块「语音」复制出来的，改了就替换内置的。
// 原文件：src/modules/voice/index.js
const __lib = globalThis.aurabot.lib // 插件内部源码（复制出来后靠它找到插件里的文件）
// 内置模块：语音。把她的话念出来发语音条（edge-tts / Windows 语音 / CosyVoice / GPT-SoVITS / 本地接口），
// 面板里的试听、语音识别自检也在这里。
// 导出 speak(text) → { file, engine }：聊天中枢发语音时找它。替换这个模块就能换成任何你想要的念法。

import { existsSync, readFileSync } from 'node:fs'
import { textToSpeech, edgeInstalled, installEdge, voiceConverters } from './tts.js'
import { createSongVoice } from './rvc.js'
import { createBreezeClient, redact, normalizeSettings, DEFAULTS } from './breezeblue.mjs'
import { panelAccessError } from './access.mjs'
const { toMono16k } = __lib('voice/wav.js')
const { fileOf } = __lib('local/local.js')

export default {
  id: 'voice',
  name: '语音 · BreezeBlue 扩展',
  version: '1.0.0',
  api: 1,
  description: '基于内置语音模块的用户副本：新增 BreezeBlue，保留原引擎、本地接口、RVC 与 ASR。',
  // Host 1.2.0 hides UI on same-name replacements. The companion breeze-settings module owns it.
  setup(api) {
    const { hub, onebot, local, http } = api.core
    const lifetime = new AbortController()
    const breeze = createBreezeClient({ signal: lifetime.signal })
    api.onDispose(() => lifetime.abort())
    const settings = () => api.has('breeze-settings') ? { ...DEFAULTS, ...api.config().ext?.['breeze-settings'] } : { ...DEFAULTS }
    const safeMessage = error => redact(error?.message || error, settings().apiKey)
    const access = (req, method) => panelAccessError(req, method, api.config().security)

    async function breezeSpeech(text, config) {
      const result = await breeze.synthesize(text, config, api.dataDir('breezeblue-cache'))
      let file = result.file
      // Same converter registry as the unchanged forked tts.js; apply exactly once.
      for (const convert of voiceConverters) {
        if (lifetime.signal.aborted) throw new Error('语音模块已停用')
        try { file = await convert(file) } catch (error) { api.log.warn('变声失败，用原声：', safeMessage(error)) }
      }
      if (lifetime.signal.aborted) throw new Error('语音模块已停用')
      return { file, engine: 'breezeblue' }
    }

    async function speak(text) {
      if (lifetime.signal.aborted) throw new Error('语音模块已停用')
      // Preserve the built-in local TTS takeover precedence and fallback behavior.
      if (local.active('tts')) {
        try {
          const file = fileOf(await local.call('tts', { text }))
          if (file && existsSync(file)) return { file, engine: 'local' }
        } catch (error) {}
      }
      const config = settings()
      if (config.provider === 'breezeblue') {
        try { return await breezeSpeech(text, config) } catch (error) {
          if (lifetime.signal.aborted || error?.code === 'ABORTED' || config.fallback !== true) throw error
          api.log.warn('BreezeBlue 失败：', safeMessage(error), '→ 回退原语音引擎（未重复请求 Breeze）')
        }
      }
      if (lifetime.signal.aborted) throw new Error('语音模块已停用')
      return textToSpeech(text, api.config().voice, api.log)
    }

    // 语音条变声：如果面板里选了「翻唱里导入的音色」，TTS 后再用 RVC 换成她的声音。
    // 挂在 tts.js 的 voiceConverters 上（卸载时摘掉）；变声失败会保留 TTS 原声。
    const songVoice = createSongVoice({ getConfig: api.config, getSong: () => api.use('song'), dataDir: api.dataDir, log: api.log })
    voiceConverters.push(songVoice)
    api.onDispose?.(() => {
      const i = voiceConverters.indexOf(songVoice)
      if (i >= 0) voiceConverters.splice(i, 1)
    })

    // 面板「语音」页用：翻唱模块现成的音色列表 + 是否可用（只读，不触发任何转换）
    api.route('/voice/song-voices', async () => {
      const song = api.use('song')
      if (!song || typeof song.status !== 'function') return { ok: true, available: false, voices: [], message: '翻唱模块没在跑' }
      try {
        const st = song.status()
        return { ok: true, available: Boolean(st.ready), ready: Boolean(st.ready), voices: st.voices || [], selected: api.config().voice.songVoice || '', message: st.message || '' }
      } catch (error) {
        return { ok: false, available: false, voices: [], message: String(error.message || error) }
      }
    })

    api.route('/voice/test', async (req) => {
      const denied = access(req, 'POST')
      if (denied) return denied
      const b = await http.body(req)
      const { file, engine } = await speak(String(b.text || '你好呀，我是大肥鱼'))
      const buf = readFileSync(file)
      return { ok: true, engine, mime: file.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg', data: buf.toString('base64') }
    })
    api.route('/voice/install', async () => installEdge(api.log))

    // DSH 自带语音识别：看状态 / 下载模型
    const stt = () => api.dsh.get('speechToText')
    api.route('/voice/asr-status', async () => {
      const s0 = stt()
      if (!s0 || typeof s0.snapshot !== 'function') return { ok: false, enabled: false, message: 'DSH 里没有开启「语音输入」插件' }
      const s = s0.snapshot()
      const p = s.providers.find((x) => x.id === s.selection.providerId) || s.providers[0]
      return { ok: true, enabled: true, provider: p?.id, phase: p?.preparation?.phase || 'ready', detail: p?.preparation }
    })
    api.route('/voice/asr-prepare', async () => {
      const s0 = stt()
      if (!s0 || typeof s0.snapshot !== 'function') return { ok: false, message: 'DSH 里没有开启「语音输入」插件' }
      s0.prepare(s0.snapshot().selection.providerId)
      return { ok: true, message: '开始下载识别模型（约 200MB，下好后常驻本机）' }
    })
    // 自检「听语音」（真 QQ）：拿和某人私聊里最近一条语音，走一遍 get_record → 16k → DSH 识别
    api.route('/voice/asr-last', async (req) => {
      const b = await http.body(req)
      const uid = Number(b.userId || api.config().ownerQQ)
      const h = await onebot.call('get_friend_msg_history', { user_id: uid, count: 30 })
      const recs = (h?.messages || []).filter((m) => String(m.user_id) === String(uid)).flatMap((m) => (m.message || []).filter((s) => s.type === 'record').map((s) => ({ seg: s, time: m.time })))
      const last = recs.at(-1)
      if (!last) return { ok: false, message: '最近的聊天里没有对方发的语音' }
      const t = Date.now()
      const text = await hub.localTranscribe(last.seg)
      return { ok: Boolean(text), heard: text, at: new Date(last.time * 1000).toLocaleString(), ms: Date.now() - t }
    })
    // 自检「听语音」：Windows 语音念一句 → 转 16k 单声道 → DSH 自带识别 → 看能不能认回来
    api.route('/voice/asr-test', async (req) => {
      const b = await http.body(req)
      const s0 = stt()
      if (!s0 || typeof s0.resolve !== 'function') return { ok: false, message: 'DSH 里没有开启语音识别（设置 → 插件 → 语音输入）' }
      const text = String(b.text || '今天想吃白米饭')
      const { file } = await textToSpeech(text, { engine: 'windows' })
      const t = Date.now()
      const spec = s0.resolve({ audio: new Uint8Array(toMono16k(readFileSync(file))) })
      const r = await s0.transcribe(spec, AbortSignal.timeout(120000))
      const heard = typeof r === 'string' ? r : r?.text || r?.transcript || JSON.stringify(r)
      return { ok: Boolean(heard), said: text, heard, ms: Date.now() - t }
    })

    // Companion UI calls these routes by the exact namespace registered below; it never sees the key.
    api.route('/ext/breeze-settings/breeze/status', req => {
      const denied = access(req, 'GET')
      if (denied) return denied
      const config = settings()
      let valid = true, message = ''
      try { normalizeSettings(config) } catch (error) { valid = false; message = safeMessage(error) }
      return { ok: true, provider: config.provider, configured: valid,
        keySet: Boolean(config.apiKey), voiceId: config.voiceId || '',
        localTtsActive: Boolean(local.active('tts')), voiceEnabled: api.config().voice?.enabled !== false,
        message }
    })
    api.route('/ext/breeze-settings/breeze/voices', async req => {
      const denied = access(req, 'POST')
      if (denied) return denied
      try {
        const b = await http.body(req)
        return { ok: true, ...await breeze.voices(settings(), {
          type: b.type || 'personal', search: b.search || '', pageToken: b.pageToken || '', page: b.page || 1,
        }) }
      } catch (error) { return { ok: false, message: safeMessage(error) } }
    })
    api.route('/ext/breeze-settings/breeze/test', async req => {
      const denied = access(req, 'POST')
      if (denied) return denied
      try {
        const b = await http.body(req)
        const config = settings()
        // A supplied unsaved key/provider is deliberately ignored. Save first.
        if (typeof b.text !== 'string' || !b.text.trim() || Array.from(b.text).length > 200) {
          return { ok: false, message: '试听请输入 1–200 个字符；每次试听都会调用平台并计费。' }
        }
        const { file, engine } = await breezeSpeech(b.text, config)
        const buf = readFileSync(file)
        return { ok: true, engine, mime: file.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg', data: buf.toString('base64') }
      } catch (error) { return { ok: false, message: safeMessage(error) } }
    })

    return { speak, edgeInstalled }
  },
}
