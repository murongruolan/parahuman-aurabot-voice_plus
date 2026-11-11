// Self-contained official user-module panel. Scoped CSS only; no host DOM changes.
const { useState, useEffect, useRef } = React
const modeNames = { enhanced: '增强语音', official: '官方语音', off: '关闭语音' }
const engines = [['auto', '自动（edge / Windows）'], ['edge', '微软 edge-tts'], ['windows', 'Windows 自带'], ['cosyvoice', '本地 CosyVoice'], ['gptsovits', '本地 GPT-SoVITS'], ['http', '其他 HTTP 接口']]
const css = `
.vp{--vp-line:var(--ab-line,#dce3eb);--vp-card:var(--ab-card,#fff);--vp-text:var(--ab-text,#253247);--vp-muted:var(--ab-muted,#69768a);--vp-accent:#317096;color:var(--vp-text);grid-column:1/-1;max-width:1160px;width:100%;margin:0 auto;font-size:14px;line-height:1.55}
.vp *{box-sizing:border-box}.vp h2,.vp h3,.vp p{margin:0}.vp button,.vp input,.vp textarea,.vp select{font:inherit}.vp button{cursor:pointer}.vp button:disabled{opacity:.48;cursor:not-allowed}.vp :focus-visible{outline:3px solid #4b9bc5;outline-offset:3px}
.vp-head{display:flex;justify-content:space-between;gap:16px;align-items:center;margin:4px 0 20px}.vp-head h2{font-size:25px;letter-spacing:-.6px}.vp-sub{color:var(--vp-muted);font-size:13px;margin-top:5px!important}.vp-badge{border:1px solid var(--vp-line);border-radius:20px;padding:6px 12px;white-space:nowrap;font-size:12px}
.vp-modes{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px}.vp-mode{border:1px solid var(--vp-line);border-radius:12px;background:var(--vp-card);color:inherit;padding:14px 16px;text-align:left}.vp-mode strong{display:block;font-weight:650}.vp-mode span{display:block;color:var(--vp-muted);font-size:12px;margin-top:3px}.vp-mode[aria-checked=true]{border-color:var(--vp-accent);box-shadow:inset 0 0 0 1px var(--vp-accent)}
.vp-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(280px,1fr);gap:18px;align-items:start}.vp-card{background:var(--vp-card);border:1px solid var(--vp-line);border-radius:14px;padding:21px}.vp-card h3{font-size:16px}.vp-card+.vp-card{margin-top:16px}.vp-side{position:sticky;top:14px}
.vp-tabs{display:flex;gap:6px;padding:5px;background:var(--ab-card-2,rgba(110,135,159,.08));border-radius:9px;margin:0 0 20px}.vp-tab{flex:1;border:0;background:transparent;color:var(--vp-muted);padding:9px 8px;border-radius:7px}.vp-tab[aria-selected=true]{background:var(--vp-card);box-shadow:0 1px 4px #0001;color:var(--vp-text);font-weight:600}
.vp-fields{display:grid;grid-template-columns:1fr 1fr;gap:15px}.vp-field{display:flex;flex-direction:column;gap:6px;min-width:0;font-size:13px}.vp-field.wide{grid-column:1/-1}.vp-field>span{font-weight:550}.vp-input{width:100%;border:1px solid var(--vp-line);border-radius:8px;color:var(--vp-text);background:var(--ab-card-2,transparent);padding:9px 11px;min-width:0}.vp-input[readonly]{color:var(--vp-muted)}.vp-input::placeholder{color:var(--vp-muted);opacity:.75}textarea.vp-input{min-height:88px;resize:vertical}
.vp-hint{font-size:12px;color:var(--vp-muted)}.vp-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.vp-row.grow>*:first-child{flex:1;min-width:140px}.vp-btn{border:1px solid var(--vp-line);border-radius:8px;padding:8px 13px;background:var(--vp-card);color:inherit;white-space:nowrap}.vp-btn.primary{background:var(--vp-accent);color:white;border-color:var(--vp-accent)}.vp-btn.small{font-size:12px;padding:6px 10px}.vp-divider{height:1px;background:var(--vp-line);margin:18px 0}.vp-details{margin-top:19px;border-top:1px solid var(--vp-line);padding-top:13px}.vp-details summary{cursor:pointer;font-size:13px;font-weight:550}.vp-details .vp-fields{margin-top:15px}.vp-toggle{display:flex;align-items:flex-start;gap:9px;font-size:13px}.vp-toggle input{margin-top:4px;accent-color:var(--vp-accent)}
.vp-note{padding:10px 13px;border-radius:8px;border:1px solid var(--vp-line);margin-bottom:14px!important;font-size:13px;background:var(--ab-card-2,transparent)}.vp-note.warn{border-color:#a17a3680}.vp-note.err{border-color:#b85d6580;color:var(--ab-danger,#ba4a54)}.vp-footer{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:18px}.vp-picker{border:1px solid var(--vp-line);padding:12px;border-radius:10px;margin:14px 0}.vp-picker select{margin-top:9px}.vp-preview{margin-top:15px}.vp-preview audio{width:100%;margin:12px 0 6px}.vp-side p{margin-top:10px}.vp-guide{padding-left:18px;margin:12px 0 0;color:var(--vp-muted);font-size:13px}.vp-guide li+li{margin-top:7px}.vp-info{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--vp-line);font-size:12px}.vp-info span:first-child{color:var(--vp-muted)}.vp a{color:var(--vp-accent)}
@media(max-width:760px){.vp-grid{grid-template-columns:1fr}.vp-side{position:static}.vp-card{padding:16px}.vp-head{align-items:flex-start}.vp-modes{gap:6px}.vp-mode{padding:10px}.vp-mode span{font-size:11px}.vp-fields{grid-template-columns:1fr}.vp-field.wide{grid-column:auto}.vp-footer{flex-wrap:wrap}}
`
return function VoicePlusPanel({ toast, reload }) {
  const [snapshot, setSnapshot] = useState(null)
  const [edits, setEdits] = useState({})
  const [originalEdits, setOriginalEdits] = useState({})
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [text, setText] = useState('你好，今天也要照顾好自己。')
  const [audio, setAudio] = useState(null)
  const [voices, setVoices] = useState([])
  const [picker, setPicker] = useState(false)
  const [type, setType] = useState('personal')
  const [search, setSearch] = useState('')
  const [pageInfo, setPageInfo] = useState({ page: 1, nextPageToken: '', hasMore: false })
  const live = useRef(false), locked = useRef(false), dirtyRef = useRef(false), audioUrl = useRef('')
  const dirty = Object.keys(edits).length > 0 || Object.keys(originalEdits).length > 0
  dirtyRef.current = dirty
  const config = { ...(snapshot?.settings || {}), ...edits }
  const original = { ...(snapshot?.original || {}), ...originalEdits }
  for (const group of ['http', 'cosyvoice', 'gptsovits']) original[group] = { ...(snapshot?.original?.[group] || {}), ...(originalEdits[group] || {}) }
  const provider = snapshot?.actualMode === 'official' ? 'builtin' : config.provider || 'builtin'
  const replace = r => {
    setSnapshot(r); setEdits({}); setOriginalEdits({})
    if (audioUrl.current) { URL.revokeObjectURL(audioUrl.current); audioUrl.current = '' }
    setAudio(null)
  }

  useEffect(() => {
    live.current = true
    const refresh = () => {
      if (locked.current || dirtyRef.current) return
      call('/console/status').then(r => { if (!live.current || locked.current || dirtyRef.current) return; if (r.ok === false) setError(r.message); else setSnapshot(r) }).catch(() => { if (live.current) setError('读不到控制台，请确认配套模块已启用。') })
    }
    refresh()
    const timer = setInterval(refresh, 5000)
    const leave = e => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', leave)
    return () => { live.current = false; clearInterval(timer); window.removeEventListener('beforeunload', leave); if (audioUrl.current) URL.revokeObjectURL(audioUrl.current) }
  }, [])

  const update = (key, value) => setEdits(previous => {
    const next = { ...previous }
    if (value === snapshot?.settings?.[key] || (key === 'apiKey' && value === '')) delete next[key]; else next[key] = value
    return next
  })
  const updateOriginal = (key, value, group) => setOriginalEdits(previous => {
    const next = { ...previous }
    if (group) {
      const part = { ...next[group] }
      if (value === snapshot?.original?.[group]?.[key] || (group === 'http' && key === 'headers' && value === '')) delete part[key]; else part[key] = value
      if (Object.keys(part).length) next[group] = part; else delete next[group]
    } else if (value === snapshot?.original?.[key]) delete next[key]; else next[key] = value
    return next
  })
  async function action(label, work) {
    if (locked.current) return
    locked.current = true; setBusy(label); setError('')
    try { await work() } catch (e) { if (live.current) setError(String(e.message || '操作失败')) }
    finally { locked.current = false; if (live.current) setBusy('') }
  }
  async function checked(path, body) { const r = await call(path, body); if (r.ok === false) throw new Error(r.message || '操作未完成'); return r }
  const saveAll = () => action('save', async () => {
    const r = await checked('/console/save', { revision: snapshot.revision, settings: edits, original: originalEdits })
    if (live.current) { replace(r); toast?.('语音设置已保存'); reload?.() }
  })
  const setMode = mode => action('mode', async () => {
    if (dirty) throw new Error('请先保存或撤销未保存的配置，再切换模式。')
    const r = await checked('/console/mode', { revision: snapshot.revision, mode })
    if (live.current) { replace(r); toast?.(r.actualMode === mode ? '已切换为' + modeNames[mode] : '期望模式与实际运行不一致，请查看提示'); reload?.() }
  })
  const refresh = () => action('refresh', async () => { const r = await checked('/console/status'); if (live.current) replace(r) })
  const loadVoices = more => action('voices', async () => {
    const r = await checked('/breeze/voices', { type, search, page: more ? pageInfo.page + 1 : 1, pageToken: more ? pageInfo.nextPageToken : '' })
    if (live.current) { setVoices(old => [...new Map([...(more ? old : []), ...(r.voices || [])].map(v => [v.voiceId, v])).values()]); setPageInfo(r); setPicker(true) }
  })
  const preview = () => action('test', async () => {
    if (dirty) throw new Error('请先保存配置再试听。')
    const r = await checked('/console/test', { revision: snapshot.revision, text })
    if (!live.current) return
    if (!r.data || !['audio/wav', 'audio/mpeg', 'audio/ogg'].includes(r.mime)) throw new Error('没有收到可播放音频。')
    const bytes = Uint8Array.from(atob(r.data), ch => ch.charCodeAt(0)), url = URL.createObjectURL(new Blob([bytes], { type: r.mime }))
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current)
    audioUrl.current = url; setAudio({ url, mime: r.mime, engine: r.engine }); toast?.('合成成功 · ' + r.engine)
  })
  const btn = (label, onClick, options = {}) => h('button', { type: 'button', className: 'vp-btn', disabled: Boolean(busy), onClick, ...options }, label)
  const field = (label, value, onChange, options = {}) => h('label', { className: 'vp-field' + (options.wide ? ' wide' : '') }, h('span', null, label),
    h(options.area ? 'textarea' : 'input', { className: 'vp-input', 'aria-label': label, value: value ?? '', disabled: Boolean(busy), type: options.type || 'text', placeholder: options.placeholder,
      min: options.min, max: options.max, step: options.step, readOnly: options.readOnly,
      onChange: e => onChange?.(options.type === 'number' ? e.target.value === '' ? '' : Number(e.target.value) : e.target.value) }), options.hint ? h('small', { className: 'vp-hint' }, options.hint) : null)
  const select = (label, value, onChange, options) => h('label', { className: 'vp-field' }, h('span', null, label), h('select', { className: 'vp-input', 'aria-label': label, value: value ?? '', disabled: Boolean(busy), onChange: e => onChange(e.target.value) }, options.map(o => h('option', { key: Array.isArray(o) ? o[0] : o, value: Array.isArray(o) ? o[0] : o }, Array.isArray(o) ? o[1] : o))))
  const toggle = (label, key) => h('label', { className: 'vp-toggle' }, h('input', { type: 'checkbox', checked: Boolean(config[key]), disabled: Boolean(busy), onChange: e => update(key, e.target.checked) }), label)

  if (!snapshot) return h('div', { className: 'vp' }, h('style', null, css), h('div', { className: 'vp-card' }, h('h3', null, '增强语音'), h('p', { className: 'vp-sub' }, error || '正在读取语音设置…'), error ? btn('重新连接', refresh) : null))
  const mismatch = snapshot.requestedMode !== snapshot.actualMode
  const originalFields = []
  if (['auto', 'edge'].includes(original.engine)) originalFields.push(
    field('微软音色名称', original.voice, v => updateOriginal('voice', v), { wide: true, placeholder: 'zh-CN-XiaoyiNeural' }),
    field('语速（edge）', original.rate, v => updateOriginal('rate', v), { placeholder: '+0%' }), field('音调（edge）', original.pitch, v => updateOriginal('pitch', v), { placeholder: '+0Hz' }))
  if (original.engine === 'windows') originalFields.push(h('p', { className: 'vp-hint' }, '使用目标 Windows 系统语音，无需填写服务参数。'))
  if (original.engine === 'gptsovits') originalFields.push(
    field('GPT-SoVITS 服务地址', original.gptsovits.url, v => updateOriginal('url', v, 'gptsovits'), { wide: true, placeholder: 'http://127.0.0.1:9880' }),
    field('参考音频路径', original.gptsovits.refAudio, v => updateOriginal('refAudio', v, 'gptsovits'), { wide: true }),
    field('参考音频文字', original.gptsovits.promptText, v => updateOriginal('promptText', v, 'gptsovits'), { wide: true, area: true }))
  if (original.engine === 'cosyvoice') originalFields.push(
    field('CosyVoice 服务地址', original.cosyvoice.url, v => updateOriginal('url', v, 'cosyvoice'), { wide: true, placeholder: 'http://127.0.0.1:50000' }),
    select('CosyVoice 模式', original.cosyvoice.mode, v => updateOriginal('mode', v, 'cosyvoice'), [['sft', '预置音色'], ['instruct', '语气指令']]),
    field('CosyVoice 音色 ID', original.cosyvoice.spkId, v => updateOriginal('spkId', v, 'cosyvoice')),
    ...(original.cosyvoice.mode === 'instruct' ? [field('CosyVoice 语气指令', original.cosyvoice.instruct, v => updateOriginal('instruct', v, 'cosyvoice'), { wide: true, area: true })] : []),
    field('采样率', original.cosyvoice.sampleRate, v => updateOriginal('sampleRate', v, 'cosyvoice'), { type: 'number', min: 8000, max: 96000 }))
  if (original.engine === 'http') originalFields.push(
    field('HTTP 接口地址', original.http.urlTemplate, v => updateOriginal('urlTemplate', v, 'http'), { wide: true, hint: 'GET 的地址含 {text}；POST 在请求体中使用 {text}。' }),
    select('HTTP 请求方式', original.http.method, v => updateOriginal('method', v, 'http'), ['GET', 'POST']),
    field('HTTP 请求头', original.http.headers, v => updateOriginal('headers', v, 'http'), { wide: true, area: true, placeholder: original.http.headersSet ? '已保存，留空保留；输入新内容则替换' : '一行一个 Header: Value' }),
    ...(original.http.method === 'POST' ? [field('HTTP 请求体', original.http.body, v => updateOriginal('body', v, 'http'), { wide: true, area: true, placeholder: '{"text":"{text}"}' })] : []))

  return h('div', { className: 'vp' }, h('style', null, css),
    h('header', { className: 'vp-head' }, h('div', null, h('h2', null, '让每句话，有自己的声音'), h('p', { className: 'vp-sub' }, '增强语音 · VOICE PLUS  /  配置与试听在一处')), h('span', { className: 'vp-badge', role: 'status', 'aria-label': '实际语音模式' }, '当前：' + modeNames[snapshot.actualMode])),
    h('div', { className: 'vp-modes', role: 'radiogroup', 'aria-label': '语音运行模式' }, [['enhanced', '增强语音', '我们的语音模块，支持远程 Breeze'], ['official', '官方语音', '切回宿主原版，保留原有设置'], ['off', '关闭语音', '两版都不运行，可随时重新开启']].map(([id, title, desc]) => h('button', { key: id, type: 'button', className: 'vp-mode', role: 'radio', 'aria-checked': snapshot.actualMode === id, disabled: Boolean(busy) || dirty || (id === 'enhanced' && !snapshot.enhancedAvailable), onClick: () => setMode(id) }, h('strong', null, title), h('span', null, desc)))),
    mismatch || snapshot.fallback ? h('p', { className: 'vp-note warn' }, '期望模式：' + modeNames[snapshot.requestedMode] + '。当前实际运行：' + modeNames[snapshot.actualMode] + '。' + (snapshot.moduleError || '请检查「已安装」中的模块状态；官方加载失败回退机制仍然保留。')) : null,
    error ? h('div', { className: 'vp-note err', role: 'alert' }, error) : null,
    h('div', { className: 'vp-grid' }, h('section', { className: 'vp-card' },
      snapshot.actualMode === 'official' ? h('p', { className: 'vp-note' }, '当前使用官方版。下方编辑原引擎；Breeze 参数原样保留，切回增强版即可继续使用。') : h('div', { className: 'vp-tabs', role: 'tablist', 'aria-label': '合成引擎' }, [['breezeblue', '远程 Breeze'], ['builtin', '原有引擎']].map(([id, name]) => h('button', { key: id, type: 'button', className: 'vp-tab', role: 'tab', 'aria-selected': provider === id, disabled: Boolean(busy), onClick: () => update('provider', id) }, name))),
      provider === 'breezeblue' ? h('div', { role: 'tabpanel', 'aria-label': '远程 Breeze 配置' }, h('div', { className: 'vp-fields' },
        field('服务地址', 'https://api.breeze.blue/v1', null, { wide: true, readOnly: true }),
        field('Breeze API Key', config.apiKey, v => update('apiKey', v), { wide: true, type: 'password', placeholder: snapshot.settings.apiKeySet ? '已保存密钥（留空不修改）' : 'brz_…', hint: '仅发送给官方 API；配置与密钥不会因切换模式而清空。' }),
        field('Voice ID', config.voiceId, v => update('voiceId', v), { wide: true, placeholder: 'voc_…' }),
        field('语速倍率', config.speed, v => update('speed', v), { type: 'number', min: .5, max: 2, step: .05 }),
        field('音量倍率', config.volume, v => update('volume', v), { type: 'number', min: .01, max: 2, step: .05 }),
        field('表演指令', config.instructions, v => update('instructions', v), { wide: true, area: true, placeholder: '自然、温柔地说话，像在和朋友聊天。' })),
        h('div', { className: 'vp-row', style: { marginTop: 12 } }, btn(picker ? '收起音色列表' : '选择已保存音色', () => setPicker(!picker), { className: 'vp-btn small' }), h('span', { className: 'vp-hint' }, '先保存密钥；查询不合成、不扣语音额度。')),
        picker ? h('div', { className: 'vp-picker' }, h('div', { className: 'vp-fields' }, select('音色来源', type, v => { setType(v); setVoices([]); setPageInfo({ page: 1, hasMore: false }) }, [['personal', '我的音色'], ['default', '平台音色'], ['all', '全部']]), field('搜索音色', search, v => { setSearch(v); setVoices([]); setPageInfo({ page: 1, hasMore: false }) })), h('div', { className: 'vp-row', style: { marginTop: 10 } }, btn('获取音色列表', () => loadVoices(false), { disabled: Boolean(busy) || !snapshot.settings.apiKeySet || snapshot.actualMode !== 'enhanced' })), voices.length ? select('选择 Breeze 音色', config.voiceId, v => update('voiceId', v), [['', '请选择'], ...(config.voiceId && !voices.some(v => v.voiceId === config.voiceId) ? [[config.voiceId, config.voiceId]] : []), ...voices.map(v => [v.voiceId, v.name + ' · ' + v.voiceId])]) : h('p', { className: 'vp-hint' }, '在增强模式下使用已保存的密钥查询。'), pageInfo.hasMore ? btn('加载更多', () => loadVoices(true)) : null) : null,
        h('details', { className: 'vp-details' }, h('summary', null, '高级设置 · 模型、格式与回退'), h('div', { className: 'vp-fields' },
          field('模型 ID', config.modelId, v => update('modelId', v)), field('语言代码', config.languageCode, v => update('languageCode', v), { placeholder: '留空自动识别 / zh' }),
          field('指令引导强度', config.guidanceScale, v => update('guidanceScale', v), { type: 'number', min: 1, max: 10, step: .1 }),
          select('输出格式', config.outputFormat, v => update('outputFormat', v), ['wav', 'wav_24000', 'mp3', 'mp3_24000_64', 'mp3_24000_96', 'mp3_24000_128', 'mp3_24000_160']),
          field('请求超时（秒）', config.timeoutSeconds, v => update('timeoutSeconds', v), { type: 'number', min: 10, max: 600, step: 10 }),
          select('回退引擎', original.engine, v => updateOriginal('engine', v), engines)), h('div', { className: 'vp-divider' }), toggle('增强参考音色相似度', 'speakerBoost'), toggle('Breeze 失败时回退原引擎（不重复请求 Breeze）', 'fallback'))) : h('div', { role: 'tabpanel', 'aria-label': '原有引擎配置' }, select('原有语音引擎', original.engine, v => updateOriginal('engine', v), engines), h('div', { className: 'vp-fields', style: { marginTop: 16 } }, originalFields), h('p', { className: 'vp-hint', style: { marginTop: 16 } }, '这是官方原有引擎的同一份配置。RVC、ASR、安装组件和自动语音规则仍在原「语音」页，保持原功能。')),
      h('footer', { className: 'vp-footer' }, h('span', { className: 'vp-hint', 'aria-live': 'polite' }, dirty ? '有未保存的修改 · 试听与模式切换前请保存' : '配置已保存'), h('div', { className: 'vp-row' }, btn(dirty ? '撤销修改' : '刷新', refresh), btn(busy === 'save' ? '保存中…' : '保存配置', saveAll, { className: 'vp-btn primary', disabled: Boolean(busy) || !dirty })))),
      h('aside', { className: 'vp-side' }, h('section', { className: 'vp-card' }, h('h3', null, '听听现在的声音'), h('p', { className: 'vp-sub' }, '使用已保存配置，与聊天的实际调用路径一致。'),
        h('div', { className: 'vp-info' }, h('span', null, '运行版本'), h('span', null, modeNames[snapshot.actualMode])), h('div', { className: 'vp-info' }, h('span', null, '生效引擎'), h('span', null, snapshot.actualMode === 'off' ? '未启用' : snapshot.actualMode === 'enhanced' && snapshot.settings.provider === 'breezeblue' ? '远程 Breeze' : engines.find(x => x[0] === snapshot.original.engine)?.[1] || '原有引擎')),
        snapshot.localTtsActive ? h('p', { className: 'vp-note warn', style: { marginTop: 12 } }, '本地 TTS 接口正在接管，优先于这里的引擎。要走 Breeze，请到「本地接口」关闭 TTS 接管。') : null,
        snapshot.rvcVoice ? h('p', { className: 'vp-hint' }, 'RVC 后处理：' + snapshot.rvcVoice + '。听 Breeze 原声请在原语音页取消 RVC。') : null,
        h('div', { className: 'vp-preview' }, field('试听文本', text, setText, { area: true, hint: '最多200字符；远程合成会计费，不自动重试。' }), btn(busy === 'test' ? '合成中，请稍候…' : '生成试听', preview, { className: 'vp-btn primary', style: { marginTop: 12, width: '100%' }, disabled: Boolean(busy) || dirty || snapshot.actualMode === 'off' || !text.trim() || Array.from(text).length > 200 })),
        audio ? h('div', { className: 'vp-preview' }, h('audio', { controls: true, src: audio.url }), h('p', { className: 'vp-hint' }, '本次实际引擎：' + audio.engine), h('a', { href: audio.url, download: 'voice-preview.' + (audio.mime === 'audio/wav' ? 'wav' : audio.mime === 'audio/ogg' ? 'ogg' : 'mp3') }, '下载试听')) : null),
        h('section', { className: 'vp-card' }, h('h3', null, '模式怎么选'), h('ul', { className: 'vp-guide' }, h('li', null, '增强：只运行我们的 voice，支持 Breeze 和原有引擎。'), h('li', null, '官方：只运行官方 voice，增强参数会保留。'), h('li', null, '关闭：不运行任何 voice；控制台留在这里，随时重开。'), h('li', null, '网络超时先看平台历史，避免重复提交计费。'))))))
}
