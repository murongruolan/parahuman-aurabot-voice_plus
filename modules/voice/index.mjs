// 从 Aurabot v1.2.0 的内置模块「语音」复制出来的，改了就替换内置的。
// 原文件：src/modules/voice/index.js
const __lib = globalThis.aurabot.lib // 插件内部源码（复制出来后靠它找到插件里的文件）
// 内置模块：语音。把她的话念出来发语音条（edge-tts / Windows 语音 / CosyVoice / GPT-SoVITS / 本地接口），
// 面板里的试听、语音识别自检也在这里。
// 导出 speak(text) → { file, engine }：聊天中枢发语音时找它。替换这个模块就能换成任何你想要的念法。

import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { textToSpeech, edgeInstalled, installEdge, voiceConverters } from './tts.js'
import { createSongVoice } from './rvc.js'
import { createBreezeClient, redact, normalizeSettings } from './breezeblue.mjs'
import { panelAccessError } from './access.mjs'
import { parseVoiceTags, EmotionError } from './emotion.mjs'
const { toMono16k } = __lib('voice/wav.js')
const { fileOf } = __lib('local/local.js')

export default {
  id: 'voice',
  name: '语音 · BreezeBlue 扩展',
  version: '1.4.1',
  api: 1,
  description: '基于内置语音模块的用户副本：情绪引擎（Breeze / GPT-SoVITS）、保留原引擎、本地接口、RVC 与 ASR。',
  // Host 1.2.0 hides UI on same-name replacements. The companion breeze-settings module owns it.
  setup(api) {
    const { hub, onebot, local, http } = api.core
    const lifetime = new AbortController()
    const breeze = createBreezeClient({ signal: lifetime.signal })
    api.onDispose(() => lifetime.abort())

    // 引擎 API Key 存在配套模块的 engine-auth.json 里（不进配置、不进 /state）；
    // breeze-settings 停用时拿不到 Key，Breeze 腿自动走回退。
    const companion = () => api.has('breeze-settings') ? api.use('breeze-settings') : null
    const engineKey = id => { const c = companion(); const k = c && typeof c.getEngineKey === 'function' ? c.getEngineKey(id) : ''; return String(k || '') }
    const settings = () => {
      const defaults = { outputFormat: 'wav', timeoutSeconds: 300, fallback: true, retryCount: 2, retryDelaySeconds: 1, speakerBoost: true, engines: [], emotions: [], strengths: [], presets: [] }
      const ext = api.config().ext?.['breeze-settings']
      return { ...defaults, ...(ext && typeof ext === 'object' && !Array.isArray(ext) ? ext : {}) }
    }
    const redactAll = message => { let m = String(message ?? ''); for (const e of settings().engines) { const k = engineKey(e.id); if (k) m = redact(m, k) } return m }
    const safeMessage = error => redactAll(error?.message || error)
    const access = (req, method) => panelAccessError(req, method, api.config().security)
    // Chat-path fallbacks are silent by design; remember the last one so the console can show it.
    let lastFallback = null

    // 提示词补充规则（宿主官方机制，不改宿主源码）：标点 + 按挂载情绪动态生成的标记教学。
    api.rule((kind, cfg) => {
      const lines = ['- 写 <voice>…</voice> 里的语音内容时，句子之间用中文标点（，。！？）分隔，不要只靠空格分开几句话。']
      const ext = (((cfg || {}).ext || {})['breeze-settings']) || {}
      const emotions = Array.isArray(ext.emotions) ? ext.emotions.filter(e => e.engine) : []
      const strengths = Array.isArray(ext.strengths) ? ext.strengths : []
      const breezeOn = Array.isArray(ext.engines) && ext.engines.some(e => e.type === 'breeze' && e.promptTags !== false)
      if (emotions.length) {
        lines.push('- 语音可带情绪标记：<voice> 开头写 [情绪:强度]。可选情绪：' + emotions.map(e => e.code + ' ' + e.name).join(' / ') + '；强度：' + (strengths.length ? strengths.map(a => a.name).join('/') : 'L 轻 / M 标准 / H 强烈') + '，或由你自己判断。没有情绪就不写标记。')
        if (breezeOn) lines.push('- 需要副语言时在句中或句尾加 [whisper 气声] / [cry 哭腔] / [laugh 笑腔] / [sigh 叹气]，也可以直接用 Breeze 行内标签如 [笑] [叹气] [耳语] [哭声]。')
      }
      return lines
    })

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

    const pause = ms => new Promise((ok, fail) => {
      const timer = setTimeout(ok, ms)
      lifetime.signal.addEventListener('abort', () => { clearTimeout(timer); fail(new Error('语音模块已停用')) }, { once: true })
    })
    // 402（额度不足）连续 3 次 → 熔断 Breeze 腿 10 分钟自动恢复，避免空转。
    let breakerUntil = 0, count402 = 0
    // Retry: connection-level failures (no HTTP response) and 429 (rejected, never billed)
    // with exponential backoff. Other HTTP statuses and timeouts are never retried.
    async function speakBreeze(text, config) {
      if (Date.now() < breakerUntil) throw new Error(`Breeze 额度熔断中（连续 402×3），约 ${Math.ceil((breakerUntil - Date.now()) / 60000)} 分钟后自动恢复`)
      const max = Number.isFinite(config.retryCount) ? Math.floor(config.retryCount) : 2
      const attempts = Math.max(0, Math.min(max, 5))
      const secs = Number.isFinite(config.retryDelaySeconds) ? config.retryDelaySeconds : 1
      const baseDelay = Math.max(0, Math.min(secs, 60)) * 1000
      for (let attempt = 0; ; attempt++) {
        try {
          const result = await breezeSpeech(text, config)
          count402 = 0
          return result
        } catch (error) {
          if (error?.status === 402) {
            count402++
            if (count402 >= 3) { breakerUntil = Date.now() + 600000; api.log.warn('Breeze 连续 402×3：额度不足，Breeze 腿熔断 10 分钟后自动恢复') }
          } else if (error?.status !== 429) count402 = 0
          const retryable = !lifetime.signal.aborted && attempt < attempts && (error?.code === 'NETWORK_ERROR' || error?.status === 429)
          if (!retryable) throw error
          const wait = baseDelay * Math.pow(2, attempt)
          api.log.warn(`BreezeBlue ${error?.status === 429 ? '限流(429)' : '连接失败'}（${safeMessage(error)}），${Math.round(wait)} 毫秒后重试 ${attempt + 1}/${attempts}`)
          await pause(wait)
        }
      }
    }

    // Breeze 腿：把我们的风格标记换算回它官方的行内音频标签（zh 方括号形式）。
    const breezeTaggedText = (text, tags) => {
      const native = (tags.styles || []).map(s => BREEZE_NATIVE_TAGS[s]).filter(Boolean)
      return native.length ? text.trim() + ' ' + native.join(' ') : text
    }

    // 强度解析（实测铁律）：模型自选 → 用模型写的档位（没写按「标准」）；面板钉死 → 忽略模型写的；自定义 → 直接数值。
    function resolveStrength(row, tags, cfg) {
      const tierValue = id => { const t = cfg.strengths.find(s => s.id === id); return t ? t.value : 4 }
      const tokenTier = tags.arousal === 'L' ? 'l1' : tags.arousal === 'H' ? 'h1' : 's1'
      if (!row || row.strength === 'model') return tierValue(tokenTier)
      if (typeof row.strength === 'number') return row.strength
      return tierValue(row.strength)
    }
    function strengthLabel(row, tags, cfg) {
      if (!row || row.strength === 'model') {
        const t = cfg.strengths.find(s => s.id === (tags.arousal === 'L' ? 'l1' : tags.arousal === 'H' ? 'h1' : 's1'))
        return t ? t.name : '标准'
      }
      if (typeof row.strength === 'number') return '自定义 ' + row.strength
      const t = cfg.strengths.find(s => s.id === row.strength)
      return t ? t.name : '标准'
    }

    // 每个情绪的 Breeze 请求配置：指令留空 = 纯文本模式（guidance 恒 1.0，音色相似度增强生效）。
    function breezeConfig(engine, row, tags, cfg) {
      const hasRow = !!(row && row.engine === engine.id)
      const instructions = hasRow ? String(row.instructions || '').trim() : ''
      const guidance = instructions ? resolveStrength(hasRow ? row : null, tags, cfg) : 1
      return { base: engine.base, apiKey: engineKey(engine.id), voiceId: engine.voiceId,
        modelId: 'breeze-tts-2-multilingual', languageCode: 'zh',
        instructions, guidanceScale: Math.min(10, Math.max(1, guidance)), speakerBoost: cfg.speakerBoost,
        outputFormat: cfg.outputFormat, timeoutSeconds: cfg.timeoutSeconds,
        retryCount: cfg.retryCount, retryDelaySeconds: cfg.retryDelaySeconds }
    }

    // GPT-SoVITS 腿：POST 引擎地址，带文本 + 情绪代号 + 强度；参考模式按情绪卡片配置展开。
    async function speakGpt(cleanText, tags, engine, row) {
      const cfg = settings()
      if (lifetime.signal.aborted) throw new Error('语音模块已停用')
      const ref = (row && row.ref) || { mode: 'none', path: '', text: '', param: '' }
      const body = { text: cleanText, emotion: tags.emotion, strength: strengthLabel(row, tags, cfg) }
      if (ref.mode === 'path') { body.ref_audio_path = ref.path; body.prompt_text = ref.text }
      if (ref.mode === 'param') body.emotion_param = ref.param || tags.emotion
      const init = { method: 'POST', headers: { 'content-type': 'application/json', ...(engine.apiKey ? { authorization: 'Bearer ' + engine.apiKey } : {}) },
        body: JSON.stringify(body), signal: AbortSignal.any([lifetime.signal, AbortSignal.timeout(Math.max(10, cfg.timeoutSeconds) * 1000)]) }
      let response
      try { response = await globalThis.fetch(engine.base, init) }
      catch { throw new EmotionError('GPT-SoVITS 引擎连接失败（未收到响应）。', 'NETWORK_ERROR') }
      if (!response.ok) throw new EmotionError(`GPT-SoVITS 引擎返回 HTTP ${response.status}。`, 'HTTP_STATUS', response.status)
      const buf = Buffer.from(await response.arrayBuffer())
      if (!buf.length || buf.length > 32 * 1024 * 1024) throw new EmotionError('GPT-SoVITS 引擎响应过大或为空。', 'BAD_AUDIO')
      const head = buf.subarray(0, 16).toString('latin1')
      const type = head.startsWith('RIFF') && head.slice(8, 12) === 'WAVE' ? 'wav' : head.startsWith('ID3') || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) ? 'mp3' : head.startsWith('OggS') ? 'ogg' : null
      if (!type) throw new EmotionError('GPT-SoVITS 引擎没有返回可识别的音频（WAV/MP3/OGG）。', 'BAD_AUDIO')
      const dir = api.dataDir('gptsovits-cache')
      const file = join(dir, `gpt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${type}`)
      mkdirSync(dir, { recursive: true }); writeFileSync(file, buf)
      return { file, engine: engine.name }
    }

    async function speak(text) {
      if (lifetime.signal.aborted) throw new Error('语音模块已停用')
      // 情绪标记统一在最外层解析剔除：所有腿都只念干净的文本。
      const tags = parseVoiceTags(text)
      const cleanText = tags.text
      // Preserve the built-in local TTS takeover precedence and fallback behavior.
      if (local.active('tts')) {
        try {
          const file = fileOf(await local.call('tts', { text: cleanText }))
          if (file && existsSync(file)) return { file, engine: 'local' }
        } catch (error) {}
      }
      const cfg = settings()
      const row = tags.flagged ? cfg.emotions.find(e => e.code === tags.emotion) : null
      let engine = row && row.engine ? cfg.engines.find(x => x.id === row.engine) : null
      if (!engine) engine = cfg.engines[0] || null // 默认引擎 = 引擎列表第一个
      if (!engine) return textToSpeech(cleanText, api.config().voice, api.log)
      try {
        if (engine.type === 'gptsovits') return await speakGpt(cleanText, tags, engine, row)
        return await speakBreeze(breezeTaggedText(cleanText, tags), breezeConfig(engine, row, tags, cfg))
      } catch (error) {
        if (lifetime.signal.aborted || error?.code === 'ABORTED' || cfg.fallback !== true) throw error
        lastFallback = { at: Date.now(), reason: String(safeMessage(error)).slice(0, 120) }
        api.log.warn('情绪引擎：', safeMessage(error), '→ 回退原语音引擎')
      }
      if (lifetime.signal.aborted) throw new Error('语音模块已停用')
      return textToSpeech(cleanText, api.config().voice, api.log)
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
      return { ok: true, localTtsActive: Boolean(local.active('tts')), voiceEnabled: api.config().voice?.enabled !== false,
        lastFallback, breakerUntil }
    })
    api.route('/ext/breeze-settings/breeze/voices', async req => {
      const denied = access(req, 'POST')
      if (denied) return denied
      try {
        const b = await http.body(req)
        const engine = settings().engines.find(e => e.id === b.engineId && e.type === 'breeze')
        if (!engine) return { ok: false, message: '引擎不存在或不是 Breeze 类型。' }
        const apiKey = engineKey(engine.id)
        if (!apiKey) return { ok: false, message: '该引擎还没有保存 API Key。' }
        return { ok: true, ...await breeze.voices({ apiKey, voiceId: '', base: engine.base, timeoutSeconds: settings().timeoutSeconds }, {
          type: b.type || 'personal', search: b.search || '', pageToken: b.pageToken || '', page: b.page || 1,
        }) }
      } catch (error) { return { ok: false, message: safeMessage(error) } }
    })

    return { speak, edgeInstalled }
  },
}
